import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/jpeg"),
});

export const extractNamesFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
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