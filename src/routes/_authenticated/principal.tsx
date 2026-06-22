import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, BookOpen, GraduationCap, CircleDot, UserPlus, Trash2, Copy, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listSchoolTeachers,
  createSchoolTeacher,
  deleteSchoolTeacher,
  updateSchoolTeacher,
} from "@/lib/principal-teachers.functions";

export const Route = createFileRoute("/_authenticated/principal")({
  head: () => ({ meta: [{ title: "Principal — Hazira" }] }),
  component: PrincipalPage,
});

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; class_id: string };
type Attn = { class_id: string; status: "present" | "absent" };

function PrincipalPage() {
  const { role, schoolId, schoolName, loading, accessCode } = useAuth();
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatLink to="classes" label="Classes" value={classes.length} icon={BookOpen} />
        <StatLink to="students" label="Students" value={students.length} icon={Users} />
        <StatLink to="present" label="Present today" value={present} tone="success" icon={GraduationCap} />
        <StatLink to="absent" label="Absent today" value={absent} tone="destructive" icon={GraduationCap} />
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
        </TabsContent>

        <TabsContent value="teachers" className="mt-0">
          <TeachersTab classes={classes} accessCode={accessCode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatLink({ to, label, value, tone, icon: Icon }: { to: "classes" | "students" | "present" | "absent"; label: string; value: number; tone?: "success" | "destructive"; icon: any }) {
  const colors = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Link
      to="/principal/detail/$kind"
      params={{ kind: to }}
      className="rounded-2xl border border-border p-4 bg-card hover:bg-muted/40 transition-colors group focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${colors}`} />
      </div>
      <div className="flex items-end justify-between mt-2">
        <div className={`text-3xl font-bold tabular-nums ${colors}`}>{value}</div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

type TeacherRow = {
  id: string;
  full_name: string;
  code: string;
  class_id: string | null;
  is_active: boolean;
  classes?: { name: string; grade: string | null } | null;
};

function TeachersTab({ classes: _classes, accessCode }: { classes: ClassRow[]; accessCode: string | null }) {
  const list = useServerFn(listSchoolTeachers);
  const create = useServerFn(createSchoolTeacher);
  const update = useServerFn(updateSchoolTeacher);
  const remove = useServerFn(deleteSchoolTeacher);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [codeSuffix, setCodeSuffix] = useState("");
  const [className, setClassName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!accessCode) return;
    try {
      const rows = await list({ data: { code: accessCode } });
      setTeachers(rows as TeacherRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load teachers");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return toast.error("Missing principal code");
    if (!fullName.trim() || !codeSuffix.trim()) return toast.error("Name and code are required");
    setBusy(true);
    try {
      await create({
        data: {
          code: accessCode,
          fullName: fullName.trim(),
          teacherCode: codeSuffix.trim(),
          className: className.trim() || null,
        },
      });
      toast.success("Teacher created");
      setFullName("");
      setCodeSuffix("");
      setClassName("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create teacher");
    } finally {
      setBusy(false);
    }
  };

  const onAssign = async (teacherId: string, value: string) => {
    if (!accessCode) return;
    try {
      await update({
        data: { code: accessCode, teacherId, className: value.trim() || null },
      });
      toast.success("Class updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onDelete = async (teacherId: string) => {
    if (!accessCode) return;
    if (!confirm("Remove this teacher? Their code will stop working.")) return;
    try {
      await remove({ data: { code: accessCode, teacherId } });
      toast.success("Teacher removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success("Code copied"); }
    catch { toast.error("Couldn't copy"); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Add a teacher</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="t-name">Full name</Label>
            <Input id="t-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ms. Aisha Khan" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="t-code">Teacher code</Label>
            <div className="mt-1.5 flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="px-2.5 text-sm text-muted-foreground font-mono">TCH-</span>
              <Input id="t-code" value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value.replace(/\s+/g, ""))} placeholder="A101" className="border-0 focus-visible:ring-0 font-mono" />
            </div>
          </div>
          <div>
            <Label htmlFor="t-class">Class</Label>
            <Input
              id="t-class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. 8th A"
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create teacher"}</Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Teachers</div>
        <ul className="divide-y divide-border">
          {teachers.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No teachers yet. Add one above.</li>
          )}
          {teachers.map((t) => (
            <li key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{t.full_name}</div>
                <button onClick={() => copyCode(t.code)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground">
                  {t.code} <Copy className="h-3 w-3" />
                </button>
              </div>
              <ClassNameInput
                initial={t.classes?.name ?? ""}
                onSave={(v) => onAssign(t.id, v)}
              />
              <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} aria-label="Remove teacher">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ClassNameInput({ initial, onSave }: { initial: string; onSave: (v: string) => void | Promise<void> }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { setValue(initial); }, [initial]);
  const commit = () => {
    if ((value.trim() || "") === (initial.trim() || "")) return;
    void onSave(value);
  };
  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="e.g. 8th A"
      className="w-full sm:w-56"
    />
  );
}
