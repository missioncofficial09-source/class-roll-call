import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listSchools = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, code, is_active")
    .order("name");
  if (error) throw new Error(error.message);
  return { schools: data ?? [] };
});

export const addSchool = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(200),
      code: z.string().max(50).optional().nullable(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("schools").insert({
      name: data.name,
      code: data.code?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSchool = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("schools")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchool = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSchoolDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: school, error: sErr } = await supabaseAdmin
      .from("schools")
      .select("id, name, code, is_active, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!school) throw new Error("School not found");

    const { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, name, grade")
      .eq("school_id", data.id);
    if (cErr) throw new Error(cErr.message);

    const classIds = (classes ?? []).map((c) => c.id);
    let studentCount = 0;
    if (classIds.length > 0) {
      const { count, error: stErr } = await supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds);
      if (stErr) throw new Error(stErr.message);
      studentCount = count ?? 0;
    }

    const { count: teacherCount, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", data.id);
    if (tErr) throw new Error(tErr.message);

    const today = new Date().toISOString().slice(0, 10);
    const { count: todayAttendance } = await supabaseAdmin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("school_id", data.id)
      .eq("date", today);

    return {
      school,
      classCount: classes?.length ?? 0,
      classes: classes ?? [],
      studentCount,
      teacherCount: teacherCount ?? 0,
      todayAttendance: todayAttendance ?? 0,
    };
  });
