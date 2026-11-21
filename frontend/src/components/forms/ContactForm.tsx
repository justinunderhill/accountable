import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useOrganizations, useSaveContact } from "../../api/queries";
import type { Contact, Status } from "../../api/types";
import { STATUS_LABELS } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { SearchSelect } from "../ui/SearchSelect";
import { useToast } from "../ui/Toast";
import { Field, applyServerErrors, describe } from "./Field";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep this to 200 characters or fewer."),
  organization_id: z.number({ error: "Pick an organization." }).nullable().refine((v) => v !== null, "Pick an organization."),
  job_title: z.string(),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || EMAIL.test(v), "Enter a valid email address, such as name@company.com."),
  phone: z.string(),
  status: z.enum(["lead", "qualified", "customer"]),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ["name", "organization_id", "job_title", "email", "phone", "status"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  /** For a new contact, such as the organization it's added from. */
  defaults?: { organization_id?: number };
  onSaved?: (contact: Contact) => void;
}

export function ContactForm(props: Props) {
  return props.open ? <ContactFormBody {...props} /> : null;
}

function ContactFormBody({ open, onOpenChange, contact, defaults, onSaved }: Props) {
  const save = useSaveContact();
  const organizations = useOrganizations().data;
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const options = useMemo(
    () => (organizations ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.industry })),
    [organizations],
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: contact?.name ?? "",
      organization_id: contact?.organization_id ?? defaults?.organization_id ?? null,
      job_title: contact?.job_title ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      status: contact?.status ?? "lead",
    },
  });

  const onSubmit = async (values: Output) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: contact?.id,
        input: {
          name: values.name.trim(),
          organization_id: values.organization_id as number,
          job_title: values.job_title.trim() || null,
          email: values.email.trim() || null,
          phone: values.phone.trim() || null,
          status: values.status as Status,
        },
      });
      toast.success("Contact saved");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={contact ? "Edit contact" : "New contact"}>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field id="contact-name" label="Name" error={errors.name?.message}>
          <input id="contact-name" className="input" autoComplete="off" {...register("name")} {...describe("contact-name", errors.name?.message)} />
        </Field>
        <Field id="contact-org" label="Organization" error={errors.organization_id?.message}>
          <Controller
            control={control}
            name="organization_id"
            render={({ field }) => (
              <SearchSelect
                id="contact-org"
                value={field.value}
                onChange={field.onChange}
                options={options}
                placeholder="Pick an organization"
                searchPlaceholder="Search organizations"
                invalid={Boolean(errors.organization_id)}
                describedBy={errors.organization_id ? "contact-org-error" : undefined}
              />
            )}
          />
        </Field>
        <div className="form-two">
          <Field id="contact-title" label="Job title" optional>
            <input id="contact-title" className="input" autoComplete="off" {...register("job_title")} />
          </Field>
          <Field id="contact-status" label="Status">
            <select id="contact-status" className="input" {...register("status")}>
              {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-two">
          <Field id="contact-email" label="Email" error={errors.email?.message} optional>
            <input
              id="contact-email"
              className="input"
              type="email"
              autoComplete="off"
              {...register("email")}
              {...describe("contact-email", errors.email?.message)}
            />
          </Field>
          <Field id="contact-phone" label="Phone" optional>
            <input id="contact-phone" className="input" type="tel" autoComplete="off" {...register("phone")} />
          </Field>
        </div>
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
            {contact ? "Save changes" : "Add contact"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
