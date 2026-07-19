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
  const isFormData = options?.body instanceof FormData;
  const headers = new Headers(options?.headers);
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  } else if (isFormData) {
    // Let the browser set the Content-Type automatically for FormData to include the boundary
    headers.delete('Content-Type');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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
  postForm: <T>(path: string, body: FormData) => apiFetch<T>(path, {
    method: 'POST',
    body,
  }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
