import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getPublicReport = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, name, grade, school_id, schools(name)")
      .eq("id", data.classId)
      .maybeSingle();
    if (cErr) throw new Response(cErr.message, { status: 500 });
    if (!cls) throw new Response("Class not found", { status: 404 });

    const [{ data: students }, { data: recs }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, roll_number")
        .eq("class_id", data.classId)
        .order("roll_number", { nullsFirst: false })
        .order("full_name"),
      supabaseAdmin
        .from("attendance_records")
        .select("student_id, status")
        .eq("class_id", data.classId)
        .eq("date", data.date),
    ]);

    const statusMap = new Map<string, "present" | "absent">();
    (recs ?? []).forEach((r: any) => statusMap.set(r.student_id, r.status));
    const list = (students ?? []).map((s: any, i: number) => ({
      id: s.id,
      roll: s.roll_number ?? i + 1,
      name: s.full_name,
      status: (statusMap.get(s.id) ?? null) as "present" | "absent" | null,
    }));
    const present = list.filter((s) => s.status === "present").length;
    const absent = list.filter((s) => s.status === "absent").length;
    return {
      className: cls.name as string,
      grade: (cls as any).grade as string | null,
      schoolName: ((cls as any).schools?.name ?? null) as string | null,
      date: data.date,
      present,
      absent,
      total: list.length,
      students: list,
    };
  });