const SESSION_KEY = "outofline.session.v1";
const NAME_KEY = "outofline.name.v1";

export interface Session {
  code: string;
  token: string;
  name: string;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or a full quota: reconnect still works in-memory for
    // this tab, it just will not survive a refresh.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadSession(): Session | null {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session>;
    if (
      typeof value.code === "string" &&
      typeof value.token === "string" &&
      typeof value.name === "string" &&
      value.code &&
      value.token
    ) {
      return { code: value.code, token: value.token, name: value.name };
    }
  } catch {
    // Corrupt value: treat as no session.
  }
  return null;
}

export function loadSessionForCode(code: string): Session | null {
  const session = loadSession();
  return session && session.code.toUpperCase() === code.toUpperCase()
    ? session
    : null;
}

export function saveSession(session: Session): void {
  safeSet(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  safeRemove(SESSION_KEY);
}

export function loadName(): string {
  return safeGet(NAME_KEY) || "";
}

export function saveName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) safeSet(NAME_KEY, trimmed);
}
