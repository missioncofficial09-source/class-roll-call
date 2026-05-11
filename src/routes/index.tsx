import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GraduationCap, CheckCircle2, ShieldCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hazira — Multi-school attendance for teachers" },
      { name: "description", content: "Mark daily attendance for 30+ students per class, share results to WhatsApp, and let principals see live numbers across every school." },
    ],
  }),
  component: Index,
});

function Index() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (session) {
      const dest =
        role === "admin" ? "/admin" :
        role === "principal" ? "/principal" :
        "/attendance";
      navigate({ to: dest });
    }
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28 text-center text-primary-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium mb-6">
            <GraduationCap className="h-3.5 w-3.5" /> 50 schools • One dashboard
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Daily attendance,<br />done in 30 seconds.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-primary-foreground/80 max-w-xl mx-auto">
            Tap green for present, red for absent. Send the summary straight to your class WhatsApp group.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" variant="secondary" className="shadow-lg">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-white/30 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-16 grid sm:grid-cols-3 gap-6">
        {[
          { icon: CheckCircle2, title: "One‑tap marking", body: "Green check or red cross — that's it. Designed for 30 students at once." },
          { icon: MessageCircle, title: "WhatsApp ready", body: "Auto‑formatted summary opens directly in your class group chat." },
          { icon: ShieldCheck, title: "School‑scoped", body: "Teachers only see their own class. Principals see everything." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border p-6 shadow-sm" style={{ background: "var(--gradient-card)" }}>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
