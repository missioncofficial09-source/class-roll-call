
-- 1. Add 'principal' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal';

-- 2. Schools: logo_url
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url text;

-- 3. Students: parent_phone (E.164-ish, stored as text)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone text;

-- 4. Storage bucket for school logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for school-logos bucket
DROP POLICY IF EXISTS "School logos are publicly readable" ON storage.objects;
CREATE POLICY "School logos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "Admins manage school logos" ON storage.objects;
CREATE POLICY "Admins manage school logos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'school-logos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'school-logos' AND public.has_role(auth.uid(), 'admin'));

-- 5. Teacher notes
CREATE TABLE IF NOT EXISTS public.teacher_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('behavior','academic')),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers insert notes for their school" ON public.teacher_notes;
CREATE POLICY "Teachers insert notes for their school"
  ON public.teacher_notes FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id = public.user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "View notes in own school" ON public.teacher_notes;
CREATE POLICY "View notes in own school"
  ON public.teacher_notes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR school_id = public.user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage notes" ON public.teacher_notes;
CREATE POLICY "Admins manage notes"
  ON public.teacher_notes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_teacher_notes_student ON public.teacher_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_school ON public.teacher_notes(school_id, created_at DESC);

-- 6. Monthly reports
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  month date NOT NULL, -- first day of the report month
  present_days int NOT NULL DEFAULT 0,
  absent_days int NOT NULL DEFAULT 0,
  attendance_pct numeric(5,2) NOT NULL DEFAULT 0,
  behavior_notes text,
  academic_notes text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, month)
);
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View reports in own school" ON public.monthly_reports;
CREATE POLICY "View reports in own school"
  ON public.monthly_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR school_id = public.user_school_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage reports" ON public.monthly_reports;
CREATE POLICY "Admins manage reports"
  ON public.monthly_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_monthly_reports_school_month ON public.monthly_reports(school_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_student ON public.monthly_reports(student_id, month DESC);

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON public.attendance_records(school_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance_records(class_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance_records(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes(school_id);

-- 8. Realtime: ensure attendance_records publishes full rows
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records';
  END IF;
END $$;

-- 9. 18-month retention via pg_cron (best-effort: enable extension if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('hazira-attendance-retention');
EXCEPTION WHEN OTHERS THEN
  -- job doesn't exist yet
  NULL;
END $$;

SELECT cron.schedule(
  'hazira-attendance-retention',
  '0 3 * * *',
  $$ DELETE FROM public.attendance_records WHERE date < (CURRENT_DATE - INTERVAL '18 months'); $$
);
