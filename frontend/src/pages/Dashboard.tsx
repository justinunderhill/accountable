import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useDashboard } from "../api/queries";
import type { Dashboard as DashboardData } from "../api/types";
import { DealsWonBars } from "../components/charts/DealsWonBars";
import { Funnel } from "../components/charts/Funnel";
import { RevenueLine } from "../components/charts/RevenueLine";
import { StageBar } from "../components/charts/StageBar";
import { DealForm } from "../components/forms/DealForm";
import { PageState } from "../components/ui/PageState";
import { greeting } from "../lib/dates";
import { formatCount, formatLongDate, formatMoney, formatMoneyShort, formatMonthYear } from "../lib/format";
import { YourDay } from "./YourDay";

export function Dashboard() {
  const dashboard = useDashboard();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageState query={dashboard}>{(data) => <DashboardView data={data} onAdd={() => setAdding(true)} />}</PageState>
      <DealForm open={adding} onOpenChange={setAdding} />
    </>
  );
}

function Money({ cents }: { cents: number }) {
  // Tiles show the full figure while it fits; past $100M it shortens, with the full figure on hover.
  const full = formatMoney(cents);
  const short = cents >= 10_000_000_000 ? formatMoneyShort(cents) : full;
  return <span title={short === full ? undefined : full}>{short}</span>;
}

function DashboardView({ data, onAdd }: { data: DashboardData; onAdd: () => void }) {
  const { figures, months } = data;
  const range = `${formatMonthYear(months[0].month)} to ${formatMonthYear(months[months.length - 1].month)}`;

  return (
    <div className="dash">
      <main className="main">
        <div className="page-top">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="greet">
              {greeting()}. Here's where sales stand on {formatLongDate(data.today)}.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            New deal
          </button>
        </div>

        <section className="panel kpi-strip" aria-label="Figures">
          <div className="kpi">
            <div className="kpi-label">Open pipeline</div>
            <div className="kpi-value num" data-testid="kpi-open">
              <Money cents={figures.open_pipeline_cents} />
            </div>
            <div className="kpi-sub">
              {formatCount(figures.open_count, "open deal")} across four stages
            </div>
            <StageBar rows={data.open_by_stage} compact />
          </div>
          <div className="kpi">
            <div className="kpi-label">Expected revenue</div>
            <div className="kpi-value num" data-testid="kpi-expected">
              <Money cents={figures.expected_cents} />
            </div>
            <div className="kpi-sub">Value times probability of close</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Won, last 12 months</div>
            <div className="kpi-value num kpi-won" data-testid="kpi-won">
              <Money cents={figures.won_12m_cents} />
            </div>
            <div className="kpi-sub">
              <span data-testid="kpi-won-count">{formatCount(figures.won_12m_count, "deal")}</span> ·{" "}
              <span data-testid="kpi-won-month">{formatMoney(figures.won_this_month_cents)}</span> this month
            </div>
          </div>
        </section>

        <section className="panel dash-panel" aria-label="Won over the last 12 months">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Won over the last 12 months</h2>
              <p className="panel-sub">{range}</p>
            </div>
          </div>
          <div className="combo">
            <div>
              <h3 className="chart-title">Revenue won (USD)</h3>
              <RevenueLine months={months} />
            </div>
            <div>
              <h3 className="chart-title">Deals won</h3>
              <DealsWonBars months={months} />
            </div>
          </div>
        </section>

        <div className="dash-row">
          <section className="panel" aria-label="Sales funnel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Sales funnel</h2>
                <p className="panel-sub">Value of deals that reached each stage, and the share of New</p>
              </div>
            </div>
            <Funnel rows={data.funnel} />
          </section>
          <section className="panel" aria-label="Open pipeline by stage">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Open pipeline by stage</h2>
                <p className="panel-sub">Won and Lost aren't counted</p>
              </div>
              <Link to="/pipeline" className="panel-link">
                View board
              </Link>
            </div>
            <StageBar rows={data.open_by_stage} />
          </section>
        </div>
      </main>
      <YourDay data={data} />
    </div>
  );
}
