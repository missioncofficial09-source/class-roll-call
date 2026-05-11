## Hazira System Upgrade — Implementation Plan

A large, multi-area upgrade. I'll break it into phases and confirm a few decisions before coding.

---

### Phase 1 — Branding & Logo
- Copy your uploaded `logo_mi.jpeg` into `src/assets/logo.jpeg` and use it as the app icon in:
  - `AppHeader` (replace the gradient "GraduationCap" tile)
  - `favicon` (public/favicon.ico replacement)
  - Login & Signup pages
- Add a `school_logo_url` column to `schools` table, plus a Storage bucket `school-logos` (public read, admin write). Admin can upload a per-school logo from the Admin dashboard. Headers display the school's logo when set, otherwise fall back to the default Hazira logo.

### Phase 2 — Smart RBAC & Redirects
- Add `'principal'` to the `app_role` enum.
- New helper `get_primary_role(_user_id)` returns highest role.
- On sign-in, redirect:
  - admin → `/admin`
  - principal → `/principal`
  - teacher → `/attendance`
- Update `_authenticated` layout & login flow to perform the redirect using `useAuth().role`.

### Phase 3 — Principal Dashboard (`/principal`)
New route `src/routes/_authenticated/principal.tsx` with:
- School-wide stats: total students, total teachers, total classes
- Today's attendance %: present / absent / not-yet-marked
- Per-class breakdown (table)
- Trend chart: last 30 days attendance % (recharts)
- Top/bottom attendance students this month
- Live updates via Supabase Realtime on `attendance_records` filtered by `school_id`

### Phase 4 — Realtime Engine
- Enable `ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;` and `REPLICA IDENTITY FULL`.
- Principal dashboard subscribes to inserts/updates and refetches affected aggregates.

### Phase 5 — Multi-tenant RLS hardening
- Audit existing policies — already use `user_school_id(auth.uid())`. Add:
  - `students` school_id derived check (currently via `classes` join — keep but add index)
  - Indexes: `attendance_records (school_id, date)`, `students (class_id)`, `classes (school_id)`
- Add a check trigger ensuring `attendance_records.school_id = classes.school_id` on insert.

### Phase 6 — Storage retention (1.5 years)
- Add `created_at` retention policy: a daily pg_cron job deletes `attendance_records` older than 18 months. (Documented; cron requires the user to enable pg_cron — I'll provide the SQL.)

### Phase 7 — Monthly Progress Reports
- New table `monthly_reports (id, student_id, school_id, month, present_days, absent_days, attendance_pct, behavior_notes, academic_notes, generated_at)`.
- New table `teacher_notes (id, student_id, teacher_id, kind ['behavior'|'academic'], note, created_at)` so teachers can add notes any time.
- Edge function `generate-monthly-reports` (callable manually, plus scheduled via pg_cron on the 1st of each month) that aggregates last month's attendance + notes per student and inserts into `monthly_reports`.
- Principal dashboard tab "Monthly Reports" lists/exports them.
- Parent delivery: a "Send to WhatsApp" button per student-report that opens `wa.me/<parent_phone>?text=<report>` (same direct-link approach already used for daily reports). Requires a `parent_phone` column on `students` — I'll add it.

---

### Questions before I start

I'd like to confirm a few decisions so I can build the right thing in one pass.