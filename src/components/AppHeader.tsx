import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-auth";
import logoDefault from "@/assets/logo.jpeg";

export function AppHeader({
  role,
  name,
  schoolName,
  schoolLogoUrl,
}: {
  role: AppRole | null;
  name: string | null;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
}) {
  const navigate = useNavigate();
  const logoSrc = schoolLogoUrl || logoDefault;
  const brandTitle = schoolName || "Hazira";
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logoSrc}
            alt={`${brandTitle} logo`}
            className="h-9 w-9 rounded-xl object-cover"
          />
          <div>
            <div className="font-semibold tracking-tight text-foreground leading-none">{brandTitle}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {schoolName ? "Hazira attendance" : "Attendance system"}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {role && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">{name ?? "User"}</span>
              <span className="text-[11px] uppercase tracking-wider text-accent font-semibold">{role}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}