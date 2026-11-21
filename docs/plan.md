# Plan: building the Accountable MVP

This is how we build what `docs/spec.md` describes, which in turn delivers `docs/intent.md`. The look follows mockup C (`docs/mockups/c-command.html`) and the brand skill.

The work runs in nine phases. Each phase:
- ends with `npm test` passing, so nothing half-done carries forward;
- is a commit point;
- updates `docs/STATUS.md` with what now works.

## Files that change

Nothing exists yet apart from the docs, so almost every file is new. `README.md` stays as it is.

### Root

| File | What it holds |
|---|---|
| `package.json` | npm workspace (`frontend`), the scripts `dev`, `test`, `seed`, and the sub-scripts `test:backend`, `test:frontend`, `test:e2e` |
| `package-lock.json` | npm lock file |
| `pyproject.toml`, `uv.lock`, `.python-version` | Python 3.12 project for the backend: FastAPI, Uvicorn, SQLAlchemy, Pydantic; dev group with pytest and httpx. Added with `uv add` |
| `scripts/dev.mjs` | The one command. Node built-ins only. Installs what's missing, starts the API and Vite, and stops both on Ctrl+C on Mac, Linux and Windows |
| `playwright.config.ts` | End-to-end tests against the installed Chrome (`channel: "chrome"`). Starts its own servers on separate ports with a temporary database |
| `.gitignore` | Add `data/` |
| `docs/STATUS.md` | How to run it, and what's done, updated each phase |

### Backend (`backend/`)

Organized as a Python package, `backend.app`.

| File | What it holds |
|---|---|
| `backend/app/main.py` | FastAPI app. Mounts the routers under `/api`. On startup, creates and seeds the database if the file doesn't exist |
| `backend/app/config.py` | Settings from the environment: `ACCOUNTABLE_DB_PATH` (default `data/accountable.db`) and `ACCOUNTABLE_API_PORT` |
| `backend/app/clock.py` | `today()` and `now()` in local time, in one place, so tests can fix the date |
| `backend/app/db.py` | Engine, the SQLAlchemy Core tables, indexes, the check constraint on activities, and foreign keys switched on for every connection |
| `backend/app/rules.py` | Pure functions with no database: stage defaults, open and late, expected revenue, what a stage change does, card reordering, funnel counting |
| `backend/app/schemas.py` | Pydantic request and response models, with validation messages written for people |
| `backend/app/queries/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `timeline.py`, `dashboard.py` | Reads and writes with SQLAlchemy Core. Each user action runs in one transaction |
| `backend/app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `pipeline.py`, `dashboard.py` | The endpoints in the spec's API table, including `delete-impact` and `move` |
| `backend/app/seed.py` | Deterministic sample data with dates relative to today. Run as `uv run python -m backend.app.seed`, which `npm run seed` calls |
| `backend/tests/conftest.py` | Temporary database per test, a test client, a fixed "today", and small builders for records |
| `backend/tests/test_*.py` | See Proof |

### Frontend (`frontend/`)

Built with React, Vite and TypeScript.

| File | What it holds |
|---|---|
| `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | Vite app. Proxies `/api` to the backend, reads `ACCOUNTABLE_WEB_PORT` and `ACCOUNTABLE_API_PORT`. Vitest config lives in `vite.config.ts` |
| `src/main.tsx`, `src/App.tsx` | React Router routes, TanStack Query provider, toasts |
| `src/styles/tokens.css`, `global.css` | Brand tokens from the spec, fonts from `@fontsource`, base type |
| `src/api/client.ts`, `types.ts`, `queries.ts` | Fetch wrapper that turns `422` and `409` into usable errors, shared types, and query/mutation hooks |
| `src/lib/format.ts`, `dates.ts`, `stages.ts` | Money and date formatting, late and overdue logic, stage names, colors and default probabilities |
| `src/components/layout/Rail.tsx`, `AppShell.tsx` | The Midnight rail and the page frame |
| `src/components/ui/` | Panel, Button, Badge, StageBadge, Dialog, Select, Toggle and EmptyState, on Radix primitives |
| `src/components/DataTable.tsx` | TanStack Table with search, sorting, 50-row pages and row actions |
| `src/components/ConfirmDelete.tsx` | Reads `delete-impact` and writes the right sentence; blocks a contact who is on deals |
| `src/components/forms/OrganizationForm.tsx`, `ContactForm.tsx`, `DealForm.tsx`, `ActivityForm.tsx` | React Hook Form and Zod; the deal form's contact-to-organization fill and its stage defaults |
| `src/components/Timeline.tsx` | Timeline entries, follow-up chips, edit and delete |
| `src/components/charts/RevenueLine.tsx`, `DealsWonBars.tsx`, `Funnel.tsx`, `StageBar.tsx` | Recharts, styled as in mockup C, with tooltips and stage labels |
| `src/pages/Dashboard.tsx`, `YourDay.tsx` | The dashboard and its right-hand column |
| `src/pages/Pipeline.tsx`, `pipeline/Column.tsx`, `pipeline/DealCard.tsx`, `pipeline/boardState.ts` | The board, with dnd-kit, optimistic moves and totals |
| `src/pages/Organizations.tsx`, `OrganizationPage.tsx`, `Contacts.tsx`, `ContactPage.tsx`, `Deals.tsx`, `DealPage.tsx`, `NotFound.tsx` | The tables and record pages |
| `src/**/*.test.ts(x)` | See Proof |

### End-to-end tests (`e2e/`)

| File | What it holds |
|---|---|
| `e2e/fixtures.ts` | Fails any test on a browser console error or a failed `/api` request. Helpers to create records with unique names and to drag a card step by step |
| `e2e/global-setup.ts` | Seeds the test database before the run |
| `e2e/*.spec.ts` | See Proof |

## Order of work

### Phase 1: Skeleton and the one command

- Set up the root `package.json` with the workspace, `pyproject.toml` through `uv init` and `uv add`, the Vite React TypeScript app, and `scripts/dev.mjs`.
- Add a `GET /api/health` endpoint.
- Add the app shell: the Midnight rail, all eight routes with placeholder pages, and the fonts and tokens.
- Get one test running in each of pytest, Vitest and Playwright, so that `npm test` runs all three and fails if any fails.

**Done when:** from a fresh clone, `npm run dev` installs everything, prints the address, and shows the rail with working navigation in Chrome. Ctrl+C stops both servers on Windows. `npm test` passes.

### Phase 2: Database, rules and sample data

- Write the tables, constraints and indexes from the spec's data model, with foreign keys switched on for every connection.
- Write `clock.py` and `rules.py`.
- Write `seed.py` to the spec's sample-data description. `npm run seed` resets the data, and the app seeds itself when the database file is missing.

**Done when:** the rule and seed tests pass, and `npm run seed` followed by `npm run dev` leaves a full database.

### Phase 3: Records API

- Build the organizations, contacts, deals and activities endpoints: list, create, detail, update and delete.
- Add `delete-impact` for each, with the three delete rules and the `409` for a contact who is on deals.
- Add the timeline in the contact and deal details, including the contact's deal entries.
- Add `POST /deals/{id}/move` and `GET /pipeline`, with ordering, totals, and stage-change rows.
- Return `422` with a message for each field, and `404` for missing records.

**Done when:** the API tests pass.

### Phase 4: Dashboard API

- Build `GET /api/dashboard`: the figures, the 12 monthly rows, the funnel from stage history, the open value by stage, overdue and coming-up follow-ups, and the latest 10 timeline entries.

**Done when:** every figure matches a hand-worked small dataset with a fixed "today".

### Phase 5: Frontend foundations

- Write the API client, query hooks and formatters.
- Build the UI pieces: Panel, Badge, Dialog, toasts, DataTable and ConfirmDelete.
- Build the four forms with validation and server error display.

**Done when:** the Vitest tests for formatting, dates, stage defaults and the deal form pass.

### Phase 6: Tables, record pages and activities

- Build the Organizations, Contacts (with status tabs) and Deals tables, with add, edit and delete.
- Build the three record pages with their linked records.
- On contacts and deals, add the timeline, Log activity, and follow-up chips that toggle done.
- Add the deal page's stage control.

**Done when:** the e2e tests for records, deletes, the status filter, linked records and activities pass, and every page looks right next to mockup C's style.

### Phase 7: Pipeline board

- Build the six columns with dnd-kit across multiple containers: drag between and within columns, and keyboard drag.
- Update totals optimistically and roll back if the server call fails.
- Add a deal from a column, and show toasts for stage moves.
- Make cards match mockup C, including Late badges and the `*` on a probability set by hand.

**Done when:** the pipeline e2e tests pass, including after a refresh.

### Phase 8: Dashboard

- Lay out mockup C: the three-part figures panel, both "won" charts in one panel, the funnel and stage bar, and the "Your day" column with follow-up counts, the follow-up list and recent activity.
- Give every chart tooltips and stage labels, as in the spec's Charts section.

**Done when:** the dashboard e2e tests pass, and the page side by side with `docs/mockups/c-command.html` matches in layout, color and type.

### Phase 9: Finish and check

- Time the list, pipeline and dashboard endpoints against a database with a few thousand rows.
- Run the full test suite twice in a row to catch tests that depend on order or state.
- Write the run instructions in `docs/STATUS.md`.
- Walk through every section and action in Chrome as a salesperson would, with DevTools open. That is success criterion 8.

**Done when:** `npm test` passes, the walk-through finds nothing outstanding, and the console is clean.

## Risks

1. **The one command on Windows.** Starting and stopping two servers from Node behaves differently on Windows: Ctrl+C may not reach Uvicorn's child process, which then leaves the port taken. `dev.mjs` will start children without a shell and, on Windows, stop the process tree with `taskkill /T`. This gets tested on this machine in Phase 1, before anything else is built on it.
2. **First run needs the internet.** `npm install`, `uv sync`, and uv downloading Python 3.12 all need a connection once. After that the app runs offline, as the intent requires. `STATUS.md` will say so.
3. **"No raw SQL" and SQLite foreign keys.** SQLite ignores foreign keys unless each connection runs `PRAGMA foreign_keys = ON`. That is one fixed statement in a connection event hook, and it is the only SQL string in the project. Everything else is SQLAlchemy Core. Without it, the delete rules silently don't work.
4. **Dates shifting by a day.** In JavaScript, `new Date("2026-11-21")` is read as UTC, which shows as the day before in timezones behind UTC. Dates stay as `YYYY-MM-DD` strings and are compared as strings. Formatting uses date-fns' `parseISO`, which reads them as local. The backend alone decides what "today" is.
5. **Dragging in Playwright.** dnd-kit listens to pointer events with an activation distance, so Playwright's `dragTo` can miss it. The e2e helper presses, moves in small steps, and releases. The keyboard sensor is a second route if that proves flaky.
6. **Optimistic board updates.** Two quick drags can reach the server out of order. Moves are queued, one at a time, and the board refetches after each one settles. If a move fails, the board goes back to the server's state and an error shows.
7. **Tests that depend on the sample data.** The seed is relative to today, so totals change from day to day and around month ends. Tests assert relationships, such as "the dashboard total equals the sum of open deals in the API", or they create their own records with unique names. Exact figures are only tested in pytest against a fixed dataset and date.
8. **End-to-end tests sharing one database.** The tests run with one worker at first, so they don't step on each other. Making them parallel is the course's optional step, which needs a server and database per worker.
9. **Console errors.** Success criterion 8 needs a clean console. The e2e fixture fails on any console error, so React key warnings, failed requests and chart warnings get caught early, not in the final walk-through.
10. **Big Won and Lost columns.** These are covered in the spec's Concerns 9. Phase 9 measures them, and the fallback of the most recent 100 cards is only built if needed.
11. **The funnel depends on stage history.** If the seed leaves out stage-change rows, the funnel shows almost nothing in the later stages. A seed test checks that every deal beyond New has a history that fits its stage.
12. **Brand colors in charts.** These are covered in the spec's Charts section. Every stage mark has a text label, so colors that are close don't cause confusion.

## Proof

`npm test` runs everything below and fails if anything fails. The tests use their own temporary database, set with `ACCOUNTABLE_DB_PATH`, so they never touch your data.

### Backend unit tests (pytest, `backend/tests/`)

- **`test_rules.py`**
  - Each stage's usual probability.
  - Open and late, with a deal due yesterday, today and tomorrow, and Won and Lost never late.
  - Expected revenue.
  - A stage change resets the probability unless one is given with it, and sets the close date to today for Won or Lost unless one is given.
  - Leaving Won keeps the close date.
  - Card reordering: to the top, the middle and the end, within a column and between columns.
  - The funnel: open deals count up to their stage, Won counts at every stage, and Lost counts up to the furthest stage reached.
- **`test_organizations.py`**
  - Create, read, update, list counts, `404`.
  - The delete keeps the organization's contacts and deals, and sets their organization to null.
  - `delete-impact` counts.
- **`test_contacts.py`**
  - Create requires an organization.
  - Status values.
  - Delete is blocked with `409` while the contact is on deals, and `delete-impact` lists those deals.
  - Delete goes ahead and removes the contact's activities once the deals have another contact.
  - The timeline includes the contact's deals' activities and stage changes, labelled with the deal, newest first.
- **`test_deals.py`**
  - Create requires a contact; the organization is optional.
  - A new deal takes its stage's probability and goes to the top of its column.
  - Editing other fields leaves stage, probability and close date alone.
  - A stage change through PATCH writes a stage-change row.
  - Delete removes the deal's activities and stage changes.
  - The `late` flag in the list.
- **`test_pipeline.py`**
  - `move` between and within columns, then reading back the order from `GET /pipeline`.
  - Moving to Won sets today's close date and takes the deal out of the board totals.
  - Column and board totals.
- **`test_activities.py`**
  - Exactly one of contact or deal; neither or both is `422`.
  - Edit, including `done`.
  - Delete.
  - Follow-up states: overdue, coming up, beyond 7 days, done.
- **`test_dashboard.py`** uses a hand-built dataset and a fixed today, and checks:
  - the figures;
  - 12 months, including months with nothing won;
  - the funnel and the open value by stage;
  - follow-up groups and their order;
  - the latest 10 entries, mixing activities and stage changes.

  It also checks that winning a deal and adding a follow-up change the figures.
- **`test_validation.py`:** `422` with a message for each field, for each record type, covering blank names, a bad email, a website without `http`, a negative value, probability outside 0 to 100, and an unknown stage or status.
- **`test_seed.py`:**
  - The seed runs twice with identical results.
  - Every stage, status and activity type is present.
  - There are late deals, overdue follow-ups and follow-ups coming up.
  - Every month of the last 12 has a win.
  - Every deal has a stage history that fits its stage.
  - Deal values are between $5,000 and $150,000.
- **`test_persistence.py`:** data written through one app instance is read back by a fresh app instance pointed at the same file, which stands in for a restart. The app seeds a missing database on startup and leaves an existing one alone.
- **`test_scale.py`:** with 3,000 contacts, 3,000 deals and 5,000 activities, the list, pipeline and dashboard endpoints each answer in under one second.

### Frontend unit tests (Vitest, `frontend/src/`)

- **`lib/format.test.ts`:** `$12,500`, `$1.2M` and `$40k` short forms, `$0`, and US date formats.
- **`lib/dates.test.ts`:**
  - Late and overdue around today.
  - Coming up within 7 days, inclusive.
  - Date strings never shift by a day, tested with a timezone behind UTC.
- **`lib/stages.test.ts`:** stage order, colors and default probabilities.
- **`components/forms/DealForm.test.tsx`:**
  - Picking a contact fills in the organization, which can then be changed.
  - Changing the stage resets the probability.
  - Picking Won or Lost fills in today's date.
  - Opening from a column presets the stage.
  - Server `422` messages show next to their fields.
- **`components/DataTable.test.tsx`:** search across the shown columns, ignoring case; heading clicks cycle the sort order; 50-row pages and the row count.
- **`components/ConfirmDelete.test.tsx`:** the right sentence for each kind of record, and the blocked contact with linked deals and the delete button disabled.
- **`pages/pipeline/boardState.test.ts`:**
  - An optimistic move updates the columns, the order and the totals straight away.
  - A failed move rolls back.
  - Won and Lost stay out of the board totals.

### End-to-end tests (Playwright Test with Chrome, `e2e/`)

Each one maps to a success criterion in the intent. All of them fail on any console error.

- **`start.spec.ts`** (criterion 1): the app opens on the dashboard, and every section shows sample data.
- **`organizations.spec.ts`, `contacts.spec.ts`, `deals.spec.ts`** (criterion 2): for each kind of record:
  - add one, find it by searching, sort by a column, edit it, and refresh to see the change kept;
  - delete it with the right confirmation text;
  - for an organization, check that its contacts and deals now show "No organization";
  - for a contact on a deal, check the delete is blocked until the deal has another contact, then deletes.
- **`contacts.spec.ts`** (criterion 3): the status tabs filter the table and combine with search.
- **`linked.spec.ts`** (criterion 3): each organization, contact and deal page shows its linked records, and the links go to the right pages.
- **`pipeline.spec.ts`** (criterion 4):
  - Drag a deal to another column, and check that its stage and probability change on the board and in the deals table.
  - Drag one within its column, refresh, and check the order is kept.
  - Board and column totals change as soon as the card drops.
  - A deal added from a column starts in that column.
  - Late cards show "Late".
  - Dragging to Won gives today's close date and drops the deal out of the open totals.
- **`activities.spec.ts`** (criterion 5):
  - Log a note, a call and an email with a follow-up on a contact and on a deal, and check they appear in the timelines newest first.
  - A stage change appears as "Moved from ... to ...".
  - The follow-up shows on the dashboard as coming up, or as overdue for a past date, until it is marked done.
- **`dashboard.spec.ts`** (criteria 6 and 7):
  - The figures match the API's data.
  - Marking a deal won and adding a follow-up change the dashboard.
  - The line chart, the bar chart, the funnel and the stage bar are all there, with tooltips on hover.
- **`reset.spec.ts`** (criterion 2): after a change, running the seed brings back the sample data.

### Checks by eye (criteria 7 and 8)

- **During Test:** screenshots of each page, taken with Playwright, are compared with mockup C and the brand skill.
- **Before calling it done:** someone uses the app end to end in Chrome, the way a salesperson would. That means every section and every action above, with DevTools open and no console errors, and each screen checked by eye. Passing tests is necessary but not enough.
