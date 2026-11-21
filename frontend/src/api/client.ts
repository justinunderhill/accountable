/** An error from the API, with the message to show and, for a 422, a message per field. */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    const errors = body.errors;
    this.fieldErrors =
      errors && typeof errors === "object" ? Object.fromEntries(Object.entries(errors as Record<string, string>)) : {};
  }
}

const FALLBACK = "Something went wrong. Please try again.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Accountable's server isn't answering. Check that it's still running.");
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const detail = typeof payload.detail === "string" ? payload.detail : FALLBACK;
    throw new ApiError(response.status, detail, payload);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};
