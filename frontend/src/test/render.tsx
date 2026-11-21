import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";

type Handler = (body: unknown) => [number, unknown] | unknown;

/**
 * Answer the app's fetch calls from a table of "METHOD /api/path" handlers.
 * A handler returns the JSON body, or [status, body] for anything but 200.
 * Returns the list of calls made, for checking what was sent.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) return new Response(JSON.stringify({ detail: `No fake for ${method} ${path}` }), { status: 500 });
    const result = handler(body);
    const [status, json] = Array.isArray(result) && typeof result[0] === "number" ? result : [200, result];
    return new Response(status === 204 ? null : JSON.stringify(json), {
      status: status as number,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

/** Render inside the app's providers and a router. */
export function renderWithApp(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/", element: ui },
      { path: "*", element: <p>Another page</p> },
    ],
    { initialEntries: ["/"] },
  );
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
