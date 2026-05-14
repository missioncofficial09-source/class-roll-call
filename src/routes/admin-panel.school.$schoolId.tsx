import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Building2, Users, GraduationCap, ClipboardCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSchoolDetails } from "@/lib/admin-schools.functions";

const STORAGE_KEY = "hazira:admin-unlocked";

export const Route = createFileRoute("/admin-panel/school/$schoolId")({
  head: () => ({ meta: [{ title: "School — Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SchoolDetailPage,
});

type Details = Awaited<ReturnType<typeof getSchoolDetails>>;

function SchoolDetailPage() {
  const { schoolId } = Route.useParams();
  const fetchDetails = useServerFn(getSchoolDetails);
  const [unlocked, setUnlocked] = useState(false);
  const [data, setData] = useState<Details | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    } else {
      window.location.href = "/admin-panel";
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetchDetails({ data: { id: schoolId } });
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load school");
    }
  }, [fetchDetails, schoolId]);

  useEffect(() => {
    if (!unlocked) return;
    void load();
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [unlocked, load]);

  if (!unlocked || !data) return null;

  const { school, classCount, classes, studentCount, teacherCount, todayAttendance } = data;

  const stats = [
    { label: "Students", value: studentCount, icon: Users },
    { label: "Classes", value: classCount, icon: Layers },
    { label: "Teachers", value: teacherCount, icon: GraduationCap },
    { label: "Marked today", value: todayAttendance, icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/admin-panel">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Schools
            </Button>
          </Link>
          <span className={`text-xs px-2 py-1 rounded-full ${school.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {school.is_active ? "Active" : "Stopped"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Code: <span className="font-mono">{school.code ?? "—"}</span> · Live data, refreshes every 15s
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <s.icon className="h-4 w-4" />
                {s.label}
              </div>
              <div className="text-2xl font-semibold mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium">Classes</div>
          <ul className="divide-y divide-border">
            {classes.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No classes yet.</li>
            )}
            {classes.map((c) => (
              <li key={c.id} className="p-4 flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.grade ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
