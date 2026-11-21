# Status

The MVP from `docs/plan.md` is built: all nine phases are done, and `npm test` passes.

## How to run it

You need Node 24 or later, [uv](https://docs.astral.sh/uv/) and Google Chrome.

| Command | What it does |
|---|---|
| `npm run dev` | Installs anything missing, starts the API (port 8000) and the web app (port 5173), and prints the address: http://localhost:5173. Ctrl+C stops both. |
| `npm run seed` | Resets the data to the sample data. Works while the app is running; refresh the browser afterwards. |
| `npm test` | Runs the backend tests (pytest), the frontend tests (Vitest) and the end-to-end tests (Playwright in Chrome). Every suite runs even if an earlier one fails, then a summary shows, and it exits with an error if any failed. |

- The first `npm run dev` needs the internet once, for `npm install` and for uv to fetch Python 3.12 and the backend packages. After that the app runs offline.
- The data lives in `data/accountable.db`, which git ignores. Set `ACCOUNTABLE_DB_PATH` to keep it somewhere else. The app creates and seeds the file if it's missing.
- `ACCOUNTABLE_API_PORT` and `ACCOUNTABLE_WEB_PORT` change the ports.
- The tests use their own database in the system temp folder and their own ports (8010 and 5180), so they never touch your data and can run while the app is open.

## Done

- **Plan, Design and Build docs.** `docs/intent.md`, `docs/spec.md` (mockup C chosen) and `docs/plan.md`.
- **Phase 1, skeleton and the one command.** `npm run dev` installs what's missing and starts both servers. Ctrl+C stops both on Windows, tested with a real Ctrl+C. The Midnight rail links to all eight routes.
- **Phase 2, database, rules and sample data.** SQLAlchemy Core tables, with foreign keys switched on for every connection, the exactly-one-link check on activities and the spec's indexes. `rules.py` holds the business rules. The seed is deterministic and relative to today: 25 organizations, 80 contacts, 67 deals with stage history, and 250 activities.
- **Phase 3, records API.** List, create, detail, update, delete and `delete-impact` for each record, with the three delete rules and the `409` for a contact on deals. Timelines, `move`, `GET /pipeline`, a `422` with a message for each field, and `404`s.
- **Phase 4, dashboard API.** Every figure is checked against a hand-worked dataset with a fixed today.
- **Phase 5, frontend foundations.** API client, query hooks, formatting, UI pieces, the data table, the delete confirmation and the four forms.
- **Phase 6, tables, record pages and activities.** Three tables (status tabs on contacts), three record pages with linked records, timelines with follow-up chips, and the deal page's stage control.
- **Phase 7, pipeline board.** dnd-kit board with pointer and keyboard moves (Space picks up, arrows move, Space drops, Enter opens). Totals update before the server answers, moves go one at a time, and a failed move rolls back.
- **Phase 8, dashboard.** Mockup C's layout, with tooltips and stage labels on every chart.
- **Phase 9, finish and check.** See below.

## Checks in Phase 9

- **Speed.** With 3,000 contacts, 3,000 deals and 5,000 activities, every list, the pipeline and the dashboard answer in under 0.1 s (`test_scale.py` allows 1 s). The board follows the spec's fallback (Concerns 9): Won and Lost show their 100 most recent cards by close date, with a link to the deals table filtered to that stage (`/deals?stage=won`), and open columns show every card. Column totals count every card. Measured with that test data, which has about 500 deals in every column, the board takes about 2.7 s to open and a drag about 3 s. Real pipelines with a few hundred open deals are much quicker. Capping the open columns too would bring both under 1 s, but the spec says every open card stays droppable, so that's a decision for the spec.
- **Order and state.** `npm test` ran twice in a row with the same result: 152 pytest, 53 Vitest and 32 Playwright tests passed.
- **Console.** Every end-to-end test fails on a console error or a failed API call. A scripted walk through the dashboard, forms, a drag, the delete dialogs, timelines and filtered tables logged no errors or warnings.

## Fixes from the first review

- The API refuses requests addressed to any host but `localhost` or `127.0.0.1`, which stops another website reading the data through DNS rebinding.
- Tables stay on the same page after a save or delete (moving back only if that page no longer has rows), and go back to page 1 when the sort, search or status tab changes.
- `npm run dev` installs npm packages again whenever a package file is newer than the last install.
- Websites starting `HTTPS://` (any case) are accepted.
- If seeding a new database fails, the half-made file is removed so the next start tries again.
- Searching for "No organization" finds the contacts and deals without one.

## Fixes from the second review

- The API no longer allows the test client's host name, `testserver`; the tests call it as `localhost`.
- Searching for "None" finds organizations with no industry or website.
- The board matches the spec: only Won and Lost are limited, to their 100 most recent cards, and open columns show every card.
- Each funnel bar shows its number of deals under the stage name.
- The board refetches after each move settles, as the plan says, not only once a run of moves has finished.
- The not-found and load-error states use the `EmptyState` component. The plan listed `Button` and `Select` components. Instead, buttons are CSS classes (`btn`, `btn-primary`) and the select is `SearchSelect.tsx`.

## Still to do

- **Success criterion 8 needs a person.** Someone should use the app end to end in Chrome with DevTools open, the way a salesperson would. The automated checks above don't replace that.
