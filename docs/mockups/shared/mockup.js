// Shared sample figures, icons and chart drawing for the three dashboard mockups.
// Plain JavaScript and inline SVG, so the mockups open straight from disk.

const fmtUSD = (v) => "$" + Math.round(v).toLocaleString("en-US");
const fmtShort = (v) =>
  v === 0 ? "$0" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : "$" + Math.round(v / 1000) + "k";

const STAGE = {
  new: { name: "New", color: "#118AB2" },
  qualified: { name: "Qualified", color: "#FFC145" },
  proposal: { name: "Proposal", color: "#F78C6B" },
  negotiation: { name: "Negotiation", color: "#073B4C" },
  won: { name: "Won", color: "#06D6A0" },
  lost: { name: "Lost", color: "#CDD8DB" },
};

// Deals on the board. [stage, name, organization, contact, value, close date, probability set by hand]
const TODAY = "2026-11-21";
const DEFAULT_PROB = { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 };
const DEALS = [
  ["new", "Payroll integration", "Alder Capital", "Lena Fischer", 12000, "2026-12-18"],
  ["new", "Inventory forecasting pilot", "Brightline Retail", "Grace Whitfield", 18500, "2027-01-15"],
  ["new", "Patient portal refresh", "Northwind Health", "Priya Natarajan", 25000, "2027-02-10"],
  ["new", "Support desk add-on", "Cobalt Bank", "Daniel Reyes", 8500, "2026-12-05"],
  ["new", "Shop floor dashboards", "Kestrel Manufacturing", "Tom Okafor", 32000, "2027-01-30"],
  ["new", "Route planning trial", "Halverson Logistics", "Sam Whitaker", 22000, "2026-11-14"],
  ["new", "Student records cleanup", "Maple Ridge College", "Ana Costa", 41000, "2027-03-01"],
  ["new", "Store analytics starter", "Fernway Outfitters", "Chris Lam", 15000, "2026-12-12"],
  ["new", "Claims workflow review", "Summit Mutual", "Rachel Ng", 40000, "2027-02-20"],
  ["qualified", "Treasury reporting suite", "Cobalt Bank", "Daniel Reyes", 45000, "2026-12-20"],
  ["qualified", "Clinic scheduling platform", "Northwind Health", "Priya Natarajan", 62500, "2027-01-10"],
  ["qualified", "Fleet telematics pilot", "Kestrel Manufacturing", "Tom Okafor", 28000, "2026-12-30"],
  ["qualified", "Loyalty program rebuild", "Brightline Retail", "Grace Whitfield", 75000, "2027-02-05"],
  ["qualified", "Data warehouse audit", "Alder Capital", "Lena Fischer", 38000, "2026-11-18"],
  ["qualified", "Campus Wi-Fi analytics", "Maple Ridge College", "Ana Costa", 54000, "2027-01-22"],
  ["qualified", "Returns portal", "Fernway Outfitters", "Chris Lam", 19000, "2026-12-08"],
  ["qualified", "Underwriting data feed", "Summit Mutual", "Rachel Ng", 65000, "2027-01-28"],
  ["proposal", "Warehouse analytics", "Halverson Logistics", "Sam Whitaker", 88000, "2026-12-15"],
  ["proposal", "Security assessment", "Alder Capital", "Lena Fischer", 34000, "2026-11-10"],
  ["proposal", "ERP connector bundle", "Ferro Industries", "Marcus Bell", 120000, "2027-01-20", 40],
  ["proposal", "Telehealth integration", "Northwind Health", "Priya Natarajan", 47500, "2026-12-22"],
  ["proposal", "POS integration rollout", "Brightline Retail", "Grace Whitfield", 56500, "2026-12-01"],
  ["proposal", "Quality tracking module", "Kestrel Manufacturing", "Tom Okafor", 26000, "2027-01-08"],
  ["proposal", "Policy admin migration", "Summit Mutual", "Rachel Ng", 40000, "2026-12-28"],
  ["negotiation", "Data platform migration", "Halverson Logistics", "Sam Whitaker", 64000, "2026-11-28"],
  ["negotiation", "Managed services contract", "Ferro Industries", "Marcus Bell", 92000, "2026-12-10", 85],
  ["negotiation", "Annual licence uplift", "Fernway Outfitters", "Chris Lam", 18000, "2026-11-19"],
  ["negotiation", "Advisor CRM rollout", "Cobalt Bank", "Daniel Reyes", 31000, "2026-12-04"],
  ["negotiation", "Lab results interface", "Northwind Health", "Priya Natarajan", 23000, "2026-11-30"],
  ["won", "Annual support renewal", "Cobalt Bank", "Daniel Reyes", 36000, "2026-11-20"],
  ["won", "Cloud backup service", "Maple Ridge College", "Ana Costa", 14000, "2026-11-12"],
  ["won", "Plant monitoring", "Kestrel Manufacturing", "Tom Okafor", 42000, "2026-11-03"],
  ["won", "Customer data platform", "Brightline Retail", "Grace Whitfield", 96000, "2026-10-24"],
  ["won", "Compliance reporting", "Alder Capital", "Lena Fischer", 59000, "2026-10-09"],
  ["won", "Dispatch optimisation", "Halverson Logistics", "Sam Whitaker", 28000, "2026-09-30"],
  ["lost", "Mobile app rebuild", "Fernway Outfitters", "Chris Lam", 48000, "2026-11-06"],
  ["lost", "Billing system replacement", "Summit Mutual", "Rachel Ng", 110000, "2026-10-15"],
  ["lost", "Kiosk software", "Brightline Retail", "Grace Whitfield", 9500, "2026-09-22"],
  ["lost", "Research data lake", "Maple Ridge College", "Ana Costa", 72000, "2026-08-28"],
].map(([stage, name, org, contact, value, close, prob], id) => ({
  id, stage, name, org, contact, value, close, prob: prob ?? DEFAULT_PROB[stage],
}));
const OPEN_STAGES = ["new", "qualified", "proposal", "negotiation"];
const isLate = (d) => OPEN_STAGES.includes(d.stage) && d.close < TODAY;

const DATA = {
  months: ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
  monthsFull: [
    "December 2025", "January 2026", "February 2026", "March 2026", "April 2026", "May 2026",
    "June 2026", "July 2026", "August 2026", "September 2026", "October 2026", "November 2026",
  ],
  revenue: [62000, 48000, 85000, 71000, 96000, 88000, 120000, 104000, 132000, 118000, 155000, 92000],
  won: [2, 1, 3, 2, 3, 2, 3, 2, 3, 2, 2, 3],
  open: OPEN_STAGES.map((key) => {
    const ds = DEALS.filter((d) => d.stage === key);
    return { key, value: ds.reduce((s, d) => s + d.value, 0), count: ds.length };
  }),
  funnel: [
    { key: "new", value: 3105000, count: 72 },
    { key: "qualified", value: 2640000, count: 58 },
    { key: "proposal", value: 2015000, count: 44 },
    { key: "negotiation", value: 1560000, count: 34 },
    { key: "won", value: 1171000, count: 28 },
  ],
  followups: {
    overdue: [
      { date: "Nov 14", text: "Send revised pricing for the analytics add-on", who: "Data platform migration", kind: "deal" },
      { date: "Nov 17", text: "Call back about the security questionnaire", who: "Priya Natarajan", kind: "contact" },
      { date: "Nov 18", text: "Chase the signed order form", who: "POS integration rollout", kind: "deal" },
      { date: "Nov 19", text: "Book the onboarding kickoff", who: "Tom Okafor", kind: "contact" },
      { date: "Nov 20", text: "Confirm seat count before renewal", who: "Annual support renewal", kind: "deal" },
      { date: "Nov 20", text: "Reply to questions on data residency", who: "Lena Fischer", kind: "contact" },
    ],
    upcoming: [
      { date: "Today", text: "Prepare demo for the finance team", who: "Treasury reporting suite", kind: "deal" },
      { date: "Nov 23", text: "Send case study from a retail customer", who: "Grace Whitfield", kind: "contact" },
      { date: "Nov 24", text: "Follow up on proposal feedback", who: "Warehouse analytics", kind: "deal" },
      { date: "Nov 25", text: "Intro call with the new IT director", who: "Marcus Bell", kind: "contact" },
      { date: "Nov 27", text: "Check legal review of the MSA", who: "Clinic scheduling platform", kind: "deal" },
    ],
    upcomingTotal: 15,
  },
  recent: [
    { kind: "stage", from: "proposal", to: "negotiation", who: "Data platform migration", org: "Halverson Logistics", time: "Today, 10:42 AM" },
    { kind: "call", text: "Walked through the implementation timeline", who: "Marcus Bell", org: "Ferro Industries", time: "Today, 9:15 AM" },
    { kind: "stage", from: "negotiation", to: "won", who: "Annual support renewal", org: "Cobalt Bank", time: "Yesterday, 4:30 PM" },
    { kind: "email", text: "Sent the onboarding checklist", who: "Grace Whitfield", org: "Brightline Retail", time: "Yesterday, 2:05 PM" },
    { kind: "note", text: "Budget approved for Q1, waiting on procurement", who: "Clinic scheduling platform", org: "Northwind Health", time: "Yesterday, 11:20 AM" },
    { kind: "call", text: "Discussed pricing tiers and seat counts", who: "Priya Natarajan", org: "Northwind Health", time: "Nov 19, 3:45 PM" },
    { kind: "stage", from: "new", to: "qualified", who: "Fleet telematics pilot", org: "Kestrel Manufacturing", time: "Nov 19, 1:10 PM" },
    { kind: "email", text: "Shared the security whitepaper", who: "Lena Fischer", org: "Alder Capital", time: "Nov 18, 5:50 PM" },
  ],
};

DATA.openTotal = DATA.open.reduce((s, r) => s + r.value, 0);
DATA.openCount = DATA.open.reduce((s, r) => s + r.count, 0);
DATA.expected = DEALS.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + (d.value * d.prob) / 100, 0);
DATA.wonTotal = DATA.revenue.reduce((s, v) => s + v, 0);
DATA.wonCount = DATA.won.reduce((s, v) => s + v, 0);

// Icons: Lucide-style strokes, 24px grid.
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  pipeline: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  deals: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  contacts: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  organizations: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/>',
  stage: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};
const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Tooltip shared by every chart.
const tip = document.createElement("div");
tip.className = "tt";
tip.setAttribute("role", "tooltip");
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
function showTip(evt, html) {
  tip.innerHTML = html;
  tip.style.opacity = "1";
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY - r.height - pad;
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y < 8) y = evt.clientY + pad;
  tip.style.transform = `translate(${x}px, ${y}px)`;
}
const hideTip = () => (tip.style.opacity = "0");

function niceMax(max, ticks = 4) {
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return step * ticks;
}

const svgNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const e = document.createElementNS(svgNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function axes(svg, { W, H, m, max, fmt, labels, xAt }) {
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    const y = m.t + (H - m.t - m.b) * (1 - k / 4);
    svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, class: k === 0 ? "baseline" : "grid" }));
    const t = svgEl("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "axis" });
    t.textContent = fmt(v);
    svg.appendChild(t);
  }
  labels.forEach((lab, i) => {
    const t = svgEl("text", { x: xAt(i), y: H - 8, "text-anchor": "middle", class: "axis" });
    t.textContent = lab;
    svg.appendChild(t);
  });
}

function responsive(el, draw) {
  let lastW = -1;
  const run = () => {
    const w = el.clientWidth;
    if (w === lastW || w === 0) return;
    lastW = w;
    el.innerHTML = "";
    draw(w);
  };
  new ResizeObserver(() => requestAnimationFrame(run)).observe(el);
}

// Line chart with a crosshair and tooltip. One series, so no legend: the panel title names it.
function lineChart(el, { values, labels, full, color, height = 220, counts }) {
  responsive(el, (W) => {
    const H = height;
    const m = { t: 14, r: 48, b: 30, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const max = niceMax(Math.max(...values));
    const x = (i) => m.l + (i * iw) / (values.length - 1);
    const y = (v) => m.t + ih - (v / max) * ih;
    const svg = svgEl("svg", { width: W, height: H, role: "img", "aria-label": "Revenue won by month, last 12 months" });
    axes(svg, { W, H, m, max, fmt: fmtShort, labels, xAt: x });
    const pts = values.map((v, i) => [x(i), y(v)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    svg.appendChild(svgEl("path", { d: `${line} L${x(values.length - 1)},${m.t + ih} L${m.l},${m.t + ih} Z`, fill: color, opacity: 0.1 }));
    svg.appendChild(svgEl("path", { d: line, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    const cross = svgEl("line", { y1: m.t, y2: m.t + ih, class: "cross", opacity: 0 });
    svg.appendChild(cross);
    const dots = pts.map((p) => {
      const c = svgEl("circle", { cx: p[0], cy: p[1], r: 4, fill: color, stroke: "#fff", "stroke-width": 2 });
      svg.appendChild(c);
      return c;
    });
    // Direct label on the latest point only.
    const last = pts[pts.length - 1];
    const lt = svgEl("text", { x: last[0] + 10, y: last[1] + 4, "text-anchor": "start", class: "dlabel" });
    lt.textContent = fmtShort(values[values.length - 1]);
    svg.appendChild(lt);
    const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    hit.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left - m.l) / iw) * (values.length - 1))));
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("opacity", 1);
      dots.forEach((d, j) => d.setAttribute("r", j === i ? 6 : 4));
      showTip(e, `<div class="tt-h">${full[i]}</div><div class="tt-v">${fmtUSD(values[i])}</div><div class="tt-s">${counts[i]} deal${counts[i] === 1 ? "" : "s"} won</div>`);
    });
    hit.addEventListener("mouseleave", () => {
      cross.setAttribute("opacity", 0);
      dots.forEach((d) => d.setAttribute("r", 4));
      hideTip();
    });
    svg.appendChild(hit);
    el.appendChild(svg);
  });
}

// Vertical bars, 4px rounded tops anchored to the baseline, hover per band.
function barChart(el, { values, labels, full, color, height = 220 }) {
  responsive(el, (W) => {
    const H = height;
    const m = { t: 14, r: 12, b: 30, l: 32 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const max = Math.max(4, Math.ceil(Math.max(...values) / 4) * 4);
    const band = iw / values.length;
    const bw = Math.min(22, band * 0.56);
    const cx = (i) => m.l + band * i + band / 2;
    const svg = svgEl("svg", { width: W, height: H, role: "img", "aria-label": "Deals won by month, last 12 months" });
    axes(svg, { W, H, m, max, fmt: (v) => String(Math.round(v)), labels, xAt: cx });
    values.forEach((v, i) => {
      const h = (v / max) * ih;
      const x0 = cx(i) - bw / 2;
      const y0 = m.t + ih;
      const r = Math.min(4, h);
      const bar = svgEl("path", {
        d: `M${x0},${y0} V${y0 - h + r} Q${x0},${y0 - h} ${x0 + r},${y0 - h} H${x0 + bw - r} Q${x0 + bw},${y0 - h} ${x0 + bw},${y0 - h + r} V${y0} Z`,
        fill: color,
      });
      svg.appendChild(bar);
      const hit = svgEl("rect", { x: m.l + band * i, y: m.t, width: band, height: ih, fill: "transparent" });
      hit.addEventListener("mousemove", (e) => {
        bar.setAttribute("opacity", 0.8);
        showTip(e, `<div class="tt-h">${full[i]}</div><div class="tt-v">${v} deal${v === 1 ? "" : "s"} won</div>`);
      });
      hit.addEventListener("mouseleave", () => {
        bar.setAttribute("opacity", 1);
        hideTip();
      });
      svg.appendChild(hit);
    });
    el.appendChild(svg);
  });
}

// Funnel: one labelled horizontal bar per stage. Every bar carries its stage name, so color is never alone.
function funnel(el, rows = DATA.funnel) {
  const top = rows[0].value;
  el.innerHTML = rows
    .map((r) => {
      const pct = Math.round((r.value / top) * 100);
      return `<div class="fn-row" data-k="${r.key}">
        <div class="fn-name">${STAGE[r.key].name}</div>
        <div class="fn-track"><div class="fn-bar" style="width:${(r.value / top) * 100}%;background:${STAGE[r.key].color}"></div></div>
        <div class="fn-val num">${fmtShort(r.value)}</div>
        <div class="fn-pct num">${pct}%</div>
      </div>`;
    })
    .join("");
  el.querySelectorAll(".fn-row").forEach((row, i) => {
    const r = rows[i];
    row.addEventListener("mousemove", (e) =>
      showTip(e, `<div class="tt-h">Reached ${STAGE[r.key].name}</div><div class="tt-v">${fmtUSD(r.value)}</div><div class="tt-s">${r.count} deals · ${Math.round((r.value / top) * 100)}% of New</div>`),
    );
    row.addEventListener("mouseleave", hideTip);
  });
}

// Open pipeline as one segmented bar with a 2px surface gap, plus a labelled legend.
function stageBar(el, rows = DATA.open, { legend = true } = {}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  el.innerHTML =
    `<div class="sb">${rows
      .map((r) => `<div class="sb-seg" style="flex:${r.value};background:${STAGE[r.key].color}" data-k="${r.key}"></div>`)
      .join("")}</div>` +
    (legend
      ? `<ul class="sb-legend">${rows
          .map(
            (r) => `<li><span class="sw" style="background:${STAGE[r.key].color}"></span><span class="sb-name">${STAGE[r.key].name}</span>
          <span class="sb-val num">${fmtUSD(r.value)}</span><span class="sb-count">${r.count} deals</span></li>`,
          )
          .join("")}</ul>`
      : "");
  el.querySelectorAll(".sb-seg").forEach((seg, i) => {
    const r = rows[i];
    seg.addEventListener("mousemove", (e) =>
      showTip(e, `<div class="tt-h">${STAGE[r.key].name}</div><div class="tt-v">${fmtUSD(r.value)}</div><div class="tt-s">${r.count} deals · ${Math.round((r.value / total) * 100)}% of open value</div>`),
    );
    seg.addEventListener("mouseleave", hideTip);
  });
}

function followupItem(f, overdue) {
  return `<li class="fu${overdue ? " overdue" : ""}">
    <button class="fu-check" aria-label="Mark as done">${icon("check", 14)}</button>
    <div class="fu-body"><div class="fu-text">${f.text}</div><a class="fu-link" href="#">${f.who}</a></div>
    <span class="fu-date num">${overdue ? "" : ""}${f.date}</span>
  </li>`;
}

function followups(el, { upcomingLimit = 5, overdueLimit = 6 } = {}) {
  const fu = DATA.followups;
  el.innerHTML = `
    <div class="fu-group"><div class="fu-head overdue-head">Overdue <span class="count">${fu.overdue.length}</span></div>
      <ul class="fu-list">${fu.overdue.slice(0, overdueLimit).map((f) => followupItem(f, true)).join("")}</ul></div>
    <div class="fu-group"><div class="fu-head">Next 7 days <span class="count">${fu.upcomingTotal}</span></div>
      <ul class="fu-list">${fu.upcoming.slice(0, upcomingLimit).map((f) => followupItem(f, false)).join("")}</ul>
      <a class="more" href="#">Show all ${fu.upcomingTotal}</a></div>`;
  el.querySelectorAll(".fu-check").forEach((b) =>
    b.addEventListener("click", () => {
      const li = b.closest(".fu");
      li.classList.add("done");
      setTimeout(() => li.classList.add("gone"), 450);
    }),
  );
}

const KIND_LABEL = { call: "Call", email: "Email", note: "Note" };
function recent(el, { limit = 8 } = {}) {
  el.innerHTML = `<ul class="feed">${DATA.recent
    .slice(0, limit)
    .map((r) =>
      r.kind === "stage"
        ? `<li class="feed-item"><span class="feed-icon stage" style="--c:${STAGE[r.to].color}">${icon("stage", 15)}</span>
            <div class="feed-body"><div class="feed-text">Moved from ${STAGE[r.from].name} to <strong>${STAGE[r.to].name}</strong></div>
            <div class="feed-meta"><a href="#">${r.who}</a> · ${r.org}</div></div><time class="feed-time">${r.time}</time></li>`
        : `<li class="feed-item"><span class="feed-icon ${r.kind}">${icon(r.kind, 15)}</span>
            <div class="feed-body"><div class="feed-text"><strong>${KIND_LABEL[r.kind]}:</strong> ${r.text}</div>
            <div class="feed-meta"><a href="#">${r.who}</a> · ${r.org}</div></div><time class="feed-time">${r.time}</time></li>`,
    )
    .join("")}</ul>`;
}

// Fill [data-icon] placeholders and [data-fig] figures.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-icon]").forEach((e) => (e.innerHTML = icon(e.dataset.icon, +e.dataset.size || 18)));
  const figs = {
    openTotal: fmtUSD(DATA.openTotal),
    openCount: DATA.openCount,
    expected: fmtUSD(DATA.expected),
    wonTotal: fmtUSD(DATA.wonTotal),
    wonCount: DATA.wonCount,
    overdue: DATA.followups.overdue.length,
    upcoming: DATA.followups.upcomingTotal,
    wonThisMonth: fmtUSD(DATA.revenue[11]),
  };
  document.querySelectorAll("[data-fig]").forEach((e) => (e.textContent = figs[e.dataset.fig]));
});
