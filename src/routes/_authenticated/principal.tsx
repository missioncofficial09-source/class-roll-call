import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, BookOpen, GraduationCap, CircleDot, TrendingUp, FileBarChart2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/principal")({
  head: () => ({ meta: [{ title: "Principal dashboard — Hazira" }] }),
  component: PrincipalPage,
});

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; full_name: string; class_id: string; roll_number: number | null };
type Attn = { class_id: string; student_id: string; status: "present" | "absent"; date: string; created_at: string };
type MonthlyReport = {
  id: string; student_id: string; class_id: string; month: string;
  present_days: number; absent_days: number; attendance_pct: number;
  behavior_notes: string | null; academic_notes: string | null;
};

const todayKey = () => {
  const d = new Date();
  const o = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return o.toISOString().slice(0, 10);
};
const shiftDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00`); d.setDate(d.getDate() + n);
  const o = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return o.toISOString().slice(0, 10);
};

function PrincipalPage() {
  const { role, schoolId, schoolName, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (role !== "principal" && role !== "admin") {
      navigate({ to: role === "teacher" ? "/attendance" : "/login" });
    }
  }, [loading, role, navigate]);

  const today = todayKey();
  const monthStart = today.slice(0, 8) + "01";
  const trendStart = shiftDays(today, -29);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [todayRecs, setTodayRecs] = useState<Attn[]>([]);
  const [trendRecs, setTrendRecs] = useState<Attn[]>([]);
  const [monthRecs, setMonthRecs] = useState<Attn[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);

  const refresh = async () => {
    if (!schoolId) return;
    const [{ data: c }, { data: s }, { data: t }, { data: a1 }, { data: a30 }, { data: am }, { data: r }] = await Promise.all([
      supabase.from("classes").select("id, name, grade").eq("school_id", schoolId).order("name"),
      supabase.from("students").select("id, full_name, class_id, roll_number"),
      supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
      supabase.from("attendance_records").select("class_id, student_id, status, date, created_at").eq("school_id", schoolId).eq("date", today),
      supabase.from("attendance_records").select("class_id, student_id, status, date, created_at").eq("school_id", schoolId).gte("date", trendStart).lte("date", today),
      supabase.from("attendance_records").select("class_id, student_id, status, date, created_at").eq("school_id", schoolId).gte("date", monthStart).lte("date", today),
      supabase.from("monthly_reports").select("*").eq("school_id", schoolId).order("month", { ascending: false }).limit(200),
    ]);
    setClasses((c as ClassRow[]) ?? []);
    setStudents(((s as StudentRow[]) ?? []).filter((st) => (c ?? []).some((cc: any) => cc.id === st.class_id)));
    setTeachers((t as any[]) ?? []);
    setTodayRecs((a1 as Attn[]) ?? []);
    setTrendRecs((a30 as Attn[]) ?? []);
    setMonthRecs((am as Attn[]) ?? []);
    setReports((r as MonthlyReport[]) ?? []);
  };

  useEffect(() => {
    if (!schoolId || (role !== "principal" && role !== "admin")) return;
    void refresh();
    const channel = supabase
      .channel(`principal-${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `school_id=eq.${schoolId}` },
        () => { void refresh(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, role]);

  const presentToday = todayRecs.filter((r) => r.status === "present").length;
  const absentToday = todayRecs.filter((r) => r.status === "absent").length;
  const todayPct = presentToday + absentToday ? Math.round((presentToday / (presentToday + absentToday)) * 100) : 0;

  const trendByDay = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => shiftDays(today, i - 29));
    const map = new Map<string, { p: number; a: number }>();
    days.forEach((d) => map.set(d, { p: 0, a: 0 }));
    trendRecs.forEach((r) => {
      const m = map.get(r.date); if (!m) return;
      if (r.status === "present") m.p++; else m.a++;
    });
    return days.map((d) => {
      const v = map.get(d)!;
      const total = v.p + v.a;
      return { date: d, pct: total ? Math.round((v.p / total) * 100) : 0, total };
    });
  }, [trendRecs, today]);

  const classBreakdown = classes.map((c) => {
    const recs = todayRecs.filter((r) => r.class_id === c.id);
    const total = students.filter((s) => s.class_id === c.id).length;
    const p = recs.filter((r) => r.status === "present").length;
    const a = recs.filter((r) => r.status === "absent").length;
    return { c, total, p, a, marked: recs.length };
  });

  // Per-student month attendance
  const studentMonth = useMemo(() => {
    const m = new Map<string, { p: number; a: number }>();
    monthRecs.forEach((r) => {
      const e = m.get(r.student_id) ?? { p: 0, a: 0 };
      if (r.status === "present") e.p++; else e.a++;
      m.set(r.student_id, e);
    });
    return students.map((s) => {
      const v = m.get(s.id) ?? { p: 0, a: 0 };
      const total = v.p + v.a;
      return { s, p: v.p, a: v.a, pct: total ? Math.round((v.p / total) * 100) : 0 };
    });
  }, [monthRecs, students]);

  const top5 = [...studentMonth].filter((x) => x.p + x.a > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const bottom5 = [...studentMonth].filter((x) => x.p + x.a > 0).sort((a, b) => a.pct - b.pct).slice(0, 5);

  const generateMonthly = async () => {
    if (!schoolId) return;
    // Generate report for the previous month
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate()}`;
    const [{ data: attn }, { data: notes }] = await Promise.all([
      supabase.from("attendance_records").select("student_id, status, class_id").eq("school_id", schoolId).gte("date", month).lte("date", monthEnd),
      supabase.from("teacher_notes").select("student_id, kind, note").eq("school_id", schoolId).gte("created_at", `${month}T00:00:00`).lte("created_at", `${monthEnd}T23:59:59`),
    ]);
    const byStudent = new Map<string, { p: number; a: number; class_id: string }>();
    (attn as any[] ?? []).forEach((r) => {
      const e = byStudent.get(r.student_id) ?? { p: 0, a: 0, class_id: r.class_id };
      if (r.status === "present") e.p++; else e.a++;
      e.class_id = r.class_id;
      byStudent.set(r.student_id, e);
    });
    const notesByStudent = new Map<string, { behavior: string[]; academic: string[] }>();
    (notes as any[] ?? []).forEach((n) => {
      const e = notesByStudent.get(n.student_id) ?? { behavior: [], academic: [] };
      if (n.kind === "behavior") e.behavior.push(n.note); else e.academic.push(n.note);
      notesByStudent.set(n.student_id, e);
    });
    const rows = Array.from(byStudent.entries()).map(([student_id, v]) => {
      const total = v.p + v.a;
      const n = notesByStudent.get(student_id);
      return {
        student_id,
        school_id: schoolId,
        class_id: v.class_id,
        month,
        present_days: v.p,
        absent_days: v.a,
        attendance_pct: total ? Math.round((v.p / total) * 10000) / 100 : 0,
        behavior_notes: n?.behavior.join(" • ") || null,
        academic_notes: n?.academic.join(" • ") || null,
      };
    });
    if (rows.length === 0) { toast.info("No attendance data for last month"); return; }
    const { error } = await supabase.from("monthly_reports").upsert(rows, { onConflict: "student_id,month" });
    if (error) return toast.error(error.message);
    toast.success(`Generated ${rows.length} reports`);
    void refresh();
  };

  if (loading || (role !== "principal" && role !== "admin")) return null;
  if (!schoolId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Your account isn't linked to a school yet. Ask your admin to assign one.
      </div>
    );
  }

  const peakPct = Math.max(1, ...trendByDay.map((d) => d.pct));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{schoolName ?? "Principal dashboard"}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CircleDot className="h-3 w-3 text-success" /> Live • School-wide overview
          </p>
        </div>
        <Button onClick={generateMonthly}>
          <FileBarChart2 className="h-4 w-4 mr-1.5" /> Generate last month's reports
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Students" value={students.length} icon={Users} />
        <Stat label="Teachers" value={teachers.length} icon={GraduationCap} />
        <Stat label="Classes" value={classes.length} icon={BookOpen} />
        <Stat label="Attendance today" value={todayPct} suffix="%" tone="success" icon={TrendingUp} />
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="trend">30-day trend</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="reports">Monthly reports</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border font-semibold">Class breakdown — today</div>
            <div className="divide-y divide-border">
              {classBreakdown.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No classes yet.</div>}
              {classBreakdown.map(({ c, total, p, a, marked }) => {
                const pct = p + a ? Math.round((p / (p + a)) * 100) : 0;
                return (
                  <div key={c.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}{c.grade ? ` · ${c.grade}` : ""}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p} present • {a} absent • {marked}/{total} marked</div>
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
        </TabsContent>

        <TabsContent value="trend" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="font-semibold mb-3">Last 30 days — attendance %</div>
            <div className="flex items-end gap-1 h-40">
              {trendByDay.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date} — ${d.pct}%`}>
                  <div
                    className={`w-full rounded-t ${d.total ? "bg-primary" : "bg-muted"}`}
                    style={{ height: `${(d.pct / peakPct) * 100}%`, minHeight: d.total ? 4 : 2 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 tabular-nums">
              <span>{trendByDay[0]?.date}</span>
              <span>{trendByDay[trendByDay.length - 1]?.date}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border font-semibold text-success">Top attendance — this month</div>
              <ul className="divide-y divide-border">
                {top5.length === 0 && <li className="p-4 text-sm text-muted-foreground">No data yet.</li>}
                {top5.map((x) => (
                  <li key={x.s.id} className="p-3 flex justify-between text-sm">
                    <span>{x.s.full_name}</span>
                    <span className="font-semibold tabular-nums">{x.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border font-semibold text-destructive">Needs attention</div>
              <ul className="divide-y divide-border">
                {bottom5.length === 0 && <li className="p-4 text-sm text-muted-foreground">No data yet.</li>}
                {bottom5.map((x) => (
                  <li key={x.s.id} className="p-3 flex justify-between text-sm">
                    <span>{x.s.full_name}</span>
                    <span className="font-semibold tabular-nums">{x.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ReportsPanel reports={reports} students={students} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, suffix, tone, icon: Icon }: { label: string; value: number; suffix?: string; tone?: "success"; icon: any }) {
  const colors = tone === "success" ? "text-success" : "text-primary";
  return (
    <div className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${colors}`} />
      </div>
      <div className={`text-3xl font-bold mt-2 tabular-nums ${colors}`}>{value}{suffix ?? ""}</div>
    </div>
  );
}

function ReportsPanel({ reports, students }: { reports: MonthlyReport[]; students: StudentRow[] }) {
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name ?? "Unknown";
  const buildWaHref = (r: MonthlyReport) => {
    const lines = [
      `Hazira Monthly Report`,
      `Student: ${studentName(r.student_id)}`,
      `Month: ${r.month.slice(0, 7)}`,
      `Attendance: ${r.attendance_pct}% (${r.present_days} present / ${r.absent_days} absent)`,
      r.behavior_notes ? `Behavior: ${r.behavior_notes}` : "",
      r.academic_notes ? `Academic: ${r.academic_notes}` : "",
    ].filter(Boolean);
    const phone = (students.find((s) => s.id === r.student_id) as any)?.parent_phone ?? "";
    return `https://wa.me/${(phone || "").replace(/[^0-9]/g, "")}?text=${lines.map(encodeURIComponent).join("%0A")}`;
  };
  const months = Array.from(new Set(reports.map((r) => r.month))).sort().reverse();
  return (
    <div className="space-y-4">
      {reports.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reports generated yet. Click "Generate last month's reports" above to create them.
        </div>
      )}
      {months.map((m) => (
        <div key={m} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border font-semibold">Reports — {m.slice(0, 7)}</div>
          <ul className="divide-y divide-border">
            {reports.filter((r) => r.month === m).map((r) => (
              <li key={r.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{studentName(r.student_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.present_days}P / {r.absent_days}A · {r.attendance_pct}%
                    {r.behavior_notes ? ` · Behavior: ${r.behavior_notes}` : ""}
                    {r.academic_notes ? ` · Academic: ${r.academic_notes}` : ""}
                  </div>
                </div>
                <a
                  href={buildWaHref(r)}
                  target="_blank"
                  rel="noopener"
                  className="text-xs px-3 py-1.5 rounded-md bg-success text-success-foreground font-medium"
                >
                  Send to parent
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}