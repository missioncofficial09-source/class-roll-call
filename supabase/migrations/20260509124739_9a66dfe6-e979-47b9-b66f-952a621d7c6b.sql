
-- Wallets
CREATE TABLE public.wallets (
  teacher_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Transactions
CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_coin_tx_teacher ON public.coin_transactions(teacher_id, created_at DESC);

CREATE POLICY "Teachers view own transactions" ON public.coin_transactions FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage transactions" ON public.coin_transactions FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Redemption status enum
CREATE TYPE public.redemption_status AS ENUM ('pending','approved','paid','rejected');

-- Redemptions
CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  coins integer NOT NULL CHECK (coins >= 5000),
  amount_inr numeric(10,2) NOT NULL,
  upi_id text,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_redemptions_teacher ON public.redemptions(teacher_id, created_at DESC);

CREATE POLICY "Teachers view own redemptions" ON public.redemptions FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE POLICY "Teachers create own redemption" ON public.redemptions FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND status = 'pending'
    AND coins >= 5000
    AND amount_inr = (coins::numeric / 100)
    AND EXISTS (SELECT 1 FROM public.wallets w WHERE w.teacher_id = auth.uid() AND w.balance >= coins)
  );

CREATE POLICY "Admins manage redemptions" ON public.redemptions FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Credit trigger: 1 coin per attendance record inserted
CREATE OR REPLACE FUNCTION public.credit_attendance_coins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.recorded_by IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.wallets(teacher_id, balance, updated_at)
    VALUES (NEW.recorded_by, 1, now())
    ON CONFLICT (teacher_id) DO UPDATE SET balance = wallets.balance + 1, updated_at = now();
  INSERT INTO public.coin_transactions(teacher_id, delta, reason)
    VALUES (NEW.recorded_by, 1, 'attendance:' || NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER attendance_credit_coins
AFTER INSERT ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.credit_attendance_coins();

-- Debit trigger when admin marks redemption as approved/paid (debits on approval; rejection refunds nothing because nothing was taken)
-- Simpler model: deduct on INSERT (pending) and refund on rejection
CREATE OR REPLACE FUNCTION public.handle_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wallets SET balance = balance - NEW.coins, updated_at = now()
      WHERE teacher_id = NEW.teacher_id AND balance >= NEW.coins;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    INSERT INTO public.coin_transactions(teacher_id, delta, reason)
      VALUES (NEW.teacher_id, -NEW.coins, 'redemption:' || NEW.id::text);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'rejected' AND NEW.status = 'rejected' THEN
    UPDATE public.wallets SET balance = balance + OLD.coins, updated_at = now()
      WHERE teacher_id = OLD.teacher_id;
    INSERT INTO public.coin_transactions(teacher_id, delta, reason)
      VALUES (OLD.teacher_id, OLD.coins, 'refund:' || OLD.id::text);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER redemption_balance
BEFORE INSERT ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.handle_redemption();

CREATE TRIGGER redemption_status_change
AFTER UPDATE OF status ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.handle_redemption();
