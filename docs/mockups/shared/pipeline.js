// Pipeline board, view switching, toasts and the add-deal dialog for the mockups.
// Loaded after mockup.js, which holds DEALS, STAGE and the formatters.

const STAGE_ORDER = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const CONTACTS = [...new Map(DEALS.map((d) => [d.contact, d.org])).entries()].sort();
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const initials = (n) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);

// Toasts
function toast(msg) {
  let box = document.querySelector(".toasts");
  if (!box) {
    box = document.createElement("div");
    box.className = "toasts";
    box.setAttribute("role", "status");
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3600);
}

// Board
let boardEl = null;
let totalsEl = null;
let dragId = null;

function columnStats(stage) {
  const ds = DEALS.filter((d) => d.stage === stage);
  return {
    count: ds.length,
    value: ds.reduce((s, d) => s + d.value, 0),
    expected: ds.reduce((s, d) => s + (d.value * d.prob) / 100, 0),
  };
}

function renderTotals() {
  if (!totalsEl) return;
  const open = OPEN_STAGES.map(columnStats).reduce(
    (a, c) => ({ count: a.count + c.count, value: a.value + c.value, expected: a.expected + c.expected }),
    { count: 0, value: 0, expected: 0 },
  );
  totalsEl.innerHTML = `
    <div class="bt"><span class="bt-l">Open pipeline</span><span class="bt-v num">${fmtUSD(open.value)}</span></div>
    <div class="bt"><span class="bt-l">Expected revenue</span><span class="bt-v num">${fmtUSD(open.expected)}</span></div>
    <div class="bt"><span class="bt-l">Open deals</span><span class="bt-v num">${open.count}</span></div>
    <div class="bt-note">Won and Lost aren't counted</div>`;
}

function cardHTML(d) {
  const late = isLate(d);
  const manual = d.prob !== DEFAULT_PROB[d.stage];
  return `<article class="card card-${d.stage}${late ? " late" : ""}" draggable="true" data-id="${d.id}" tabindex="0" aria-label="${d.name}, ${fmtUSD(d.value)}">
    <div class="card-name">${d.name}</div>
    <div class="card-org">${d.org}</div>
    <div class="card-row">
      <span class="card-value num">${fmtUSD(d.value)}</span>
      <span class="card-right">${late ? '<span class="badge badge-raspberry">Late</span>' : ""}<span class="card-prob num" title="${manual ? "Probability set by hand" : "Usual probability for this stage"}">${d.prob}%${manual ? "*" : ""}</span></span>
    </div>
    <div class="card-foot">
      <span class="card-contact"><span class="av">${initials(d.contact)}</span>${d.contact}</span>
      <span class="card-date num" title="Close date ${fmtDate(d.close)}, ${d.close.slice(0, 4)}">${fmtDate(d.close)}</span>
    </div>
  </article>`;
}

function renderBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = STAGE_ORDER.map((stage) => {
    const st = columnStats(stage);
    const ds = DEALS.filter((d) => d.stage === stage);
    return `<section class="col col-${stage}" data-stage="${stage}" aria-label="${STAGE[stage].name}">
      <header class="col-head">
        <div class="col-title"><span class="dot" style="background:${STAGE[stage].color}"></span>${STAGE[stage].name}<span class="col-count num">${st.count}</span>
          <button class="col-add" data-stage="${stage}" aria-label="Add a deal in ${STAGE[stage].name}">${icon("plus", 15)}</button></div>
        <div class="col-figs"><span class="num">${fmtUSD(st.value)}</span><span class="col-exp">Expected <span class="num">${fmtUSD(st.expected)}</span></span></div>
      </header>
      <div class="col-list">${ds.map(cardHTML).join("") || '<div class="col-empty">Drop a deal here</div>'}</div>
    </section>`;
  }).join("");
  renderTotals();
  wireBoard();
}

function placeholder() {
  let p = boardEl.querySelector(".ph");
  if (!p) {
    p = document.createElement("div");
    p.className = "ph";
  }
  return p;
}

function wireBoard() {
  boardEl.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("dragstart", (e) => {
      dragId = +c.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", c.dataset.id);
      placeholder().style.height = c.offsetHeight + "px";
      requestAnimationFrame(() => c.classList.add("dragging"));
    });
    c.addEventListener("dragend", () => {
      c.classList.remove("dragging");
      boardEl.querySelector(".ph")?.remove();
      boardEl.querySelectorAll(".col.over").forEach((x) => x.classList.remove("over"));
    });
    c.addEventListener("click", () => toast(`The deal page for "${DEALS.find((d) => d.id === +c.dataset.id).name}" opens here.`));
  });
  boardEl.querySelectorAll(".col").forEach((col) => {
    const list = col.querySelector(".col-list");
    col.addEventListener("dragover", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      boardEl.querySelectorAll(".col.over").forEach((x) => x !== col && x.classList.remove("over"));
      col.classList.add("over");
      const cards = [...list.querySelectorAll(".card:not(.dragging)")];
      const after = cards.find((k) => e.clientY < k.getBoundingClientRect().top + k.offsetHeight / 2);
      const ph = placeholder();
      list.querySelector(".col-empty")?.remove();
      if (after) list.insertBefore(ph, after);
      else list.appendChild(ph);
    });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      const ph = boardEl.querySelector(".ph");
      const index = [...list.children].filter((k) => k.classList.contains("card") && !k.classList.contains("dragging") || k === ph).indexOf(ph);
      moveDeal(dragId, col.dataset.stage, Math.max(0, index));
      dragId = null;
    });
  });
  boardEl.querySelectorAll(".col-add").forEach((b) => b.addEventListener("click", () => openAdd(b.dataset.stage)));
}

function moveDeal(id, stage, index) {
  const d = DEALS.find((x) => x.id === id);
  const from = d.stage;
  DEALS.splice(DEALS.indexOf(d), 1);
  if (from !== stage) {
    d.stage = stage;
    d.prob = DEFAULT_PROB[stage];
    if (stage === "won" || stage === "lost") d.close = TODAY;
  }
  // Insert at the index within the target column.
  const inCol = DEALS.filter((x) => x.stage === stage);
  const before = inCol[index];
  DEALS.splice(before ? DEALS.indexOf(before) : DEALS.length, 0, d);
  renderBoard();
  if (from !== stage) {
    if (stage === "won" || stage === "lost")
      toast(`${d.name} marked as ${stage}. Close date set to ${fmtDate(TODAY)}, ${TODAY.slice(0, 4)}.`);
    else toast(`${d.name} moved from ${STAGE[from].name} to ${STAGE[stage].name}. Probability now ${d.prob}%.`);
  }
}

// Add-deal dialog, opened from a column with the stage already set.
function openAdd(stage) {
  let dlg = document.getElementById("add-deal");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "add-deal";
    dlg.className = "dlg";
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = `<form method="dialog" class="dlg-form">
    <h2 class="dlg-title">New deal</h2>
    <p class="dlg-sub">Starts in <strong>${STAGE[stage].name}</strong>, at ${DEFAULT_PROB[stage]}% probability of close.</p>
    <label>Deal name<input name="name" required placeholder="e.g. Analytics rollout"></label>
    <label>Main contact<select name="contact" required>${CONTACTS.map(([c, o]) => `<option value="${c}">${c} (${o})</option>`).join("")}</select></label>
    <label>Organization<input name="org" readonly></label>
    <div class="dlg-two">
      <label>Value (USD)<input name="value" type="number" min="0" step="500" required value="25000"></label>
      <label>Close date<input name="close" type="date" required value="2027-01-15"></label>
    </div>
    <div class="dlg-actions"><button type="button" class="btn btn-quiet" data-cancel>Cancel</button><button class="btn btn-primary">Add deal</button></div>
  </form>`;
  const f = dlg.querySelector("form");
  const syncOrg = () => (f.org.value = CONTACTS.find(([c]) => c === f.contact.value)[1]);
  f.contact.addEventListener("change", syncOrg);
  syncOrg();
  dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = {
      id: Math.max(...DEALS.map((x) => x.id)) + 1,
      stage, name: f.name.value.trim(), org: f.org.value, contact: f.contact.value,
      value: +f.value.value, close: (stage === "won" || stage === "lost") ? TODAY : f.close.value, prob: DEFAULT_PROB[stage],
    };
    const first = DEALS.find((x) => x.stage === stage);
    DEALS.splice(first ? DEALS.indexOf(first) : DEALS.length, 0, d);
    dlg.close();
    renderBoard();
    toast(`${d.name} added to ${STAGE[stage].name}.`);
  });
  dlg.showModal();
  f.name.focus();
}

// Views: links with data-view switch between the dashboard and the board; the hash keeps it on refresh.
function showView() {
  const view = location.hash === "#pipeline" ? "pipeline" : "dashboard";
  document.body.dataset.view = view;
  document.querySelectorAll("[data-view-panel]").forEach((p) => (p.hidden = p.dataset.viewPanel !== view));
  document.querySelectorAll("[data-view]").forEach((a) => {
    const on = a.dataset.view === view;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  window.dispatchEvent(new Event("resize"));
}

document.addEventListener("DOMContentLoaded", () => {
  boardEl = document.getElementById("board");
  totalsEl = document.getElementById("board-totals");
  renderBoard();
  document.querySelectorAll("[data-view]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = a.dataset.view === "pipeline" ? "pipeline" : "";
    }),
  );
  document.querySelectorAll("[data-soon]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      toast(`${a.textContent.trim()} isn't part of these mockups.`);
    }),
  );
  document.querySelectorAll("[data-goto]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = a.dataset.goto;
    }),
  );
  window.addEventListener("hashchange", showView);
  showView();
});
