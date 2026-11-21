import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useSaveActivity } from "../../api/queries";
import type { Activity, ActivityType, TimelineEntry } from "../../api/types";
import { nowForInput } from "../../lib/dates";
import { Dialog } from "../ui/Dialog";
import { Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";
import { Field, applyServerErrors, describe } from "./Field";

export const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: typeof FileText }[] = [
  { value: "note", label: "Note", icon: FileText },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
];

const schema = z.object({
  type: z.enum(["note", "call", "email"]),
  description: z.string().trim().min(1, "Enter a description."),
  occurred_at: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v), "Enter the date and time it happened."),
  follow_up_date: z.string(),
  done: z.boolean(),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ["type", "description", "occurred_at", "follow_up_date", "done"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The activity to edit, or nothing for a new one. */
  activity?: Activity | TimelineEntry;
  /** What a new activity is logged on: exactly one of a contact or a deal. */
  target?: { contact_id: number } | { deal_id: number };
}

export function ActivityForm(props: Props) {
  return props.open ? <ActivityFormBody {...props} /> : null;
}

function ActivityFormBody({ open, onOpenChange, activity, target }: Props) {
  const save = useSaveActivity();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const occurred = activity ? ("occurred_at" in activity ? activity.occurred_at : activity.at) : null;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: activity?.type ?? "note",
      description: activity?.description ?? "",
      occurred_at: occurred ? occurred.slice(0, 16) : nowForInput(),
      follow_up_date: activity?.follow_up_date ?? "",
      done: activity?.done ?? false,
    },
  });
  const followUp = useWatch({ control, name: "follow_up_date" });

  const onSubmit = async (values: Output) => {
    setFormError(null);
    const input = {
      type: values.type,
      description: values.description.trim(),
      occurred_at: values.occurred_at,
      follow_up_date: values.follow_up_date || null,
      done: values.follow_up_date ? values.done : false,
    };
    try {
      await save.mutateAsync(activity ? { id: activity.id, input } : { input: { ...input, ...target } });
      toast.success("Activity saved");
      onOpenChange(false);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={activity ? "Edit activity" : "Log activity"}>
      <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="field">
          <span className="field-label" id="activity-type-label">
            Type
          </span>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Toggle
                label="Type"
                value={field.value}
                onChange={field.onChange}
                options={ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => ({
                  value,
                  label,
                  icon: <Icon size={15} aria-hidden="true" />,
                }))}
              />
            )}
          />
        </div>
        <Field id="activity-description" label="Description" error={errors.description?.message}>
          <textarea
            id="activity-description"
            className="input"
            rows={3}
            {...register("description")}
            {...describe("activity-description", errors.description?.message)}
          />
        </Field>
        <div className="form-two">
          <Field id="activity-when" label="When it happened" error={errors.occurred_at?.message}>
            <input
              id="activity-when"
              className="input"
              type="datetime-local"
              {...register("occurred_at")}
              {...describe("activity-when", errors.occurred_at?.message)}
            />
          </Field>
          <Field id="activity-follow-up" label="Follow-up date" error={errors.follow_up_date?.message} optional>
            <input id="activity-follow-up" className="input" type="date" {...register("follow_up_date")} />
          </Field>
        </div>
        {activity && followUp && (
          <label className="check">
            <input type="checkbox" {...register("done")} />
            Done
          </label>
        )}
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
            {activity ? "Save changes" : "Log activity"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
