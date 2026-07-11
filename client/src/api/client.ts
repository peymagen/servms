const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  total?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isFormData = false
): Promise<T> {
  const token = localStorage.getItem("servms_token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = (await res.json().catch(() => ({}))) as Partial<Envelope<T>> & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    const message = body.message ?? body.error ?? "Request failed";
    throw new ApiError(message, res.status);
  }

  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, isFormData = false) =>
    request<T>(
      path,
      {
        method: "POST",
        body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      },
      isFormData
    ),
  patch: <T>(path: string, body?: unknown, isFormData = false) =>
    request<T>(
      path,
      {
        method: "PATCH",
        body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      },
      isFormData
    ),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const ASSET_BASE = API_BASE.replace(/\/api$/, "");
