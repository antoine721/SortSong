export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    method: rest.method || (json !== undefined ? "POST" : "GET"),
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && (data.code === "reauth" || data.code === "unauthenticated")) {
      window.location.href = `/login?error=${data.code === "reauth" ? "expired" : ""}`;
    }
    throw new ApiError(res.status, data.error || `Erreur ${res.status}`, data.code);
  }
  return data as T;
}

export function uid() {
  return "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
