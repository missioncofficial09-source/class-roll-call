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
  classId: z.string().uuid().nullable().optional(),
});

export const createSchoolTeacher = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateTeacher.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.classId) {
      const { data: cls, error: cErr } = await supabaseAdmin
        .from("classes").select("id, school_id").eq("id", data.classId).maybeSingle();
      if (cErr) throw new Response(cErr.message, { status: 500 });
      if (!cls || cls.school_id !== schoolId)
        throw new Response("Class does not belong to your school", { status: 403 });
    }

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
        class_id: data.classId ?? null,
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
  classId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export const updateSchoolTeacher = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateTeacher.parse(d))
  .handler(async ({ data }) => {
    const schoolId = await resolvePrincipalSchool(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.classId) {
      const { data: cls } = await supabaseAdmin
        .from("classes").select("id, school_id").eq("id", data.classId).maybeSingle();
      if (!cls || cls.school_id !== schoolId)
        throw new Response("Class does not belong to your school", { status: 403 });
    }
    const patch: {
      updated_at: string;
      class_id?: string | null;
      full_name?: string;
      is_active?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (data.classId !== undefined) patch.class_id = data.classId;
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
