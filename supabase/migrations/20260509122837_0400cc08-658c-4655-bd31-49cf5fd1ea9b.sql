CREATE POLICY "Teachers insert students into assigned classes"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.teacher_has_class(auth.uid(), class_id)
);