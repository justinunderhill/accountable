import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError } from "../api/client";
import { useDeal, useMoveDeal } from "../api/queries";
import type { DealDetail, Stage } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { ActivityForm } from "../components/forms/ActivityForm";
import { DealForm } from "../components/forms/DealForm";
import { Timeline } from "../components/Timeline";
import { LateBadge, StageBadge, StageDot } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { formatDate, formatMoney } from "../lib/format";
import { STAGES, stageName } from "../lib/stages";

export function DealPage() {
  const id = Number(useParams().id);
  const deal = useDeal(id);
  return (
    <main className="main">
      <Link className="crumb" to="/deals">
        <ChevronLeft size={15} aria-hidden="true" />
        Deals
      </Link>
      <PageState query={deal} noun="deal" backTo={{ href: "/deals", label: "All deals" }}>
        {(d) => <DealView deal={d} />}
      </PageState>
    </main>
  );
}

/** The message after a stage change, such as "Website redesign marked as won. Close date set to Nov 21, 2026." */
export function stageMessage(name: string, stage: Stage, closeDate: string): string {
  if (stage === "won" || stage === "lost") {
    return `${name} marked as ${stage}. Close date set to ${formatDate(closeDate)}.`;
  }
  return `${name} moved to ${stageName(stage)}.`;
}

function DealView({ deal }: { deal: DealDetail }) {
  const navigate = useNavigate();
  const move = useMoveDeal();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logging, setLogging] = useState(false);

  const changeStage = async (stage: Stage) => {
    if (stage === deal.stage) return;
    try {
      const moved = await move.mutateAsync({ id: deal.id, stage, index: 0 });
      toast.success(stageMessage(moved.name, moved.stage, moved.close_date));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The stage didn't change. Please try again.");
    }
  };

  return (
    <div className="record">
      <section className="panel record-head">
        <div className="record-title-row">
          <div>
            <div className="record-title">
              <h1 className="page-title">{deal.name}</h1>
              <StageBadge stage={deal.stage} />
              {deal.late && <LateBadge />}
            </div>
            <p className="record-sub">
              {deal.organization_id ? (
                <Link to={`/organizations/${deal.organization_id}`}>{deal.organization_name}</Link>
              ) : (
                <span className="none">No organization</span>
              )}
              {" · Main contact "}
              <Link to={`/contacts/${deal.contact_id}`}>{deal.contact_name}</Link>
            </p>
          </div>
          <div className="record-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
            <button type="button" className="btn btn-quiet-danger" onClick={() => setDeleting(true)}>
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>

        <div className="deal-figures">
          <div>
            <div className="tile-label">Value</div>
            <div className="tile-value num">{formatMoney(deal.value_cents)}</div>
          </div>
          <div>
            <div className="tile-label">Probability</div>
            <div className="tile-value num">
              {deal.probability}%
              {deal.probability_by_hand && (
                <span className="by-hand" title="Set by hand">
                  *
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="tile-label">Expected revenue</div>
            <div className="tile-value num">{formatMoney(deal.expected_cents)}</div>
          </div>
          <div>
            <div className="tile-label">{deal.stage === "won" || deal.stage === "lost" ? "Closed" : "Close date"}</div>
            <div className={`tile-value num${deal.late ? " late-text" : ""}`}>{formatDate(deal.close_date)}</div>
          </div>
        </div>

        <div className="stage-control">
          <span className="field-label" id="stage-control-label">
            Stage
          </span>
          <div className="stage-segments" role="group" aria-labelledby="stage-control-label">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="stage-segment"
                aria-pressed={deal.stage === s.key}
                disabled={move.isPending}
                onClick={() => changeStage(s.key)}
              >
                <StageDot stage={s.key} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Panel
        title="Timeline"
        sub="Newest first"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogging(true)}>
            <Plus size={15} aria-hidden="true" />
            Log activity
          </button>
        }
      >
        <Timeline entries={deal.timeline} emptyLine="Nothing logged yet." />
      </Panel>

      <DealForm open={editing} onOpenChange={setEditing} deal={deal} />
      <ActivityForm open={logging} onOpenChange={setLogging} target={{ deal_id: deal.id }} />
      <ConfirmDelete kind="deal" id={deal.id} open={deleting} onOpenChange={setDeleting} onDeleted={() => navigate("/deals")} />
    </div>
  );
}
