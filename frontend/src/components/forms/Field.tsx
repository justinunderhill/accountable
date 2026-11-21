import type { ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "../../api/client";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}

/** A label, its input and, if there is one, the message saying what to fix. */
export function Field({ id, label, error, children, optional }: FieldProps) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional">Optional</span>}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Props that tie an input to its error message for screen readers. */
export function describe(id: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

/**
 * Show the server's messages next to their fields. `rename` maps API field
 * names to form field names, such as value_cents to value. Returns the message
 * for the whole form when the error isn't about particular fields.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: string[],
  rename: Record<string, string> = {},
): string | null {
  if (!(error instanceof ApiError)) return "Saving didn't work. Please try again.";
  const entries = Object.entries(error.fieldErrors);
  let unplaced: string | null = null;
  for (const [apiField, message] of entries) {
    const field = rename[apiField] ?? apiField;
    if (fields.includes(field)) setError(field as Path<T>, { type: "server", message });
    else unplaced = message;
  }
  if (entries.length === 0) return error.message;
  return unplaced;
}
