
CREATE TABLE public.school_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX school_teachers_school_idx ON public.school_teachers(school_id);
CREATE INDEX school_teachers_class_idx ON public.school_teachers(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_teachers TO authenticated;
GRANT ALL ON public.school_teachers TO service_role;

ALTER TABLE public.school_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all teachers"
  ON public.school_teachers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Same-school authenticated users read teachers"
  ON public.school_teachers FOR SELECT
  TO authenticated
  USING (school_id = public.user_school_id(auth.uid()));
