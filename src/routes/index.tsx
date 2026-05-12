import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, Users } from "lucide-react";
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
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !session) return;
    const dest =
      role === "admin" ? "/admin" :
      role === "principal" ? "/principal" :
      "/attendance";
    navigate({ to: dest });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-3 mb-10">
          <img src={logoDefault} alt="Hazira" className="h-14 w-14 rounded-2xl object-cover shadow-md" />
          <div>
            <div className="text-3xl font-bold tracking-tight">Hazira</div>
            <div className="text-sm text-muted-foreground">School attendance system</div>
          </div>
        </div>

        <div className="w-full max-w-md grid gap-4">
          <Link
            to="/login"
            search={{ as: "principal" } as never}
            className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold">Principal Login</div>
              <div className="text-sm text-muted-foreground">School-wide overview & reports</div>
            </div>
          </Link>

          <Link
            to="/login"
            search={{ as: "teacher" } as never}
            className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="h-14 w-14 rounded-xl bg-success/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-success" />
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold">Teacher Login</div>
              <div className="text-sm text-muted-foreground">Mark today's class register</div>
            </div>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-10">© Hazira</p>
      </div>
    </div>
  );
}
