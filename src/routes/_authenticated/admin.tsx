import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Hazira" }] }),
  component: AdminPage,
});

type School = { id: string; name: string; code: string | null; is_active: boolean };

function AdminPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (loading) return;
    if (role !== "admin") navigate({ to: "/" });
  }, [loading, role, navigate]);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, code, is_active")
      .order("name");
    if (error) return toast.error(error.message);
    setSchools((data as School[]) ?? []);
  };

  useEffect(() => { if (role === "admin") void refresh(); }, [role]);

  const addSchool = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("schools").insert({
      name: name.trim(),
      code: code.trim() || null,
    });
    if (error) return toast.error(error.message);
    setName(""); setCode("");
    toast.success("School added");
    void refresh();
  };

  const toggle = async (s: School, value: boolean) => {
    const { error } = await supabase.from("schools").update({ is_active: value }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setSchools((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: value } : x)));
    toast.success(value ? "School enabled" : "School disabled");
  };

  if (loading || role !== "admin") return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="School name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Input
            placeholder="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-40"
          />
          <Button onClick={addSchool}>Add school</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <ul className="divide-y divide-border">
          {schools.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No schools yet.</li>
          )}
          {schools.map((s) => (
            <li key={s.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.code ?? "no code"} · {s.is_active ? "Active" : "Disabled"}
                </div>
              </div>
              <Switch
                checked={s.is_active}
                onCheckedChange={(v) => void toggle(s, v)}
                aria-label={`Toggle ${s.name}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
