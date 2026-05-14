import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MASTER_PASSWORD = "MissionC2026@gmail.com!";
const STORAGE_KEY = "hazira:admin-unlocked";

export const Route = createFileRoute("/admin-panel")({
  head: () => ({ meta: [{ title: "Admin — Hazira" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPanelGate,
});

function AdminPanelGate() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      navigate({ to: "/admin" });
    }
  }, [navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== MASTER_PASSWORD) { toast.error("Incorrect master password"); return; }
    sessionStorage.setItem(STORAGE_KEY, "1");
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Admin access</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Enter the master password to continue.</p>
        <Label htmlFor="mp">Master password</Label>
        <Input id="mp" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5" />
        <Button type="submit" className="w-full mt-5">Unlock</Button>
      </form>
    </div>
  );
}
