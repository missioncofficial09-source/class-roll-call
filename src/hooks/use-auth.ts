import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { loadCodeSession, clearCodeSession, type CodeSession } from "@/lib/code-session";

export type AppRole = "admin" | "principal" | "teacher";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  schoolId: string | null;
  fullName: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  accessCode: string | null;
  isAuthed: boolean;
  codeSession: CodeSession | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeSession, setCodeSession] = useState<CodeSession | null>(null);

  const loadProfile = async (uid: string) => {
    const [{ data: roleRow }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).order("role").maybeSingle(),
      supabase.from("profiles").select("school_id, full_name, access_code").eq("id", uid).maybeSingle(),
    ]);
    setRole((roleRow?.role as AppRole) ?? null);
    setSchoolId(profile?.school_id ?? null);
    setFullName(profile?.full_name ?? null);
    setAccessCode((profile as any)?.access_code ?? null);
    if (profile?.school_id) {
      const { data: school } = await supabase
        .from("schools")
        .select("name, logo_url")
        .eq("id", profile.school_id)
        .maybeSingle();
      setSchoolName((school as any)?.name ?? null);
      setSchoolLogoUrl((school as any)?.logo_url ?? null);
    } else {
      setSchoolName(null);
      setSchoolLogoUrl(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => void loadProfile(s.user.id), 0);
      } else {
        setRole(null);
        setSchoolId(null);
        setFullName(null);
        setSchoolName(null);
        setSchoolLogoUrl(null);
        setAccessCode(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    // Code-based (localStorage) session
    const syncCode = () => setCodeSession(loadCodeSession());
    syncCode();
    window.addEventListener("hazira:code-session", syncCode);
    window.addEventListener("storage", syncCode);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("hazira:code-session", syncCode);
      window.removeEventListener("storage", syncCode);
    };
  }, []);

  // Code session overrides when no supabase session
  const effRole = (session ? role : codeSession?.role) ?? null;
  const effSchoolId = (session ? schoolId : codeSession?.schoolId) ?? null;
  const effSchoolName = (session ? schoolName : codeSession?.schoolName) ?? null;
  const effAccessCode = (session ? accessCode : codeSession?.code) ?? null;
  const effFullName = (session ? fullName : codeSession ? `${codeSession.role === "principal" ? "Principal" : "Teacher"}` : null);
  const isAuthed = !!session || !!codeSession;

  return {
    loading,
    session,
    user: session?.user ?? null,
    role: effRole,
    schoolId: effSchoolId,
    fullName: effFullName,
    schoolName: effSchoolName,
    schoolLogoUrl,
    accessCode: effAccessCode,
    isAuthed,
    codeSession,
    signOut: async () => {
      clearCodeSession();
      setCodeSession(null);
      if (session) await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
      setCodeSession(loadCodeSession());
    },
  };
}