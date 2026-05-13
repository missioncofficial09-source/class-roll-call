import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoDefault from "@/assets/logo.jpeg";
import { signInWithAccessCode } from "@/lib/code-login.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Hazira" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const codeSignIn = useServerFn(signInWithAccessCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("ADM-")) {
      toast.error("Admin codes use the Admin panel");
      navigate({ to: "/admin-panel" });
      return;
    }
    if (!upper.startsWith("PRN-") && !upper.startsWith("TCH-")) {
      toast.error("Code must start with PRN- or TCH-");
      return;
    }
    setLoading(true);
    try {
      const { email, tokenHash } = await codeSignIn({ data: { code: trimmed } });
      const { error } = await supabase.auth.verifyOtp({
        email,
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) throw new Error(error.message);
      toast.success("Welcome back");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <Link to="/" className="flex items-center gap-2">
          <img src={logoDefault} alt="Hazira logo" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-semibold">Hazira</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">A simpler register.</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-sm">One screen. 30 names. Two taps. Send to WhatsApp.</p>
        </div>
        <div className="text-xs text-primary-foreground/60">© Hazira • Multi-school attendance</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your access code. Principals start with <span className="font-mono">PRN-</span>, teachers with{" "}
            <span className="font-mono">TCH-</span>.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="code">Access code</Label>
              <Input
                id="code"
                autoFocus
                required
                placeholder="PRN-XXXX or TCH-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1.5 font-mono tracking-wide"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base">
              {loading ? "Signing in…" : "Continue"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Admin? <Link to="/admin-panel" className="underline">Open admin panel</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}