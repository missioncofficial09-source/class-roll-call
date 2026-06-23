import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Resolve a teacher/principal access code to its school_id, server-side.
// This is the single chokepoint that enforces per-school data isolation:
// every query below filters strictly by the schoolId returned here, so
// School A cannot read or write School B data even with a forged classId.
async function resolveSchoolId(rawCode: string): Promise<{ schoolId: string; role: "principal" | "teacher" }> {
  const cleaned = rawCode.replace(/[\s-]+/g, "").toUpperCase();
  const m = cleaned.match(/^(PRN|TCH)(.+)$/);
  if (!m) throw new Response("Invalid access code", { status: 400 });
  const role = m[1] === "PRN" ? "principal" : "teacher";
  const suffix = m[2];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: school, error } = await supabaseAdmin
    .from("schools")
    .select("id, is_active")
    .or(`code.ilike.PRN-${suffix},code.ilike.PRN${suffix}`)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!school) throw new Response("Access code not found", { status: 401 });
  if (school.is_active === false) throw new Response("School disabled", { status: 403 });
  return { schoolId: school.id as string, role };
}

const CodeOnly = z.object({ code: z.string().trim().min(3).max(64) });

export const listTeacherClasses = createServerFn({ method: "POST" })
  .inputValidator((d) => CodeOnly.parse(d))
  .handler(async ({ data }) => {
    const { schoolId } = await resolveSchoolId(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If this is a teacher code (TCH-*), restrict to the class the principal
    // assigned via school_teachers.class_id. Principal codes see all classes.
    const cleaned = data.code.replace(/[\s-]+/g, "").toUpperCase();
    const isTeacher = cleaned.startsWith("TCH");
    if (isTeacher) {
      const variants = {
        dashed: `TCH-${cleaned.slice(3)}`,
        bare: `TCH${cleaned.slice(3)}`,
      };
      const { data: teacher, error: tErr } = await supabaseAdmin
        .from("school_teachers")
        .select("class_id, school_id, is_active")
        .or(`code.ilike.${variants.dashed},code.ilike.${variants.bare}`)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (tErr) throw new Response(tErr.message, { status: 500 });
      if (teacher?.class_id) {
        const { data: rows, error } = await supabaseAdmin
          .from("classes")
          .select("id, name, grade, school_id, whatsapp_group_name")
          .eq("school_id", schoolId)
          .eq("id", teacher.class_id);
        if (error) throw new Response(error.message, { status: 500 });
        return { schoolId, classes: rows ?? [] };
      }
      // No assignment yet → empty list (UI shows "No classes assigned yet").
      return { schoolId, classes: [] };
    }

    const { data: rows, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, grade, school_id, whatsapp_group_name")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return { schoolId, classes: rows ?? [] };
  });

const ClassScoped = CodeOnly.extend({ classId: z.string().uuid() });

async function assertClassInSchool(classId: string, schoolId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cls, error } = await supabaseAdmin
    .from("classes")
    .select("id, school_id")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!cls || cls.school_id !== schoolId) {
    throw new Response("Class does not belong to your school", { status: 403 });
  }
}

export const listClassStudents = createServerFn({ method: "POST" })
  .inputValidator((d) => ClassScoped.parse(d))
  .handler(async ({ data }) => {
    const { schoolId } = await resolveSchoolId(data.code);
    await assertClassInSchool(data.classId, schoolId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, roll_number, class_id")
      .eq("class_id", data.classId)
      .order("roll_number", { nullsFirst: false })
      .order("full_name");
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

const RangeScoped = ClassScoped.extend({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listClassAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => RangeScoped.parse(d))
  .handler(async ({ data }) => {
    const { schoolId } = await resolveSchoolId(data.code);
    await assertClassInSchool(data.classId, schoolId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("attendance_records")
      .select("student_id, status, date")
      .eq("school_id", schoolId)
      .eq("class_id", data.classId)
      .gte("date", data.fromDate)
      .lte("date", data.toDate);
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

const SaveAttendance = ClassScoped.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(["present", "absent"]),
  })).min(1),
});

export const saveClassAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => SaveAttendance.parse(d))
  .handler(async ({ data }) => {
    const { schoolId } = await resolveSchoolId(data.code);
    await assertClassInSchool(data.classId, schoolId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Defense-in-depth: ensure every student belongs to this class.
    const ids = data.marks.map((m) => m.student_id);
    const { data: validStudents, error: stErr } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("class_id", data.classId)
      .in("id", ids);
    if (stErr) throw new Response(stErr.message, { status: 500 });
    const validSet = new Set((validStudents ?? []).map((s) => s.id));
    const rows = data.marks
      .filter((m) => validSet.has(m.student_id))
      .map((m) => ({
        student_id: m.student_id,
        class_id: data.classId,
        school_id: schoolId,
        date: data.date,
        status: m.status,
      }));
    if (rows.length === 0) throw new Response("No valid students", { status: 400 });
    const { error } = await supabaseAdmin
      .from("attendance_records")
      .upsert(rows, { onConflict: "student_id,date" });
    if (error) throw new Response(error.message, { status: 500 });
    return { saved: rows.length };
  });

const AddStudents = ClassScoped.extend({
  names: z.array(z.string().trim().min(2)).min(1),
});

export const addClassStudents = createServerFn({ method: "POST" })
  .inputValidator((d) => AddStudents.parse(d))
  .handler(async ({ data }) => {
    const { schoolId } = await resolveSchoolId(data.code);
    await assertClassInSchool(data.classId, schoolId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("students")
      .select("roll_number")
      .eq("class_id", data.classId);
    const startRoll = ((existing ?? []).reduce((m, s: any) => Math.max(m, s.roll_number ?? 0), 0)) + 1;
    const rows = data.names.map((full_name, i) => ({
      class_id: data.classId,
      full_name,
      roll_number: startRoll + i,
    }));
    const { error } = await supabaseAdmin.from("students").insert(rows);
    if (error) throw new Response(error.message, { status: 500 });
    return { added: rows.length };
  });