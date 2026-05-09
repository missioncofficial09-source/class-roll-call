import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-auth";

export function AppHeader({ role, name }: { role: AppRole | null; name: string | null }) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-foreground leading-none">Hazira</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Attendance system</div>
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