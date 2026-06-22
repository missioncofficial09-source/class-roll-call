import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, BookOpen, Users, GraduationCap, Loader2 } from "lucide-react";

type Kind = "classes" | "students" | "present" | "absent";

export const Route = createFileRoute("/_authenticated/principal/detail/$kind")({
  head: () => ({ meta: [{ title: "Details — Hazira" }] }),
  component: PrincipalDetailPage,
});

const TITLES: Record<Kind, string> = {
  classes: "All classes",
  students: "All students",
  present: "Present today",
  absent: "Absent today",
};

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; full_name: string; roll_number: number | null; class_id: string };
type AttnRow = { student_id: string; class_id: string; status: "present" | "absent" };

function PrincipalDetailPage() {
  const { kind } = Route.useParams() as { kind: Kind };
  const { role, schoolId, loading } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attn, setAttn] = useState<AttnRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (role !== "principal" && role !== "admin") navigate({ to: "/" });
  }, [loading, role, navigate]);

  const today = new Date().toISOString().slice(0, 10);
  const isValid = (["classes", "students", "present", "absent"] as Kind[]).includes(kind);

  useEffect(() => {
    if (!schoolId || !isValid) return;
    setFetching(true);
    (async () => {
      const { data: c } = await supabase
        .from("classes").select("id, name, grade").eq("school_id", schoolId).order("name");
      const cls = (c as ClassRow[]) ?? [];
      setClasses(cls);
      const ids = cls.map((x) => x.id);
      if (ids.length === 0) { setStudents([]); setAttn([]); setFetching(false); return; }
      const [{ data: s }, { data: a }] = await Promise.all([
        supabase.from("students").select("id, full_name, roll_number, class_id").in("class_id", ids).order("full_name"),
        supabase.from("attendance_records").select("student_id, class_id, status").eq("school_id", schoolId).eq("date", today),
      ]);
      setStudents((s as StudentRow[]) ?? []);
      setAttn((a as AttnRow[]) ?? []);
      setFetching(false);
    })();
  }, [schoolId, isValid, today]);

  if (loading || (role !== "principal" && role !== "admin")) return null;
  if (!isValid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Unknown view. <Link to="/principal" className="text-primary underline">Back to dashboard</Link>
      </div>
    );
  }

  const classNameById = new Map(classes.map((c) => [c.id, `${c.name}${c.grade ? ` · ${c.grade}` : ""}`]));
  const studentById = new Map(students.map((s) => [s.id, s]));

  let body: React.ReactNode = null;
  if (fetching) {
    body = (
      <div className="p-12 flex justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  } else if (kind === "classes") {
    body = classes.length === 0 ? (
      <Empty text="No classes yet." />
    ) : (
      <ul className="divide-y divide-border">
        {classes.map((c) => {
          const count = students.filter((s) => s.class_id === c.id).length;
          return (
            <li key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <div className="font-medium truncate">{c.name}{c.grade ? ` · ${c.grade}` : ""}</div>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">{count} student{count === 1 ? "" : "s"}</div>
            </li>
          );
        })}
      </ul>
    );
  } else if (kind === "students") {
    body = students.length === 0 ? (
      <Empty text="No students yet." />
    ) : (
      <ul className="divide-y divide-border">
        {students.map((s) => (
          <li key={s.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Users className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{s.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{classNameById.get(s.class_id) ?? "—"}</div>
              </div>
            </div>
            {s.roll_number != null && (
              <div className="text-xs font-mono text-muted-foreground tabular-nums">#{s.roll_number}</div>
            )}
          </li>
        ))}
      </ul>
    );
  } else {
    const wanted = kind === "present" ? "present" : "absent";
    const tone = wanted === "present" ? "text-success" : "text-destructive";
    const filtered = attn.filter((r) => r.status === wanted);
    body = filtered.length === 0 ? (
      <Empty text={`No students marked ${wanted} today.`} />
    ) : (
      <ul className="divide-y divide-border">
        {filtered.map((r, i) => {
          const s = studentById.get(r.student_id);
          return (
            <li key={`${r.student_id}-${i}`} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <GraduationCap className={`h-4 w-4 shrink-0 ${tone}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{s?.full_name ?? "Unknown student"}</div>
                  <div className="text-xs text-muted-foreground truncate">{classNameById.get(r.class_id) ?? "—"}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/principal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{TITLES[kind]}</h1>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">{body}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}