import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  code: z.string().trim().min(4).max(64),
});

export const signInWithAccessCode = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const code = data.code.trim();
    const upper = code.toUpperCase();
    if (!upper.startsWith("PRN-") && !upper.startsWith("TCH-")) {
      throw new Response("Use Admin panel for ADM- codes", { status: 400 });
    }

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("access_code", code)
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