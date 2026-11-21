import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";

interface ToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}

/** A row of segments where exactly one is on. */
export function Toggle<T extends string>({ value, onChange, options, label }: ToggleProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      className="segments"
      value={value}
      aria-label={label}
      onValueChange={(next) => next && onChange(next as T)}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className="segment">
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
