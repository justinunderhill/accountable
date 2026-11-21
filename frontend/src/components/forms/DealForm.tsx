import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useContacts, useOrganizations, useSaveDeal, useToday } from "../../api/queries";
import type { Deal, Stage } from "../../api/types";
import { addDays } from "../../lib/dates";
import { centsToDollars, dollarsToCents } from "../../lib/format";
import { STAGES, defaultProbability, isClosedStage } from "../../lib/stages";
import { Dialog } from "../ui/Dialog";
import { SearchSelect } from "../ui/SearchSelect";
import { useToast } from "../ui/Toast";
import { Field, applyServerErrors, describe } from "./Field";

const WHOLE = /^\d+$/;

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep this to 200 characters or fewer."),
  contact_id: z.number().nullable().refine((v) => v !== null, "Pick a main contact."),
  organization_id: z.number().nullable(),
  stage: z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost"]),
  value: z
    .string()
    .trim()
    .refine((v) => v !== "", "Enter a value in whole dollars.")
    .refine((v) => v === "" || WHOLE.test(v.replace(/[$,]/g, "")), "Enter a value of $0 or more, in whole dollars."),
  probability: z
    .string()
    .trim()
    .refine((v) => WHOLE.test(v) && Number(v) <= 100, "Enter a probability from 0 to 100."),
  close_date: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a close date."),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ["name", "contact_id", "organization_id", "stage", "value", "probability", "close_date"];

export interface DealDefaults {
  stage?: Stage;
  organization_id?: number;
  contact_id?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  /** For a new deal: the stage of the column it's added from, or the organization or contact it's added from. */
  defaults?: DealDefaults;
  onSaved?: (deal: Deal) => void;
}

export function DealForm(props: Props) {
  const today = useToday();
  return props.open && today ? <DealFormBody {...props} today={today} /> : null;
}

function DealFormBody({ open, onOpenChange, deal, defaults, onSaved, today }: Props & { today: string }) {
  const save = useSaveDeal();
  const contacts = useContacts().data;
  const organizations = useOrganizations().data;
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const contactOptions = useMemo(
    () => (contacts ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.organization_name })),
    [contacts],
  );
  const orgOptions = useMemo(
    () => (organizations ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.industry })),
    [organizations],
  );

  const initial = useMemo<Values>(() => {
    if (deal) {
      return {
        name: deal.name,
        contact_id: deal.contact_id,
        organization_id: deal.organization_id,
        stage: deal.stage,
        value: String(centsToDollars(deal.value_cents)),
        probability: String(deal.probability),
        close_date: deal.close_date,
      };
    }
    const stage = defaults?.stage ?? "new";
    const contact = contacts?.find((c) => c.id === defaults?.contact_id);
    return {
      name: "",
      contact_id: defaults?.contact_id ?? null,
      organization_id: defaults?.organization_id ?? contact?.organization_id ?? null,
      stage,
      value: "",
      probability: String(defaultProbability(stage)),
      close_date: isClosedStage(stage) ? today : addDays(today, 30),
    };
    // The form keeps its own state once open; only the first values matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({ resolver: zodResolver(schema), defaultValues: initial });

  // Picking a contact fills in their organization, which can then be changed or cleared.
  const pickContact = (id: number | null) => {
    setValue("contact_id", id, { shouldValidate: Boolean(errors.contact_id) });
    const contact = contacts?.find((c) => c.id === id);
    if (contact) setValue("organization_id", contact.organization_id ?? null);
  };

  // A new stage brings its usual probability, and Won or Lost bring today's date.
  // Both can be changed again before saving.
  const stageField = register("stage", {
    onChange: (event: { target: { value: Stage } }) => {
      const stage = event.target.value;
      setValue("probability", String(defaultProbability(stage)), { shouldValidate: true });
      if (isClosedStage(stage)) setValue("close_date", today, { shouldValidate: true });
    },
  });

  const onSubmit = async (values: Output) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: deal?.id,
        input: {
          name: values.name.trim(),
          contact_id: values.contact_id as number,
          organization_id: values.organization_id,
          stage: values.stage,
          value_cents: dollarsToCents(Number(values.value.replace(/[$,]/g, ""))),
          probability: Number(values.probability),
          close_date: values.close_date,
        },
      });
      toast.success("Deal saved");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS, { value_cents: "value" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={deal ? "Edit deal" : "New deal"}>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field id="deal-name" label="Name" error={errors.name?.message}>
          <input id="deal-name" className="input" autoComplete="off" {...register("name")} {...describe("deal-name", errors.name?.message)} />
        </Field>
        <div className="form-two">
          <Field id="deal-contact" label="Main contact" error={errors.contact_id?.message}>
            <Controller
              control={control}
              name="contact_id"
              render={({ field }) => (
                <SearchSelect
                  id="deal-contact"
                  value={field.value}
                  onChange={pickContact}
                  options={contactOptions}
                  placeholder="Pick a contact"
                  searchPlaceholder="Search contacts"
                  invalid={Boolean(errors.contact_id)}
                  describedBy={errors.contact_id ? "deal-contact-error" : undefined}
                />
              )}
            />
          </Field>
          <Field id="deal-org" label="Organization" error={errors.organization_id?.message} optional>
            <Controller
              control={control}
              name="organization_id"
              render={({ field }) => (
                <SearchSelect
                  id="deal-org"
                  value={field.value}
                  onChange={field.onChange}
                  options={orgOptions}
                  placeholder="No organization"
                  searchPlaceholder="Search organizations"
                  clearable
                />
              )}
            />
          </Field>
        </div>
        <div className="form-two">
          <Field id="deal-stage" label="Stage" error={errors.stage?.message}>
            <select id="deal-stage" className="input" {...stageField}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="deal-close" label="Close date" error={errors.close_date?.message}>
            <input
              id="deal-close"
              className="input"
              type="date"
              {...register("close_date")}
              {...describe("deal-close", errors.close_date?.message)}
            />
          </Field>
        </div>
        <div className="form-two">
          <Field id="deal-value" label="Value (USD)" error={errors.value?.message}>
            <div className="input-affix">
              <span aria-hidden="true">$</span>
              <input
                id="deal-value"
                className="input num"
                inputMode="numeric"
                autoComplete="off"
                {...register("value")}
                {...describe("deal-value", errors.value?.message)}
              />
            </div>
          </Field>
          <Field id="deal-probability" label="Probability" error={errors.probability?.message}>
            <div className="input-affix input-affix-end">
              <input
                id="deal-probability"
                className="input num"
                inputMode="numeric"
                autoComplete="off"
                {...register("probability")}
                {...describe("deal-probability", errors.probability?.message)}
              />
              <span aria-hidden="true">%</span>
            </div>
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
            {deal ? "Save changes" : "Add deal"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
