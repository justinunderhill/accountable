import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useIndustries, useSaveOrganization } from "../../api/queries";
import type { Organization } from "../../api/types";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { Field, applyServerErrors, describe } from "./Field";

/** Add https:// to a website typed without it. */
export function withScheme(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep this to 200 characters or fewer."),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || /^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(v), "Enter a website, such as acme.com."),
  industry: z.string().trim(),
  notes: z.string(),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ["name", "website", "industry", "notes"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization;
  onSaved?: (org: Organization) => void;
}

export function OrganizationForm(props: Props) {
  // Mount the form only while open, so it starts fresh each time.
  return props.open ? <OrganizationFormBody {...props} /> : null;
}

function OrganizationFormBody({ open, onOpenChange, organization, onSaved }: Props) {
  const save = useSaveOrganization();
  const industries = useIndustries().data ?? [];
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization?.name ?? "",
      website: organization?.website ?? "",
      industry: organization?.industry ?? "",
      notes: organization?.notes ?? "",
    },
  });

  const onSubmit = async (values: Output) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: organization?.id,
        input: {
          name: values.name.trim(),
          website: withScheme(values.website) || null,
          industry: values.industry.trim() || null,
          notes: values.notes.trim() || null,
        },
      });
      toast.success("Organization saved");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={organization ? "Edit organization" : "New organization"}>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field id="org-name" label="Name" error={errors.name?.message}>
          <input id="org-name" className="input" autoComplete="off" {...register("name")} {...describe("org-name", errors.name?.message)} />
        </Field>
        <Field id="org-website" label="Website" error={errors.website?.message} optional>
          <input
            id="org-website"
            className="input"
            placeholder="acme.com"
            autoComplete="off"
            {...register("website")}
            {...describe("org-website", errors.website?.message)}
          />
        </Field>
        <Field id="org-industry" label="Industry" error={errors.industry?.message} optional>
          <input id="org-industry" className="input" list="org-industries" autoComplete="off" {...register("industry")} />
          <datalist id="org-industries">
            {industries.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
        <Field id="org-notes" label="Notes" optional>
          <textarea id="org-notes" className="input" rows={3} {...register("notes")} />
        </Field>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {organization ? "Save changes" : "Add organization"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
