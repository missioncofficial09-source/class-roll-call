import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Users, BookOpen, UserPlus, GraduationCap, Clock, CircleDot, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin dashboard — Hazira" }] }),
  component: AdminPage,
});

type School = { id: string; name: string; code: string | null };
type ClassRow = { id: string; name: string; grade: string | null; school_id: string };
type StudentRow = { id: string; full_name: string; roll_number: number | null; class_id: string };
type ProfileRow = { id: string; full_name: string | null; school_id: string | null };

function AdminPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && role !== "admin") navigate({ to: "/attendance" }); }, [loading, role, navigate]);

  const today = new Date().toISOString().slice(0, 10);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<ProfileRow[]>([]);
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayAbsent, setTodayAbsent] = useState(0);
  const [perSchool, setPerSchool] = useState<{ school_id: string; present: number; absent: number; total: number }[]>([]);
  const [classRecords, setClassRecords] = useState<{ class_id: string; status: string; created_at: string; recorded_by: string | null }[]>([]);

  const refresh = async () => {
    const [{ data: s }, { data: c }, { data: st }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("schools").select("id, name, code").order("name"),
      supabase.from("classes").select("id, name, grade, school_id").order("name"),
      supabase.from("students").select("id, full_name, roll_number, class_id"),
      supabase.from("profiles").select("id, full_name, school_id"),
      supabase.from("attendance_records").select("school_id, class_id, status, created_at, recorded_by").eq("date", today),
    ]);
    setSchools((s as School[]) ?? []);
    setClasses((c as ClassRow[]) ?? []);
    setStudents((st as StudentRow[]) ?? []);
    setTeachers((p as ProfileRow[]) ?? []);
    const records = (a as { school_id: string; class_id: string; status: string; created_at: string; recorded_by: string | null }[]) ?? [];
    setClassRecords(records);
    setTodayPresent(records.filter((r) => r.status === "present").length);
    setTodayAbsent(records.filter((r) => r.status === "absent").length);
    const map = new Map<string, { present: number; absent: number; total: number }>();
    (s ?? []).forEach((sc: any) => map.set(sc.id, { present: 0, absent: 0, total: 0 }));
    records.forEach((r) => {
      const m = map.get(r.school_id) ?? { present: 0, absent: 0, total: 0 };
      if (r.status === "present") m.present++; else m.absent++;
      m.total++;
      map.set(r.school_id, m);
    });
    setPerSchool(Array.from(map.entries()).map(([school_id, v]) => ({ school_id, ...v })));
  };

  useEffect(() => {
    if (role !== "admin") return;
    void refresh();
    const channel = supabase
      .channel("admin-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {
        void refresh();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [role]);

  if (loading || role !== "admin") return null;

  const totalStudents = students.length;

  const classStatuses = classes.map((c) => {
    const recs = classRecords.filter((r) => r.class_id === c.id);
    const totalStudentsInClass = students.filter((s) => s.class_id === c.id).length;
    const marked = recs.length;
    const lastTs = recs.reduce<string | null>((acc, r) => (!acc || r.created_at > acc ? r.created_at : acc), null);
    let status: "completed" | "in_progress" | "not_started" = "not_started";
    if (totalStudentsInClass > 0 && marked >= totalStudentsInClass) status = "completed";
    else if (marked > 0) status = "in_progress";
    return { class: c, totalStudents: totalStudentsInClass, marked, lastTs, status };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Principal dashboard</h1>
          <p className="text-sm text-muted-foreground">Live numbers across all schools.</p>
        </div>
        <Button asChild variant="outline"><Link to="/attendance">Open class register</Link></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Schools" value={schools.length} icon={Building2} />
        <Stat label="Total students" value={totalStudents} icon={Users} />
        <Stat label="Present today" value={todayPresent} tone="success" icon={GraduationCap} />
        <Stat label="Absent today" value={todayAbsent} tone="destructive" icon={BookOpen} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8">
        <div className="p-4 border-b border-border font-semibold">Today by school</div>
        <div className="divide-y divide-border">
          {perSchool.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No schools yet.</div>}
          {perSchool.map((row) => {
            const sc = schools.find((s) => s.id === row.school_id);
            const pct = row.total ? Math.round((row.present / row.total) * 100) : 0;
            return (
              <div key={row.school_id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{sc?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {row.present} present • {row.absent} absent • {row.total} marked
                  </div>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right tabular-nums w-12 text-sm font-semibold">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold">Class submission status — today</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CircleDot className="h-3 w-3" /> Live</div>
        </div>
        <div className="divide-y divide-border">
          {classStatuses.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No classes yet.</div>}
          {classStatuses.map(({ class: c, totalStudents: tot, marked, lastTs, status }) => {
            const sc = schools.find((s) => s.id === c.school_id);
            return (
              <div key={c.id} className="p-4 flex items-center gap-4">
                <StatusPill status={status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}{c.grade ? ` · ${c.grade}` : ""}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {sc?.name ?? "—"} • {marked}/{tot} marked
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Submitted</div>
                  <div className="text-sm font-semibold tabular-nums flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {lastTs ? new Date(lastTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="schools" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>

        <TabsContent value="schools" className="mt-4">
          <SchoolsPanel schools={schools} onChange={refresh} />
        </TabsContent>
        <TabsContent value="classes" className="mt-4">
          <ClassesPanel schools={schools} classes={classes} onChange={refresh} />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <StudentsPanel classes={classes} schools={schools} students={students} onChange={refresh} />
        </TabsContent>
        <TabsContent value="teachers" className="mt-4">
          <TeachersPanel teachers={teachers} schools={schools} classes={classes} onChange={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: "success" | "destructive"; icon: any }) {
  const colors = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${colors}`} />
      </div>
      <div className={`text-3xl font-bold mt-2 tabular-nums ${colors}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: "completed" | "in_progress" | "not_started" }) {
  const config = {
    completed: { label: "Completed", Icon: CheckCircle2, cls: "bg-success/15 text-success border-success/30" },
    in_progress: { label: "In progress", Icon: CircleDot, cls: "bg-warning/15 text-warning border-warning/30 animate-pulse" },
    not_started: { label: "Not started", Icon: Circle, cls: "bg-muted text-muted-foreground border-border" },
  }[status];
  const Icon = config.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${config.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function SchoolsPanel({ schools, onChange }: { schools: School[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("schools").insert({ name: name.trim(), code: code.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setCode(""); onChange(); toast.success("School added");
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[200px]" />
        <Input placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
        <Button onClick={add}>Add school</Button>
      </div>
      <ul className="divide-y divide-border">
        {schools.map((s) => (
          <li key={s.id} className="py-2.5 flex justify-between text-sm">
            <span className="font-medium">{s.name}</span>
            <span className="text-muted-foreground">{s.code}</span>
          </li>
        ))}
        {schools.length === 0 && <li className="text-muted-foreground text-sm py-3">No schools yet.</li>}
      </ul>
    </div>
  );
}

function ClassesPanel({ schools, classes, onChange }: { schools: School[]; classes: ClassRow[]; onChange: () => void }) {
  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const add = async () => {
    if (!schoolId || !name.trim()) return toast.error("Pick a school and enter a class name");
    const { error } = await supabase.from("classes").insert({ school_id: schoolId, name: name.trim(), grade: grade.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setGrade(""); onChange(); toast.success("Class added");
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid sm:grid-cols-4 gap-2 mb-4">
        <Select value={schoolId} onValueChange={setSchoolId}>
          <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
          <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Class name (e.g. 8-A)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Grade (optional)" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <Button onClick={add}>Add class</Button>
      </div>
      <ul className="divide-y divide-border">
        {classes.map((c) => {
          const sc = schools.find((s) => s.id === c.school_id);
          return (
            <li key={c.id} className="py-2.5 flex justify-between text-sm">
              <span className="font-medium">{c.name}{c.grade ? ` · ${c.grade}` : ""}</span>
              <span className="text-muted-foreground">{sc?.name}</span>
            </li>
          );
        })}
        {classes.length === 0 && <li className="text-muted-foreground text-sm py-3">No classes yet.</li>}
      </ul>
    </div>
  );
}

function StudentsPanel({ schools, classes, students, onChange }: { schools: School[]; classes: ClassRow[]; students: StudentRow[]; onChange: () => void }) {
  const [classId, setClassId] = useState("");
  const [bulk, setBulk] = useState("");
  const add = async () => {
    if (!classId) return toast.error("Pick a class");
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((line, i) => {
      const m = line.match(/^(\d+)[.\s,-]+(.+)$/);
      return m
        ? { class_id: classId, roll_number: parseInt(m[1], 10), full_name: m[2].trim() }
        : { class_id: classId, roll_number: i + 1, full_name: line };
    });
    const { error } = await supabase.from("students").insert(rows);
    if (error) return toast.error(error.message);
    setBulk(""); onChange(); toast.success(`Added ${rows.length} students`);
  };
  const filtered = classId ? students.filter((s) => s.class_id === classId) : students;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-3">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => {
              const sc = schools.find((s) => s.id === c.school_id);
              return <SelectItem key={c.id} value={c.id}>{sc?.name} — {c.name}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>
      <Label className="text-xs text-muted-foreground">Paste one student per line. Optional roll number prefix: <code>1. Aisha Khan</code></Label>
      <textarea
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        rows={6}
        placeholder={"1. Aisha Khan\n2. Rahul Mehta\n..."}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
      />
      <Button onClick={add} className="mt-3"><UserPlus className="h-4 w-4 mr-1.5" /> Add students</Button>

      <div className="mt-6">
        <div className="text-sm text-muted-foreground mb-2">{filtered.length} students {classId ? "in class" : "total"}</div>
        <ul className="divide-y divide-border max-h-80 overflow-auto">
          {filtered.slice(0, 200).map((s) => (
            <li key={s.id} className="py-2 text-sm flex gap-3">
              <span className="w-8 text-muted-foreground font-mono">{s.roll_number ?? "—"}</span>
              <span>{s.full_name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TeachersPanel({ teachers, schools, classes, onChange }: { teachers: ProfileRow[]; schools: School[]; classes: ClassRow[]; onChange: () => void }) {
  const [assignments, setAssignments] = useState<{ teacher_id: string; class_id: string }[]>([]);
  useEffect(() => {
    void supabase.from("teacher_classes").select("teacher_id, class_id").then(({ data }) => setAssignments(data ?? []));
  }, [teachers, classes]);

  const setSchool = async (id: string, schoolId: string) => {
    const { error } = await supabase.from("profiles").update({ school_id: schoolId || null }).eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };
  const assignClass = async (teacherId: string, classId: string) => {
    if (!classId) return;
    const { error } = await supabase.from("teacher_classes").insert({ teacher_id: teacherId, class_id: classId });
    if (error) return toast.error(error.message);
    const { data } = await supabase.from("teacher_classes").select("teacher_id, class_id");
    setAssignments(data ?? []);
    toast.success("Assigned");
  };
  const unassign = async (teacherId: string, classId: string) => {
    await supabase.from("teacher_classes").delete().eq("teacher_id", teacherId).eq("class_id", classId);
    const { data } = await supabase.from("teacher_classes").select("teacher_id, class_id");
    setAssignments(data ?? []);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground mb-3">
        Teachers sign up themselves at <code>/signup</code>. Assign their school and classes here.
      </p>
      <ul className="divide-y divide-border">
        {teachers.map((t) => {
          const myClasses = assignments.filter((a) => a.teacher_id === t.id);
          const teacherSchoolId = t.school_id ?? "";
          const availableClasses = classes.filter((c) => (teacherSchoolId ? c.school_id === teacherSchoolId : true));
          return (
            <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{t.full_name ?? "Unnamed"}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{t.id.slice(0, 8)}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {myClasses.map((a) => {
                    const c = classes.find((cc) => cc.id === a.class_id);
                    return (
                      <span key={a.class_id} className="text-[11px] bg-accent/15 text-accent px-2 py-0.5 rounded-full flex items-center gap-1">
                        {c?.name ?? "?"}
                        <button onClick={() => unassign(t.id, a.class_id)} className="hover:text-destructive">×</button>
                      </span>
                    );
                  })}
                </div>
              </div>
              <Select value={teacherSchoolId} onValueChange={(v) => setSchool(t.id, v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="School" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value="" onValueChange={(v) => assignClass(t.id, v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="+ Assign class" /></SelectTrigger>
                <SelectContent>
                  {availableClasses
                    .filter((c) => !myClasses.some((a) => a.class_id === c.id))
                    .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}