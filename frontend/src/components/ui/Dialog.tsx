import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

/**
 * A modal dialog. Escape and the close button cancel, and focus stays inside
 * while it's open. The close button comes last in the page order, so the first
 * form field gets the focus when it opens.
 */
export function Dialog({ open, onOpenChange, title, description, children, wide }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dlg-overlay" />
        <RadixDialog.Content
          className={`dlg${wide ? " dlg-wide" : ""}`}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <RadixDialog.Title className="dlg-title">{title}</RadixDialog.Title>
          {description && <RadixDialog.Description className="dlg-sub">{description}</RadixDialog.Description>}
          {children}
          <RadixDialog.Close className="icon-btn dlg-close" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
