import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicReport } from "@/lib/public-report.functions";
import { Check, X, Minus } from "lucide-react";

export const Route = createFileRoute("/r/$classId/$date")({
  head: () => ({ meta: [{ title: "Attendance report — Hazira" }] }),
  component: PublicReport,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
      Could not load report: {error?.message ?? "unknown error"}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
      Report not found.
    </div>
  ),
});

type Report = Awaited<ReturnType<typeof getPublicReport>>;

function PublicReport() {
  const { classId, date } = Route.useParams();
  const fn = useServerFn(getPublicReport);
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fn({ data: { classId, date } });
        setReport(r as Report);
      } catch (e: any) {
        setErr(e?.message ?? "Could not load report");
      }
    })();
  }, [classId, date]);

  if (err) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-destructive">{err}</div>;
  if (!report) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-border p-6 mb-6" style={{ background: "var(--gradient-card)" }}>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Attendance report</p>
        <h1 className="text-2xl font-semibold mt-1">{report.className}{report.grade ? ` · ${report.grade}` : ""}</h1>
        {report.schoolName && <p className="text-sm text-muted-foreground">{report.schoolName}</p>}
        <p className="text-sm mt-1">{new Date(report.date).toDateString()}</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Present" value={report.present} tone="success" />
          <Stat label="Absent" value={report.absent} tone="destructive" />
          <Stat label="Total" value={report.total} tone="muted" />
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card divide-y divide-border">
        {report.students.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">No students in this class.</div>
        )}
        {report.students.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3 sm:p-4">
            <div className="w-8 text-xs font-mono text-muted-foreground">{s.roll}</div>
            <div className="flex-1 font-medium truncate">{s.name}</div>
            <StatusPill status={s.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "destructive" | "muted" }) {
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

function StatusPill({ status }: { status: "present" | "absent" | null }) {
  if (status === "present") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success border border-success/20 px-2.5 py-1 text-xs font-semibold">
        <Check className="h-3.5 w-3.5" strokeWidth={3} /> Present
      </span>
    );
  }
  if (status === "absent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-1 text-xs font-semibold">
        <X className="h-3.5 w-3.5" strokeWidth={3} /> Absent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-1 text-xs font-semibold">
      <Minus className="h-3.5 w-3.5" /> —
    </span>
  );
}