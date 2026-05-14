import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Building2, LogOut, Ban, Trash2, Play, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { listSchools, addSchool, toggleSchool, deleteSchool } from "@/lib/admin-schools.functions";

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
  const removeSchool = useServerFn(deleteSchool);

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

  const handleStop = async (s: School) => {
    const next = !s.is_active;
    try {
      await setActive({ data: { id: s.id, is_active: next } });
      setSchools((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
      toast.success(next ? "School activated" : "School stopped");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleRemove = async (s: School) => {
    try {
      await removeSchool({ data: { id: s.id } });
      setSchools((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("School removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
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
              <li key={s.id} className="p-4 flex flex-wrap items-center gap-3">
                <Link
                  to="/admin-panel/school/$schoolId"
                  params={{ schoolId: s.id }}
                  className="flex-1 min-w-0 group"
                >
                  <div className="font-medium truncate group-hover:text-primary inline-flex items-center gap-1">
                    {s.name}
                    <ChevronRight className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.code ?? "no code"} · {s.is_active ? "Active" : "Stopped"}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={s.is_active ? "secondary" : "default"}
                    onClick={() => void handleStop(s)}
                  >
                    {s.is_active ? <><Ban className="h-4 w-4 mr-1" />Stop</> : <><Play className="h-4 w-4 mr-1" />Resume</>}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4 mr-1" />Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {s.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the school. Existing classes, students, and attendance records may become orphaned.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleRemove(s)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
