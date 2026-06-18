import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logoDefault from "@/assets/logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hazira — School attendance" },
      { name: "description", content: "Daily attendance for principals and teachers." },
    ],
  }),
  component: Index,
});

function Index() {
  const { loading, isAuthed, role, accessCode } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !isAuthed) return;
    // Prefer access-code prefix routing (ADM-/PRN-/TCH-), fall back to role.
    const code = (accessCode ?? "").toUpperCase();
    const dest =
      code.startsWith("ADM-") || role === "admin" ? "/admin" :
      code.startsWith("PRN-") || role === "principal" ? "/principal" :
      "/attendance";
    navigate({ to: dest });
  }, [loading, isAuthed, role, accessCode, navigate]);

  const tiles = [
    {
      to: "/admin-panel",
      icon: ShieldCheck,
      title: "Admin",
      desc: "Manage schools & access",
      badge: "ADM-",
      tone: "bg-primary/10 text-primary",
    },
    {
      to: "/login",
      icon: GraduationCap,
      title: "Principal",
      desc: "School overview & reports",
      badge: "PRN-",
      tone: "bg-accent/10 text-accent-foreground",
    },
    {
      to: "/login",
      icon: Users,
      title: "Teacher",
      desc: "Mark today's register",
      badge: "TCH-",
      tone: "bg-success/10 text-success",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border/60">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <img src={logoDefault} alt="Hazira" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-semibold tracking-tight">Hazira</span>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">Multi-school attendance · B2B</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Secure portal
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Sign in to Hazira</h1>
          <p className="mt-4 text-muted-foreground">
            Choose your role. Your access code prefix (<span className="font-mono">ADM-</span>,{" "}
            <span className="font-mono">PRN-</span>, <span className="font-mono">TCH-</span>) routes you to the right panel.
          </p>
        </div>

        <div className="w-full max-w-4xl grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              className="group rounded-2xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition-all"
            >
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${t.tone}`}>
                <t.icon className="h-6 w-6" />
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-lg font-semibold">{t.title}</div>
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {t.badge}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
              <div className="mt-5 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="px-6 py-5 border-t border-border/60 text-center text-xs text-muted-foreground">
        © Hazira · Strict per-school data isolation
      </footer>
    </div>
  );
}
