import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  code: z.string().trim().min(4).max(64),
});

// Normalize: uppercase, strip whitespace and dashes -> "PRN722"
// Then build dashed variant -> "PRN-722"
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
      throw new Response("Use Admin panel for ADM codes", { status: 400 });
    }

    // Case-insensitive match against either dashed or bare form
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, access_code")
      .or(`access_code.ilike.${variants.dashed},access_code.ilike.${variants.bare}`)
      .maybeSingle();
    if (pErr) throw new Response(pErr.message, { status: 500 });
    if (!profile) throw new Response("Invalid access code", { status: 401 });

    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (uErr || !userRes?.user?.email) {
      throw new Response("User account not found", { status: 404 });
    }
    const email = userRes.user.email;

    const { data: linkRes, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !linkRes?.properties?.hashed_token) {
      throw new Response(lErr?.message ?? "Could not issue session", { status: 500 });
    }

    return {
      email,
      tokenHash: linkRes.properties.hashed_token,
    };
  });
