import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { HttpError } from "./http-error";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text || res.statusText;
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data.message || data.error || message;
      } catch {
        // keep message as text
      }
    }
    throw new HttpError(res.status, message);
  }
}

export async function apiRequest(
  method: string = "GET",
  url: string,
  body?: unknown,
): Promise<any> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !url.includes("/auth/login")) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  await throwIfResNotOk(res);
  const raw = await res.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn =
  ({ on401 }: { on401: UnauthorizedBehavior }): QueryFunction =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (on401 === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    const raw = await res.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false,
      retry: false,
      throwOnError: (error) => {
        if (error instanceof HttpError) {
          return error.status === 403 || error.status >= 500;
        }
        return true;
      },
    },
  },
});
