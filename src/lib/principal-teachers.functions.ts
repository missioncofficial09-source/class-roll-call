import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Validate the caller's PRN code and return their school_id.
async function resolvePrincipalSchool(rawCode: string): Promise<string> {
  const cleaned = rawCode.replace(/[\s-]+/g, "").toUpperCase();
  const m = cleaned.match(/^PRN(.+)$/);
  if (!m) throw new Response("Principal code required", { status: 403 });
  const suffix = m[1];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: school, error } = await supabaseAdmin
    .from("schools")
    .select("id, is_active")
    .or(`code.ilike.PRN-${suffix},code.ilike.PRN${suffix}`)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  if (!school) throw new Response("Principal code not found", { status: 401 });
  if (school.is_active === false) throw new Response("School disabled", { status: 403 });
  return school.id as string;
}

function normalizeTeacherCode(raw: string): { dashed: string; bare: string; suffix: string } {
  const cleaned = raw.replace(/[\s-]+/g, "").toUpperCase();
  let suffix = cleaned;
  if (cleaned.startsWith("TCH")) suffix = cleaned.slice(3);
  if (!suffix) throw new Response("Teacher code required", { status: 400 });
  return { dashed: `TCH-${suffix}`, bare: `TCH${suffix}`, suffix };
}

const CodeOnly = z.object({ code: z.string().trim().min(3).max(64) });

// Find an existing class in this school by case-insensitive name, or create one.
async function resolveClassByName(schoolId: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  if (!name) throw new Response("Class name required", { status: 400 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing, error: findErr } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .ilike("name", name)
    .maybeSingle();
  if (findErr) throw new Response(findErr.message, { status: 500 });
  if (existing) return existing.id as string;
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("classes")
    .insert({ school_id: schoolId, name })
    .select("id")
    .single();
  if (insErr) throw new Response(insErr.message, { status: 500 });
  return inserted.id as string;
}

export const listSchoolTeachers = createServerFn({ method: "POST" })
  .inputValidator((d) => CodeOnly.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("school_teachers")
      .select("id, full_name, code, class_id, is_active, created_at, classes(name, grade)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

const CreateTeacher = CodeOnly.extend({
  fullName: z.string().trim().min(2).max(120),
  teacherCode: z.string().trim().min(1).max(32),
  className: z.string().trim().max(120).nullable().optional(),
});

export const createSchoolTeacher = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateTeacher.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const classId = data.className && data.className.trim()
      ? await resolveClassByName(schoolId, data.className)
      : null;

    const { dashed, bare } = normalizeTeacherCode(data.teacherCode);

    // Reject if dashed or bare collides with any existing school or teacher code.
    const [{ data: schoolHit }, { data: teacherHit }] = await Promise.all([
      supabaseAdmin.from("schools").select("id")
        .or(`code.ilike.${dashed},code.ilike.${bare}`).maybeSingle(),
      supabaseAdmin.from("school_teachers").select("id")
        .or(`code.ilike.${dashed},code.ilike.${bare}`).maybeSingle(),
    ]);
    if (schoolHit || teacherHit) throw new Response("This code is already in use", { status: 409 });

    const { data: inserted, error } = await supabaseAdmin
      .from("school_teachers")
      .insert({
        school_id: schoolId,
        class_id: classId,
        full_name: data.fullName,
        code: dashed,
      })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: inserted.id, code: dashed };
  });

const UpdateTeacher = CodeOnly.extend({
  teacherId: z.string().uuid(),
  className: z.string().trim().max(120).nullable().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const updateSchoolTeacher = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateTeacher.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      updated_at: string;
      class_id?: string | null;
      full_name?: string;
      is_active?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (data.className !== undefined) {
      patch.class_id = data.className && data.className.trim()
        ? await resolveClassByName(schoolId, data.className)
        : null;
    }
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { error } = await supabaseAdmin
      .from("school_teachers")
      .update(patch)
      .eq("id", data.teacherId)
      .eq("school_id", schoolId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

const RemoveTeacher = CodeOnly.extend({ teacherId: z.string().uuid() });

export const deleteSchoolTeacher = createServerFn({ method: "POST" })
  .inputValidator((d) => RemoveTeacher.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("school_teachers")
      .delete()
      .eq("id", data.teacherId)
      .eq("school_id", schoolId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

export const listSchoolClassesForPrincipal = createServerFn({ method: "POST" })
  .inputValidator((d) => CodeOnly.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, grade")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const getPrincipalDashboard = createServerFn({ method: "POST" })
  .inputValidator((d) => CodeOnly.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const [c, a] = await Promise.all([
      supabaseAdmin
        .from("classes")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .order("name"),
      supabaseAdmin
        .from("attendance_records")
        .select("student_id, class_id, status")
        .eq("school_id", schoolId)
        .eq("date", today),
    ]);
    if (c.error) throw new Response(c.error.message, { status: 500 });
    if (a.error) throw new Response(a.error.message, { status: 500 });
    const classes = c.data ?? [];
    const classIds = classes.map((x) => x.id as string);
    let students: Array<{ id: string; full_name: string; roll_number: number | null; class_id: string }> = [];
    if (classIds.length) {
      const { data: st, error: sErr } = await supabaseAdmin
        .from("students")
        .select("id, full_name, roll_number, class_id")
        .in("class_id", classIds)
        .order("full_name");
      if (sErr) throw new Response(sErr.message, { status: 500 });
      students = st ?? [];
    }
    return { schoolId, today, classes, students, attendance: a.data ?? [] };
  });
