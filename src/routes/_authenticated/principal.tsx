import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, BookOpen, GraduationCap, CircleDot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/principal")({
  head: () => ({ meta: [{ title: "Principal — Hazira" }] }),
  component: PrincipalPage,
});

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; class_id: string };
type Attn = { class_id: string; status: "present" | "absent" };

function PrincipalPage() {
  const { role, schoolId, schoolName, loading } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [recs, setRecs] = useState<Attn[]>([]);

  useEffect(() => {
    if (loading) return;
    if (role !== "principal" && role !== "admin") navigate({ to: "/" });
  }, [loading, role, navigate]);

  const today = new Date().toISOString().slice(0, 10);

  const refresh = async () => {
    if (!schoolId) return;
    // Strict school_id filter — never query without it
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("classes").select("id, name, grade").eq("school_id", schoolId).order("name"),
    supabase.from("attendance_records").select("class_id, status").eq("school_id", schoolId).eq("date", today),
    ]);
    const cls = (c as ClassRow[]) ?? [];
    setClasses(cls);
    const classIds = cls.map((x) => x.id);
    if (classIds.length) {
      const { data: st } = await supabase.from("students").select("id, class_id").in("class_id", classIds);
      setStudents((st as StudentRow[]) ?? []);
    } else {
      setStudents([]);
    }
    setRecs((a as Attn[]) ?? []);
  };

  useEffect(() => {
    if (!schoolId) return;
    void refresh();
    const channel = supabase
      .channel(`principal-${schoolId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `school_id=eq.${schoolId}` },
        () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (loading || (role !== "principal" && role !== "admin")) return null;
  if (!schoolId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Your account isn't linked to a school yet. Ask your admin to assign one.
      </div>
    );
  }

  const present = recs.filter((r) => r.status === "present").length;
  const absent = recs.filter((r) => r.status === "absent").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{schoolName ?? "Principal"}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <CircleDot className="h-3 w-3 text-success" /> Today's attendance
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Classes" value={classes.length} icon={BookOpen} />
        <Stat label="Students" value={students.length} icon={Users} />
        <Stat label="Present today" value={present} tone="success" icon={GraduationCap} />
        <Stat label="Absent today" value={absent} tone="destructive" icon={GraduationCap} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Today by class</div>
        <ul className="divide-y divide-border">
          {classes.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No classes yet.</li>}
          {classes.map((c) => {
            const r = recs.filter((x) => x.class_id === c.id);
            const total = students.filter((s) => s.class_id === c.id).length;
            const p = r.filter((x) => x.status === "present").length;
            const a = r.filter((x) => x.status === "absent").length;
            const pct = p + a ? Math.round((p / (p + a)) * 100) : 0;
            return (
              <li key={c.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}{c.grade ? ` · ${c.grade}` : ""}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p} present · {a} absent · {r.length}/{total} marked</div>
                </div>
                <div className="text-right tabular-nums w-12 text-sm font-semibold">{pct}%</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: "success" | "destructive"; icon: any }) {
  const colors = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-2xl border border-border p-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${colors}`} />
      </div>
      <div className={`text-3xl font-bold mt-2 tabular-nums ${colors}`}>{value}</div>
    </div>
  );
}
