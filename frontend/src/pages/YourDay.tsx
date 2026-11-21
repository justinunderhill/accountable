import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../api/client";
import { useSaveActivity } from "../api/queries";
import type { Dashboard, FollowUp, TimelineEntry } from "../api/types";
import { TYPE_ICONS, TYPE_LABELS } from "../components/Timeline";
import { useToast } from "../components/ui/Toast";
import { formatDateTime, formatShortDate } from "../lib/format";
import { stageInfo, stageName } from "../lib/stages";

const SHOW = 5;

/** The dashboard's right-hand column: follow-ups due, then recent activity. */
export function YourDay({ data }: { data: Dashboard }) {
  const { overdue, coming_up } = data.follow_ups;
  return (
    <aside className="today" aria-label="Your day">
      <div className="today-head">
        <h2 className="today-title">Your day</h2>
        <span className="panel-sub">{formatShortDate(data.today)}</span>
      </div>
      <section className="panel" aria-label="Follow-ups">
        <div className="ring-row">
          <div className="mini over">
            <div className="mini-n num" data-testid="overdue-count">
              {data.figures.overdue_count}
            </div>
            <div className="mini-l">Overdue</div>
          </div>
          <div className="mini soon">
            <div className="mini-n num" data-testid="coming-up-count">
              {data.figures.coming_up_count}
            </div>
            <div className="mini-l">Next 7 days</div>
          </div>
        </div>
        {overdue.length === 0 && coming_up.length === 0 ? (
          <p className="empty-line fu-empty">Nothing due in the next 7 days.</p>
        ) : (
          <div className="fu-groups">
            {overdue.length > 0 && <FollowUpGroup title="Overdue" items={overdue} overdue />}
            {coming_up.length > 0 && <FollowUpGroup title="Next 7 days" items={coming_up} />}
          </div>
        )}
      </section>
      <section className="panel" aria-label="Recent activity">
        <div className="panel-head">
          <h2 className="panel-title">Recent activity</h2>
        </div>
        {data.recent.length === 0 ? (
          <p className="empty-line fu-empty">Nothing has happened yet.</p>
        ) : (
          <ul className="feed">
            {data.recent.map((entry) => (
              <FeedItem key={`${entry.kind}${entry.id}`} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function FollowUpGroup({ title, items, overdue }: { title: string; items: FollowUp[]; overdue?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <div className="fu-group" role="group" aria-label={title}>
      <div className={`fu-head${overdue ? " overdue-head" : ""}`}>
        {title} <span className="count num">{items.length}</span>
      </div>
      <ul className="fu-list">
        {shown.map((f) => (
          <FollowUpItem key={f.id} item={f} overdue={overdue} />
        ))}
      </ul>
      {items.length > SHOW && (
        <button type="button" className="more" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function FollowUpItem({ item, overdue }: { item: FollowUp; overdue?: boolean }) {
  const save = useSaveActivity();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const link = item.deal
    ? { to: `/deals/${item.deal.id}`, name: item.deal.name }
    : item.contact
      ? { to: `/contacts/${item.contact.id}`, name: item.contact.name }
      : null;

  const markDone = async () => {
    setDone(true);
    try {
      // Let the tick show and the item fade before the list refreshes without it.
      await new Promise((resolve) => setTimeout(resolve, 450));
      await save.mutateAsync({ id: item.id, input: { done: true } });
      toast.success("Follow-up marked as done");
    } catch (error) {
      setDone(false);
      toast.error(error instanceof ApiError ? error.message : "That didn't save. Please try again.");
    }
  };

  return (
    <li className={`fu${overdue ? " overdue" : ""}${done ? " done" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        className="fu-check"
        aria-label={`Mark as done: ${item.description}`}
        disabled={done}
        onClick={markDone}
      >
        <Check size={14} aria-hidden="true" />
      </button>
      <div className="fu-body">
        <div className="fu-text">{item.description}</div>
        {link && (
          <Link className="fu-link" to={link.to}>
            {link.name}
          </Link>
        )}
      </div>
      <span className="fu-date num">{formatShortDate(item.follow_up_date)}</span>
    </li>
  );
}

function FeedItem({ entry }: { entry: TimelineEntry }) {
  const target = entry.deal
    ? { to: `/deals/${entry.deal.id}`, name: entry.deal.name }
    : entry.contact
      ? { to: `/contacts/${entry.contact.id}`, name: entry.contact.name }
      : null;
  const meta = (
    <div className="feed-meta">
      {target && <Link to={target.to}>{target.name}</Link>}
      {entry.organization && <> · {entry.organization.name}</>}
    </div>
  );

  if (entry.kind === "stage_change") {
    const to = entry.to_stage!;
    return (
      <li className="feed-item">
        <span className="feed-icon stage" style={{ ["--c" as string]: stageInfo(to).color }} aria-hidden="true">
          <ArrowRight size={15} />
        </span>
        <div className="feed-body">
          <div className="feed-text">
            Moved from {stageName(entry.from_stage!)} to <strong>{stageName(to)}</strong>
          </div>
          {meta}
        </div>
        <time className="feed-time" dateTime={entry.at}>
          {formatDateTime(entry.at)}
        </time>
      </li>
    );
  }
  const type = entry.type!;
  const Icon = TYPE_ICONS[type];
  return (
    <li className="feed-item">
      <span className={`feed-icon ${type}`} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="feed-body">
        <div className="feed-text">
          <strong>{TYPE_LABELS[type]}:</strong> {entry.description}
        </div>
        {meta}
      </div>
      <time className="feed-time" dateTime={entry.at}>
        {formatDateTime(entry.at)}
      </time>
    </li>
  );
}
