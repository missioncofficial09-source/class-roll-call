import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Check, X, Circle } from "lucide-react";
import { getPrincipalDashboard } from "@/lib/principal-teachers.functions";

export const Route = createFileRoute("/_authenticated/principal/class/$classId")({
  head: () => ({ meta: [{ title: "Class details — Hazira" }] }),
  component: PrincipalClassPage,
});

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; full_name: string; roll_number: number | null; class_id: string };
type AttnRow = { student_id: string; class_id: string; status: "present" | "absent" };

function PrincipalClassPage() {
  const { classId } = Route.useParams() as { classId: string };
  const { role, schoolId, accessCode, loading } = useAuth();
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getPrincipalDashboard);

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attn, setAttn] = useState<AttnRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (role !== "principal" && role !== "admin") navigate({ to: "/" });
  }, [loading, role, navigate]);

  const refresh = async () => {
    if (!accessCode) return;
    try {
      const res = await fetchDashboard({ data: { code: accessCode } });
      const classes = Array.isArray(res?.classes) ? (res.classes as ClassRow[]) : [];
      const sts = Array.isArray(res?.students) ? (res.students as StudentRow[]) : [];
      const att = Array.isArray(res?.attendance) ? (res.attendance as AttnRow[]) : [];
      setCls(classes.find((c) => c.id === classId) ?? null);
      setStudents(sts.filter((s) => s.class_id === classId));
      setAttn(att.filter((a) => a.class_id === classId));
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!accessCode) return;
    setFetching(true);
    void refresh();
    if (!schoolId) return;
    const channel = supabase
      .channel(`principal-class-${classId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `school_id=eq.${schoolId}` },
        () => { void refresh(); })
      .subscribe();
    const poll = window.setInterval(() => { void refresh(); }, 15000);
    return () => { void supabase.removeChannel(channel); window.clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode, schoolId, classId]);

  if (loading || (role !== "principal" && role !== "admin")) return null;

  const statusByStudent = new Map(attn.map((a) => [a.student_id, a.status]));
  const presentCount = attn.filter((a) => a.status === "present").length;
  const absentCount = attn.filter((a) => a.status === "absent").length;
  const total = students.length;
  const unmarked = Math.max(0, total - presentCount - absentCount);

  const sorted = [...students].sort((a, b) => {
    const ar = a.roll_number ?? Number.MAX_SAFE_INTEGER;
    const br = b.roll_number ?? Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/principal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {cls ? `${cls.name}${cls.grade ? ` · ${cls.grade}` : ""}` : "Class"}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">Today's attendance</p>

      <div className="grid grid-cols-3 gap-3 mt-5 mb-6">
        <Stat label="Capacity" value={total} />
        <Stat label="Present" value={presentCount} tone="success" />
        <Stat label="Absent" value={absentCount} tone="destructive" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
          <span>Students</span>
          <span className="text-xs font-normal text-muted-foreground">
            {unmarked > 0 ? `${unmarked} unmarked` : "All marked"}
          </span>
        </div>
        {fetching ? (
          <div className="p-12 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No students in this class.</div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((s) => {
              const status = statusByStudent.get(s.id);
              return (
                <li key={s.id} className="p-4 flex items-center gap-3">
                  <div className="w-8 text-xs font-mono text-muted-foreground tabular-nums">
                    {s.roll_number != null ? `#${s.roll_number}` : ""}
                  </div>
                  <div className="flex-1 min-w-0 font-medium truncate">{s.full_name}</div>
                  <StatusBadge status={status} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: "present" | "absent" }) {
  if (status === "present") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" /> Present
      </span>
    );
  }
  if (status === "absent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <X className="h-3.5 w-3.5" /> Absent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Circle className="h-3.5 w-3.5" /> Unmarked
    </span>
  );
}