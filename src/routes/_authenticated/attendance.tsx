import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, MessageCircle, Save, Users, Camera, Mic, MicOff, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { extractNamesFromImage } from "@/lib/extract-names.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Mark attendance — Hazira" }] }),
  component: AttendancePage,
});

type Status = "present" | "absent";
type Student = { id: string; full_name: string; roll_number: number | null };
type ClassRow = { id: string; name: string; grade: string | null; school_id: string; whatsapp_group_name: string | null; school: { name: string } | null };

function AttendancePage() {
  const { user, role } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // Load assigned classes (teachers) or all classes (admin)
  useEffect(() => {
    if (!user) return;
    (async () => {
      let q = supabase.from("classes").select("id, name, grade, school_id, whatsapp_group_name, school:schools(name)").order("name");
      if (role === "teacher") {
        const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", user.id);
        const ids = (tc ?? []).map((r) => r.class_id);
        if (ids.length === 0) { setClasses([]); return; }
        q = q.in("id", ids);
      }
      const { data, error } = await q;
      if (error) return toast.error(error.message);
      setClasses((data as ClassRow[]) ?? []);
      if (data && data.length > 0 && !classId) setClassId(data[0].id);
    })();
  }, [user, role]);

  // Load students + today's existing attendance
  useEffect(() => {
    if (!classId) { setStudents([]); setMarks({}); return; }
    setLoadingStudents(true);
    (async () => {
      const [{ data: s, error: e1 }, { data: a }] = await Promise.all([
        supabase.from("students").select("id, full_name, roll_number").eq("class_id", classId).order("roll_number", { nullsFirst: false }).order("full_name"),
        supabase.from("attendance_records").select("student_id, status").eq("class_id", classId).eq("date", today),
      ]);
      setLoadingStudents(false);
      if (e1) return toast.error(e1.message);
      setStudents((s as Student[]) ?? []);
      const m: Record<string, Status> = {};
      (a ?? []).forEach((r: any) => { m[r.student_id] = r.status; });
      setMarks(m);
    })();
  }, [classId, today]);

  const cls = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const presentCount = useMemo(() => Object.values(marks).filter((s) => s === "present").length, [marks]);
  const absentCount = useMemo(() => Object.values(marks).filter((s) => s === "absent").length, [marks]);
  const unmarked = students.length - presentCount - absentCount;

  const setMark = (id: string, status: Status) => setMarks((m) => ({ ...m, [id]: status }));
  const markAllPresent = () => {
    const m: Record<string, Status> = {};
    students.forEach((s) => { m[s.id] = "present"; });
    setMarks(m);
  };

  const save = async () => {
    if (!cls || !user) return;
    const rows = students
      .filter((s) => marks[s.id])
      .map((s) => ({
        student_id: s.id,
        class_id: cls.id,
        school_id: cls.school_id,
        recorded_by: user.id,
        date: today,
        status: marks[s.id],
      }));
    if (rows.length === 0) { toast.error("Mark at least one student"); return; }
    setSaving(true);
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${rows.length} records`);
  };

  const sendWhatsApp = async () => {
    if (!cls) return;
    await save();
    const absentees = students.filter((s) => marks[s.id] === "absent").map((s) => `• ${s.full_name}`).join("\n");
    const lines = [
      `📋 *${cls.school?.name ?? "School"} — ${cls.name} attendance*`,
      `🗓 ${new Date(today).toDateString()}`,
      ``,
      `✅ Present: ${presentCount}`,
      `❌ Absent: ${absentCount}`,
      `👥 Total: ${students.length}`,
    ];
    if (absentees) lines.push("", "*Absent students:*", absentees);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (classes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border p-10" style={{ background: "var(--gradient-card)" }}>
          <Users className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="mt-4 text-xl font-semibold">No classes assigned yet</h2>
          <p className="text-muted-foreground mt-2">Ask your admin to assign you to a class.</p>
          {role === "admin" && (
            <Button asChild className="mt-6"><Link to="/admin">Open admin dashboard</Link></Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today's register</h1>
          <p className="text-sm text-muted-foreground">{new Date(today).toDateString()}</p>
        </div>
        <div className="w-full sm:w-72">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.school ? ` — ${c.school.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Present" value={presentCount} tone="success" />
        <StatCard label="Absent" value={absentCount} tone="destructive" />
        <StatCard label="Pending" value={unmarked} tone="muted" />
      </div>

      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-muted-foreground">{students.length} students</span>
        <Button variant="ghost" size="sm" onClick={markAllPresent}>Mark all present</Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card divide-y divide-border">
        {loadingStudents && <div className="p-6 text-center text-muted-foreground">Loading…</div>}
        {!loadingStudents && students.length === 0 && <div className="p-6 text-center text-muted-foreground">No students in this class yet.</div>}
        {students.map((s, i) => {
          const status = marks[s.id];
          return (
            <div key={s.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="w-8 text-xs font-mono text-muted-foreground">{s.roll_number ?? i + 1}</div>
              <div className="flex-1 font-medium text-foreground truncate">{s.full_name}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMark(s.id, "present")}
                  aria-label="Present"
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all border ${
                    status === "present"
                      ? "bg-success text-success-foreground border-success shadow-md scale-105"
                      : "bg-background text-muted-foreground border-border hover:border-success/50 hover:text-success"
                  }`}
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={() => setMark(s.id, "absent")}
                  aria-label="Absent"
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all border ${
                    status === "absent"
                      ? "bg-destructive text-destructive-foreground border-destructive shadow-md scale-105"
                      : "bg-background text-muted-foreground border-border hover:border-destructive/50 hover:text-destructive"
                  }`}
                >
                  <X className="h-5 w-5" strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-3 sm:p-4 z-20">
          <div className="mx-auto max-w-3xl flex gap-3">
            <Button variant="outline" size="lg" onClick={save} disabled={saving} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="lg"
              onClick={sendWhatsApp}
              className="flex-1 h-12 text-base font-semibold text-success-foreground hover:opacity-90"
              style={{ background: "linear-gradient(135deg, oklch(0.62 0.16 150), oklch(0.55 0.17 155))" }}
            >
              <MessageCircle className="h-5 w-5 mr-2" /> Send to WhatsApp
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "success" | "destructive" | "muted" }) {
  const styles = {
    success: "bg-success/10 text-success border-success/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider mt-0.5 opacity-80">{label}</div>
    </div>
  );
}