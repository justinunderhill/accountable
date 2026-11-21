import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import { EmptyState } from "./EmptyState";

interface PageStateProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  /** What the page is about, for the "not found" line, such as "deal". */
  noun?: string;
  backTo?: { href: string; label: string };
}

/** Loading, error and not-found states for a page's main data. */
export function PageState<T>({ query, children, noun = "page", backTo }: PageStateProps<T>) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="panel">
        <EmptyState
          line={missing ? `This ${noun} doesn't exist. It may have been deleted.` : "This page couldn't load."}
          action={
            missing ? (
              backTo && (
                <Link className="btn" to={backTo.href}>
                  {backTo.label}
                </Link>
              )
            ) : (
              <button type="button" className="btn" onClick={() => query.refetch()}>
                Try again
              </button>
            )
          }
        />
      </div>
    );
  }
  return (
    <div className="loading" role="status">
      Loading...
    </div>
  );
}
