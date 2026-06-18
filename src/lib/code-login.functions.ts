import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  code: z.string().trim().min(3).max(64),
});

function normalizeVariants(raw: string): { dashed: string; bare: string; prefix: string } | null {
  const cleaned = raw.replace(/[\s-]+/g, "").toUpperCase();
  const m = cleaned.match(/^(ADM|PRN|TCH)(.+)$/);
  if (!m) return null;
  const prefix = m[1];
  const rest = m[2];
  return { bare: `${prefix}${rest}`, dashed: `${prefix}-${rest}`, prefix };
}

export const signInWithAccessCode = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const variants = normalizeVariants(data.code);
    if (!variants) {
      throw new Response("Invalid access code format", { status: 400 });
    }
    if (variants.prefix === "ADM") {
      throw new Response("Use the Admin panel for ADM codes", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve to the school. Each school is identified by its PRN-<suffix> code.
    // A TCH-<suffix> code maps to the SAME school as PRN-<suffix> so teachers
    // inherit the principal's school_id automatically.
    const suffix = variants.dashed.split("-")[1] ?? "";
    const principalDashed = `PRN-${suffix}`;
    const principalBare = `PRN${suffix}`;
    const { data: school, error: sErr } = await supabaseAdmin
      .from("schools")
      .select("id, name, code, is_active")
      .or(
        `code.ilike.${principalDashed},code.ilike.${principalBare},code.ilike.${variants.dashed},code.ilike.${variants.bare}`,
      )
      .maybeSingle();
    if (sErr) throw new Response(sErr.message, { status: 500 });
    if (!school) throw new Response("Access code not found", { status: 401 });
    if (school.is_active === false) {
      throw new Response("This school is disabled. Contact your admin.", { status: 403 });
    }

    const role: "principal" | "teacher" = variants.prefix === "PRN" ? "principal" : "teacher";
    return {
      schoolId: school.id as string,
      schoolName: (school.name as string) ?? null,
      code: (school.code as string) ?? variants.dashed,
      role,
    };
  });