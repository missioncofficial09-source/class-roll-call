import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Coins, Wallet, Gift } from "lucide-react";
import { toast } from "sonner";

const MIN_REDEEM = 5000;
const formatInr = (coins: number) => `₹${(coins / 100).toFixed(2)}`;

type Redemption = { id: string; coins: number; amount_inr: string | number; status: string; created_at: string };

export function WalletCard({ userId }: { userId: string }) {
  const [balance, setBalance] = useState(0);
  const [recent, setRecent] = useState<Redemption[]>([]);
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState(MIN_REDEEM);
  const [upi, setUpi] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from("wallets").select("balance").eq("teacher_id", userId).maybeSingle(),
      supabase.from("redemptions").select("id, coins, amount_inr, status, created_at").eq("teacher_id", userId).order("created_at", { ascending: false }).limit(3),
    ]);
    setBalance(w?.balance ?? 0);
    setRecent((r as Redemption[]) ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`wallet-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `teacher_id=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "redemptions", filter: `teacher_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId]);

  const canRedeem = balance >= MIN_REDEEM;

  const submit = async () => {
    if (coins < MIN_REDEEM) return toast.error(`Minimum ${MIN_REDEEM} coins (${formatInr(MIN_REDEEM)})`);
    if (coins > balance) return toast.error("Not enough coins");
    if (!upi.trim()) return toast.error("Enter your UPI id");
    setSubmitting(true);
    const { error } = await supabase.from("redemptions").insert({
      teacher_id: userId,
      coins,
      amount_inr: coins / 100,
      upi_id: upi.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Redemption requested");
    setOpen(false);
    setUpi("");
  };

  return (
    <div className="rounded-2xl border border-border p-4 mb-5" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet balance</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{balance.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> coins</span>
            <span className="text-sm text-success font-semibold">≈ {formatInr(balance)}</span>
          </div>
        </div>
        <Button size="sm" disabled={!canRedeem} onClick={() => { setCoins(Math.min(balance, Math.max(MIN_REDEEM, balance))); setOpen(true); }}>
          <Gift className="h-4 w-4 mr-1.5" /> Redeem
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground mt-2">
        Earn 1 coin per student marked. 100 coins = ₹1. Minimum {MIN_REDEEM.toLocaleString()} coins ({formatInr(MIN_REDEEM)}) to redeem.
      </div>
      {recent.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          {recent.map((r) => (
            <div key={r.id} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.coins.toLocaleString()} coins</span>
              <span className={`font-semibold ${r.status === "paid" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem coins</DialogTitle>
            <DialogDescription>100 coins = ₹1. Your balance: {balance.toLocaleString()} coins ({formatInr(balance)}).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Coins to redeem</label>
              <Input type="number" min={MIN_REDEEM} max={balance} step={100} value={coins} onChange={(e) => setCoins(parseInt(e.target.value || "0", 10))} />
              <div className="text-xs text-success mt-1">= {formatInr(coins)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">UPI id for payout</label>
              <Input placeholder="yourname@upi" value={upi} onChange={(e) => setUpi(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Request payout"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
