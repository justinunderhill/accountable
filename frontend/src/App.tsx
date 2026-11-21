import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { ApiError } from "./api/client";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { ContactPage } from "./pages/ContactPage";
import { Contacts } from "./pages/Contacts";
import { Dashboard } from "./pages/Dashboard";
import { DealPage } from "./pages/DealPage";
import { Deals } from "./pages/Deals";
import { NotFound } from "./pages/NotFound";
import { OrganizationPage } from "./pages/OrganizationPage";
import { Organizations } from "./pages/Organizations";
import { Pipeline } from "./pages/Pipeline";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A missing record or a bad request won't fix itself, so don't ask again.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/pipeline", element: <Pipeline /> },
      { path: "/deals", element: <Deals /> },
      { path: "/deals/:id", element: <DealPage /> },
      { path: "/contacts", element: <Contacts /> },
      { path: "/contacts/:id", element: <ContactPage /> },
      { path: "/organizations", element: <Organizations /> },
      { path: "/organizations/:id", element: <OrganizationPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
