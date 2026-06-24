import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const InputSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/jpeg"),
  accessToken: z.string().min(10).optional(),
  code: z.string().min(3).optional(),
});

export const extractNamesFromImage = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    // Verify the caller is a signed-in user (gateway uses our server-side key,
    // so we gate access via their Supabase session token).
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Response("Backend not configured", { status: 500 });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let authorized = false;
    if (data.accessToken) {
      const { data: claims, error: authErr } = await sb.auth.getClaims(data.accessToken);
      if (!authErr && claims?.claims?.sub) authorized = true;
    }
    if (!authorized && data.code) {
      const code = data.code.trim().toUpperCase();
      if (code.startsWith("TCH-")) {
        const { data: row } = await sb
          .from("school_teachers")
          .select("id")
          .ilike("code", code)
          .eq("is_active", true)
          .maybeSingle();
        if (row?.id) authorized = true;
      } else if (code.startsWith("PRN-")) {
        const { data: row } = await sb
          .from("schools")
          .select("id")
          .ilike("code", code)
          .maybeSingle();
        if (row?.id) authorized = true;
      }
    }
    if (!authorized) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Response("AI gateway not configured", { status: 500 });
    }

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You extract student names from a photo of a school attendance register. Return ONLY a JSON object with a 'names' array of strings — full names exactly as written, in the order they appear, no roll numbers, no duplicates, no commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all student names from this register image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Response("Rate limit reached. Please try again in a moment.", { status: 429 });
    if (res.status === 402) throw new Response("AI credits exhausted. Add credits in Workspace settings.", { status: 402 });
    if (!res.ok) {
      const txt = await res.text();
      throw new Response(`AI extraction failed: ${txt.slice(0, 200)}`, { status: 500 });
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { names?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    const names = Array.isArray(parsed.names)
      ? parsed.names
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .filter((n) => n.length > 1 && n.length < 120)
      : [];

    // Dedupe (case-insensitive)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of names) {
      const k = n.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(n);
      }
    }
    return { names: unique };
  });