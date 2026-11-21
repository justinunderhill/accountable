import { NavLink, Link } from "react-router";
import { Briefcase, Building2, Columns3, LayoutDashboard, Users } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pipeline", label: "Pipeline", icon: Columns3, end: false },
  { to: "/deals", label: "Deals", icon: Briefcase, end: false },
  { to: "/contacts", label: "Contacts", icon: Users, end: false },
  { to: "/organizations", label: "Orgs", icon: Building2, end: false },
];

export function Rail() {
  return (
    <aside className="rail">
      <Link to="/" className="logo" aria-label="Accountable home">
        A
      </Link>
      <nav className="nav" aria-label="Main">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
