// Base API client — all backend requests go through here

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ApiError {
  status: number;
  message: string;
  path: string;
}

function makeApiError(status: number, message: string, path: string): ApiError & { name: string } {
  return { status, message, path, name: 'ApiError' };
}


export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch { /* ignore */ }
    throw makeApiError(res.status, detail, path);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
