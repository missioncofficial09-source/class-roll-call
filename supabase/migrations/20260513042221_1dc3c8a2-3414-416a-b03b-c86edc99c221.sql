ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_access_code_uniq ON public.profiles(access_code) WHERE access_code IS NOT NULL;