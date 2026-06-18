export type CodeSession = {
  schoolId: string;
  schoolName: string | null;
  code: string;
  role: "principal" | "teacher";
};

const KEY = "hazira_code_session";

export function saveCodeSession(s: CodeSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("hazira:code-session"));
}

export function loadCodeSession(): CodeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as CodeSession;
    if (!v?.schoolId || !v?.role) return null;
    return v;
  } catch {
    return null;
  }
}

export function clearCodeSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("hazira:code-session"));
}