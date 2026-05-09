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
import { WalletCard } from "@/components/WalletCard";

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

  // --- Roster import (camera + voice) ---
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importNames, setImportNames] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const extractFn = useServerFn(extractNamesFromImage);

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

  // ---- Image → names (resize + AI OCR) ----
  const fileToCompressedBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result as string; };
      reader.onerror = () => reject(new Error("Could not read file"));
      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Invalid image"));
      reader.readAsDataURL(file);
    });

  const onCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!classId) { toast.error("Pick a class first"); return; }
    setExtracting(true);
    setImportOpen(true);
    setImportNames([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const res = await extractFn({ data: { imageBase64: base64, mimeType, accessToken: token } });
      const names = (res?.names ?? []) as string[];
      if (names.length === 0) toast.warning("No names detected. Try a clearer photo.");
      setImportNames(names);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not read register photo");
      setImportOpen(false);
    } finally {
      setExtracting(false);
    }
  };

  // ---- Voice → names ----
  const startListening = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (!classId) { toast.error("Pick a class first"); return; }
    if (!importOpen) setImportOpen(true);
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase: string = event.results[i][0].transcript.trim();
        if (!phrase) continue;
        // Split on "next"/"comma"/"and" or punctuation so teachers can dictate multiple names
        const parts = phrase
          .split(/\b(?:next|comma|and)\b|[,\.;\n]/i)
          .map((p) => p.trim())
          .filter((p) => p.length > 1);
        setImportNames((prev) => {
          const existing = new Set(prev.map((n) => n.toLowerCase()));
          const add = parts.filter((p) => !existing.has(p.toLowerCase()));
          return [...prev, ...add];
        });
      }
    };
    rec.onerror = (e: any) => toast.error(`Mic error: ${e.error ?? "unknown"}`);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };
  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const updateImportName = (idx: number, value: string) =>
    setImportNames((prev) => prev.map((n, i) => (i === idx ? value : n)));
  const removeImportName = (idx: number) =>
    setImportNames((prev) => prev.filter((_, i) => i !== idx));
  const addBlankImportName = () => setImportNames((prev) => [...prev, ""]);

  const confirmImport = async () => {
    if (!classId) return;
    const cleaned = importNames.map((n) => n.trim()).filter((n) => n.length > 1);
    if (cleaned.length === 0) { toast.error("No names to add"); return; }
    // Avoid duplicates already in the class
    const existing = new Set(students.map((s) => s.full_name.toLowerCase()));
    const fresh = cleaned.filter((n) => !existing.has(n.toLowerCase()));
    if (fresh.length === 0) { toast.info("All names already in this class"); setImportOpen(false); return; }
    const startRoll = (students.reduce((m, s) => Math.max(m, s.roll_number ?? 0), 0)) + 1;
    const rows = fresh.map((full_name, i) => ({ class_id: classId, full_name, roll_number: startRoll + i }));
    setImporting(true);
    const { error } = await supabase.from("students").insert(rows);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${rows.length} student${rows.length === 1 ? "" : "s"}`);
    setImportOpen(false);
    setImportNames([]);
    // Reload students
    const { data: s } = await supabase.from("students").select("id, full_name, roll_number").eq("class_id", classId).order("roll_number", { nullsFirst: false }).order("full_name");
    setStudents((s as Student[]) ?? []);
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

      {role === "teacher" && user && <WalletCard userId={user.id} />}

      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-muted-foreground">{students.length} students</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!classId}
            title="Scan register photo"
          >
            <Camera className="h-4 w-4 mr-1.5" /> Scan register
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setImportOpen(true); }}
            disabled={!classId}
            title="Add names by voice"
          >
            <Mic className="h-4 w-4 mr-1.5" /> Voice add
          </Button>
          <Button variant="ghost" size="sm" onClick={markAllPresent}>Mark all present</Button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onCameraFile}
        />
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

      {/* Import dialog: camera OCR results + voice dictation */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          if (!o) { stopListening(); setImportOpen(false); }
          else setImportOpen(true);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add students to {cls?.name ?? "class"}</DialogTitle>
            <DialogDescription>
              Review the names below. Edit, remove, or add more before saving. Use the mic to dictate names — say each name and pause, or separate with "next".
            </DialogDescription>
          </DialogHeader>

          {extracting ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Reading register photo…
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 py-1">
              {importNames.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No names yet. Tap the mic to dictate, or close and use “Scan register”.
                </p>
              )}
              {importNames.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-mono text-muted-foreground">{i + 1}</span>
                  <Input value={n} onChange={(e) => updateImportName(i, e.target.value)} placeholder="Student full name" />
                  <Button variant="ghost" size="icon" onClick={() => removeImportName(i)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addBlankImportName} className="w-full mt-2">
                <Plus className="h-4 w-4 mr-1.5" /> Add another name
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant={listening ? "destructive" : "outline"}
              onClick={listening ? stopListening : startListening}
              className="sm:mr-auto"
            >
              {listening ? (<><MicOff className="h-4 w-4 mr-2" /> Stop</>) : (<><Mic className="h-4 w-4 mr-2" /> Dictate</>)}
            </Button>
            <Button variant="ghost" onClick={() => { stopListening(); setImportOpen(false); }}>Cancel</Button>
            <Button onClick={confirmImport} disabled={importing || extracting || importNames.length === 0}>
              {importing ? "Adding…" : `Add ${importNames.filter((n) => n.trim().length > 1).length || ""} students`.trim()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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