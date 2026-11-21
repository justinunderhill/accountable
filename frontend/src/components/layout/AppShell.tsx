import { Outlet } from "react-router";
import { useToday } from "../../api/queries";
import { Rail } from "./Rail";

export function AppShell() {
  // Ask the backend for today's date early, so forms and badges have it ready.
  useToday();
  return (
    <div className="app">
      <Rail />
      <Outlet />
    </div>
  );
}
