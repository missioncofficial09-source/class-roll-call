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
