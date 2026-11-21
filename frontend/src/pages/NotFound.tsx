import { Link } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFound() {
  return (
    <main className="main">
      <div className="page-top">
        <h1 className="page-title">Page not found</h1>
      </div>
      <div className="panel">
        <EmptyState
          line="There's nothing at this address."
          action={
            <Link className="btn btn-primary" to="/">
              Go to the dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}
