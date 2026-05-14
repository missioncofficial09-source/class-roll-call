import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { listSchools, addSchool, toggleSchool } from "@/lib/admin-schools.functions";

const MASTER_PASSWORD = "MissionC2026@gmail.com!";
const STORAGE_KEY = "hazira:admin-unlocked";

export const Route = createFileRoute("/admin-panel")({
  head: () => ({ meta: [{ title: "Admin — Hazira" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPanelGate,
});

type School = { id: string; name: string; code: string | null; is_active: boolean };

function AdminPanelGate() {
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== MASTER_PASSWORD) { toast.error("Incorrect master password"); return; }
    sessionStorage.setItem(STORAGE_KEY, "1");
    setUnlocked(true);
  };

  if (unlocked) return <AdminDashboard />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Admin access</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Enter the master password to continue.</p>
        <Label htmlFor="mp">Master password</Label>
        <Input id="mp" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5" />
        <Button type="submit" className="w-full mt-5">Unlock</Button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const fetchSchools = useServerFn(listSchools);
  const createSchool = useServerFn(addSchool);
  const setActive = useServerFn(toggleSchool);

  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetchSchools();
      setSchools(res.schools as School[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load schools");
    }
  }, [fetchSchools]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await createSchool({ data: { name: name.trim(), code: code.trim() || null } });
      setName(""); setCode("");
      toast.success("School added");
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add school");
    }
  };

  const handleToggle = async (s: School, value: boolean) => {
    try {
      await setActive({ data: { id: s.id, is_active: value } });
      setSchools((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: value } : x)));
      toast.success(value ? "School enabled" : "School disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Lock
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[200px]" />
            <Input placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
            <Button onClick={handleAdd}>Add school</Button>
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
                <Switch checked={s.is_active} onCheckedChange={(v) => void handleToggle(s, v)} aria-label={`Toggle ${s.name}`} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
