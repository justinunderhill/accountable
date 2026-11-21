import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";

export interface Option {
  value: number;
  label: string;
  hint?: string | null;
}

interface SearchSelectProps {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: Option[];
  placeholder: string;
  searchPlaceholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

const LIMIT = 50;

/** A select you can type into to find an option. Shows the first 50 matches, so it stays quick with thousands. */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Type to search",
  clearable,
  invalid,
  describedBy,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value) ?? null;

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const found = needle
      ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle))
      : options;
    return found.slice(0, LIMIT);
  }, [options, search]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <div className="select-wrap">
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={`input select-trigger${selected ? "" : " is-placeholder"}`}
          >
            <span className="select-value">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown size={15} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        {clearable && selected && (
          <button type="button" className="select-clear icon-btn" aria-label="Clear" onClick={() => onChange(null)}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content className="select-pop" align="start" sideOffset={4}>
          <Command shouldFilter={false} label={placeholder}>
            <Command.Input
              className="select-search"
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
            <Command.List className="select-list">
              <Command.Empty className="select-empty">Nothing matches.</Command.Empty>
              {matches.map((o) => (
                <Command.Item
                  key={o.value}
                  value={String(o.value)}
                  className="select-item"
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="select-item-label">
                    {o.label}
                    {o.hint && <span className="select-hint">{o.hint}</span>}
                  </span>
                  {o.value === value && <Check size={15} aria-hidden="true" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
