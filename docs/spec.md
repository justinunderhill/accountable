# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements and a design that can be built and tested. The intent says what we're building and why. This file says exactly how it behaves and how it looks. The look follows the brand skill (`.claude/skills/brand/SKILL.md`). The stack follows `docs/TECH_STACK.md`.

## Concerns

These are the gaps and conflicts I found, with the choice this spec makes for each. Any of them can be changed before Build.

1. **Fonts and working offline.** The brand's fonts come from Google Fonts, but the app has to work with no internet connection. This spec serves the same fonts from the app itself, using the `@fontsource` npm packages, so nothing loads from Google at runtime.
2. **"One command" versus installing dependencies.** `npm run dev` normally needs `npm install` first. This spec makes `npm run dev` a small Node script that has no dependencies of its own. On first run it installs what's missing (`npm install`, and `uv sync` through `uv run`), then starts both servers. The only prerequisites are Node 24 or later, uv and Chrome.
3. **Six stages, five brand colors.** The brand gives five colors for things side by side. Mapping them by meaning reads better than mapping them by order, so the stages are colored like this:
   - New: Cerulean
   - Qualified: Marigold
   - Proposal: Coral
   - Negotiation: Midnight
   - Won: Sea Green
   - Lost: Sea Mist grey

   Raspberry is kept for things that need attention, such as late deals and overdue follow-ups.
4. **Contrast.** White text on Cerulean (about 4.0:1) and on Raspberry (about 3.6:1) is below the WCAG AA minimum of 4.5:1 for small text. Badges and small text therefore use a pale tint of the color with darker text in the same hue. Solid Cerulean and Raspberry fills only carry semibold text of 15px or more. The darker shades are listed under Design. The same applies to Sea Green, Marigold and Coral text on white, as the brand itself says.
5. **Leaving Won or Lost.** The intent says moving into Won or Lost sets the close date to today, but it doesn't say what happens when a deal moves back out. This spec keeps the close date as it is. The deal then counts as late from tomorrow, which prompts the user to set a new expected date.
6. **Where an activity belongs.** The intent says an activity relates to "the contact or deal". This spec links each activity to exactly one of them. A contact's timeline also shows the activities and stage changes of the deals where they are the main contact, each labelled with the deal's name. Without that, a call logged on a deal wouldn't show up on the person's timeline, and "everything that has happened with them" would be incomplete.
7. **What the funnel counts.** "How much value reaches each stage" is counted from stage history:
   - A deal counts toward every open stage it has reached, either because it is there now or because it has a stage-change entry into that stage.
   - A deal now in Won counts toward every stage, Won included.
   - A Lost deal counts up to the furthest stage it reached.

   The sample data therefore includes stage history for every deal that isn't in New.
8. **Editing the stage in a form.** A probability set by hand is kept until the stage changes. In the deal form, picking a new stage resets the probability field to that stage's usual figure, and the user can then overwrite it before saving. Picking Won or Lost in the form also fills in today's date as the close date, which can likewise be changed before saving.
9. **Big Won and Lost columns.** With a few thousand deals, the Won and Lost columns could each hold hundreds of cards. Every column scrolls on its own, and cards are kept simple enough to render quickly. If that proves slow during Build, the fallback is to show the most recent 100 cards in Won and Lost, with a link to the deals table filtered to that stage.
10. **Money format.** Every amount is in US dollars, so amounts are shown as `$12,500`. Dashboard tiles may shorten amounts to `$1.2M`, with the full figure in a tooltip. Column headings that hold money say `(USD)`.
11. **"Today".** The app runs on one computer, so "today" means that computer's local date. The backend works it out, and the frontend never sends it.

## Scope

In scope is everything in `docs/intent.md`: five sections, four kinds of record, activities with follow-ups, stage-change entries, sample data, a reset command and persistence. The intent's "Not in the MVP" list stands as written.

## Data model

The database is a single SQLite file defined with SQLAlchemy Core tables in `backend/`. All writes for one user action happen in a single transaction. Times are stored in ISO 8601 format, in local time. Dates are stored as `YYYY-MM-DD`.

### organizations

| Column | Type | Rules |
|---|---|---|
| id | integer | primary key |
| name | text | required, 1 to 200 characters |
| website | text | optional, must start with `http://` or `https://` (the form adds `https://` if it's missing) |
| industry | text | optional, free text; the form suggests industries already in use |
| notes | text | optional |
| created_at, updated_at | datetime | set by the server |

### contacts

| Column | Type | Rules |
|---|---|---|
| id | integer | primary key |
| name | text | required |
| email | text | optional, valid email format |
| phone | text | optional |
| job_title | text | optional |
| organization_id | integer, nullable | foreign key to organizations, `ON DELETE SET NULL`; required by the API on create and update |
| status | text | `lead`, `qualified` or `customer`; defaults to `lead` |
| created_at, updated_at | datetime | set by the server |

### deals

| Column | Type | Rules |
|---|---|---|
| id | integer | primary key |
| name | text | required |
| organization_id | integer, nullable | foreign key, `ON DELETE SET NULL`; optional |
| contact_id | integer | foreign key, `ON DELETE RESTRICT`; required |
| stage | text | `new`, `qualified`, `proposal`, `negotiation`, `won` or `lost` |
| value_cents | integer | required, 0 or more; entered and shown in whole dollars |
| probability | integer | 0 to 100 |
| close_date | date | required; the expected close date while open, and the actual date once Won or Lost |
| position | integer | the card's order within its stage column, where 0 is the top |
| created_at, updated_at | datetime | set by the server |

### activities

| Column | Type | Rules |
|---|---|---|
| id | integer | primary key |
| type | text | `note`, `call` or `email` |
| description | text | required |
| occurred_at | datetime | required; defaults to now in the form |
| follow_up_date | date, nullable | optional |
| done | boolean | defaults to false; only meaningful when a follow-up date is set |
| contact_id | integer, nullable | foreign key, `ON DELETE CASCADE` |
| deal_id | integer, nullable | foreign key, `ON DELETE CASCADE` |
| created_at, updated_at | datetime | set by the server |

A check constraint makes sure exactly one of `contact_id` and `deal_id` is set.

### stage_changes

| Column | Type | Rules |
|---|---|---|
| id | integer | primary key |
| deal_id | integer | foreign key, `ON DELETE CASCADE` |
| from_stage, to_stage | text | stage values |
| changed_at | datetime | set by the server |

Foreign keys are switched on for every SQLite connection (`PRAGMA foreign_keys = ON`). There are indexes on every foreign key, on `deals(stage, position)` and on `activities(follow_up_date, done)`.

## Business rules

### Stages and probability

| Stage | Usual probability | Open? |
|---|---|---|
| New | 10% | yes |
| Qualified | 25% | yes |
| Proposal | 50% | yes |
| Negotiation | 75% | yes |
| Won | 100% | no |
| Lost | 0% | no |

- A new deal takes its stage's usual probability unless one is given.
- Whenever the stage changes, by drag or by form, the server does the following in one transaction:
  - It records a `stage_changes` row.
  - It sets the probability to the new stage's usual figure, unless the same request also sets a probability.
  - If the new stage is Won or Lost, it sets the close date to today, unless the same request also sets a close date.
- Editing other fields never changes the stage, the probability or the close date by itself.
- Nothing else changes automatically. In particular, the contact's status stays as it is.

### Derived figures

- **Expected revenue** of a deal = value × probability / 100.
- **Open** deals are those in New, Qualified, Proposal or Negotiation.
- **Late**: an open deal whose close date is before today.
- **Open pipeline** = the sum of values of open deals. **Expected revenue (pipeline)** = the sum of expected revenue of open deals.
- **Won in a month**: deals in Won whose close date falls in that calendar month. Revenue won is the sum of their values.
- **Follow-ups**: activities with a follow-up date that aren't done.
  - **Overdue**: the follow-up date is before today.
  - **Coming up**: the follow-up date is from today to 7 days from today, inclusive.

### Card order

- Each stage column is ordered by `position`.
- A move gives the target stage and the index the card was dropped at. The server takes the card out of its old column, inserts it at that index in the new one, and renumbers both columns from 0 in the same transaction.
- A new deal, whether added from a column or from anywhere else, goes to the top of its stage's column.

### Deleting

Before the confirm dialog opens, the frontend asks the server what the delete would affect (`GET .../delete-impact`). The dialog then says so in plain words.

- **Organization:** for example, "Acme Corp will be deleted. Its 4 contacts and 3 deals will be kept, with no organization." Confirming deletes the organization, and its contacts and deals have their `organization_id` set to null.
- **Contact who is the main contact on deals:**
  - The dialog says "Maria Lopez is the main contact on 2 deals. Give each deal another contact before deleting Maria Lopez." Dialog copy always repeats the name and never uses a pronoun.
  - It lists the deals as links, and the delete button is disabled.
  - The server also refuses the delete with `409` if it's attempted anyway.
- **Contact with no deals:** for example, "Maria Lopez will be deleted, along with 6 activities." The contact goes, along with their activities.
- **Deal:** for example, "Website redesign, its 5 activities and its stage history will be deleted."
- **Activity:** "This activity will be deleted."

Every delete is permanent. There is no undo.

## API

The API is JSON under `/api`, served by FastAPI, with request and response models in Pydantic.

- Lists return every row, which is fine at a few thousand rows. Search, sort and paging happen in the browser.
- Validation errors return `422`, with a message for each field, and the form shows each message next to its field.
- A missing record returns `404`.

| Method and path | Purpose |
|---|---|
| `GET /api/organizations` | List, with counts of contacts and open deals |
| `POST /api/organizations` | Create |
| `GET /api/organizations/{id}` | Detail, with its contacts and deals |
| `PATCH /api/organizations/{id}` | Update |
| `DELETE /api/organizations/{id}` | Delete (contacts and deals are kept) |
| `GET /api/organizations/{id}/delete-impact` | Counts for the confirm dialog |
| `GET /api/contacts` | List, with organization name |
| `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` | As above. The detail includes the organization, deals as main contact and the timeline |
| `GET /api/contacts/{id}/delete-impact` | Blocking deals, or the activity count |
| `GET /api/deals` | List, with organization and contact names, expected revenue and `late` |
| `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` | As above. The detail includes the timeline |
| `GET /api/deals/{id}/delete-impact` | Counts of activities and stage changes |
| `POST /api/deals/{id}/move` | Body `{stage, index}`. Moves the card and applies the stage rules |
| `POST /api/activities` | Create, with exactly one of `contact_id` or `deal_id` |
| `PATCH /api/activities/{id}` | Update, including `done` |
| `DELETE /api/activities/{id}` | Delete |
| `GET /api/pipeline` | Every deal grouped by stage in card order, plus the totals for each column and the board |
| `GET /api/dashboard` | Every dashboard figure (see Dashboard) |

**Timeline entries** have one shape for both kinds:

- `kind`: `activity` or `stage_change`
- `at`
- the activity fields, or `from_stage` and `to_stage`
- for a contact's timeline, the deal's id and name where the entry came from a deal

They are sorted newest first by `occurred_at` or `changed_at`, and ties are broken by id, newest first.

## Screens

All screens share one layout:

- A fixed, narrow Midnight rail on the left (88px), with the Accountable mark at the top and then an icon with a short label for Dashboard, Pipeline, Deals, Contacts and Organizations ("Orgs"), in that order. The labels and icons are Sea Mist, and the current page is a solid Sea Green pill with Midnight text.
- A main area with the page title, the page's main action at top right, and the content below.
- Routes: `/`, `/pipeline`, `/deals`, `/deals/:id`, `/contacts`, `/contacts/:id`, `/organizations` and `/organizations/:id`.
- Browser back and forward work, and every page can be refreshed or bookmarked.

### Tables (Organizations, Contacts, Deals)

Each table has:

- A search box that filters as you type, across the text columns shown, ignoring case.
- Columns sorted by clicking a heading, which cycles through ascending, descending and back to the default order. An arrow shows the current sort.
- 50 rows to a page, with page controls and a count, such as "1–50 of 312".
- An add button at top right ("New organization", "New contact" or "New deal") that opens a form in a dialog.
- On each row, a click opens the record's page, and an edit button and a delete button act on that row without opening it.
- An empty state with a short line and the add button, and a different line when a search finds nothing.

The columns, with the default sort marked:

- **Organizations:** Name (default, A–Z), Industry, Website, Contacts, Open deals.
- **Contacts:** Name (default, A–Z), Organization ("No organization" in muted text when there is none), Job title, Email, Phone, Status (badge).
  - Above the table are status tabs: All, Leads, Qualified and Customers, each with its count. They combine with search.
- **Deals:** Name, Organization, Contact, Stage (badge), Value (USD), Probability, Expected (USD), Close date (default, soonest first).
  - A late deal shows a Raspberry "Late" badge next to its close date, and the date is in dark Raspberry.

### Forms

Each form opens in a dialog, with the first field focused. Enter saves, Escape cancels, and nothing is lost if validation fails.

- **Organization:** name, website, industry (with suggestions), notes.
- **Contact:** name, organization (searchable select, required), job title, email, phone, status.
- **Deal:**
  - Fields: name, main contact (searchable select, required), organization, stage, value, probability, close date.
  - Picking a contact fills in the organization from the contact's organization, and it can then be changed or cleared.
  - Stage changes reset the probability and, for Won and Lost, the close date, as described in Concerns 8.
  - When it opens from a column on the pipeline, the stage is already set.
- **Activity:** type (a three-way toggle: Note, Call, Email), description, when it happened (date and time, defaulting to now), follow-up date (optional). When editing, a "Done" checkbox appears if there is a follow-up date.

A short message confirms each save or delete, such as "Deal saved". It sits at the bottom of the screen and goes after a few seconds. Errors stay until dismissed.

### Organization page

- A header panel with the name, industry, the website as an external link, notes, and the Edit and Delete buttons.
- Two figure tiles: open pipeline and revenue won (all time) for this organization.
- A Contacts panel, a compact table with a "New contact" button that pre-fills this organization.
- A Deals panel, a compact table with a "New deal" button that pre-fills this organization.

### Contact page

- A header panel with the name, status badge, job title, organization as a link (or "No organization"), email as a `mailto:` link, phone, and Edit and Delete.
- A "Deals" panel listing the deals where this person is the main contact, with stage and value.
- A Timeline panel, with a "Log activity" button at its top and the entries newest first. Entries from the contact's deals are labelled with the deal's name as a link.

### Deal page

- A header panel with the name, stage badge, a Late badge if late, and Edit and Delete.
- Figures: value, probability, expected revenue and close date.
- Links to the organization and the main contact.
- A stage control: the six stages as a row of segments. Clicking one moves the deal, with the same effect as a drag.
- A Timeline panel with "Log activity" and the entries newest first.

### Timeline entries

- **Activity:** a type icon (note, phone or envelope, from the icon library), the description, and when it happened, such as "Nov 19, 2026, 2:30 PM".
  - If the activity has a follow-up, it shows a chip: "Follow up Nov 24" in Cerulean, "Overdue: Nov 18" in Raspberry, or "Done" in grey with a tick. The chip can be clicked to mark it done or not done.
  - Edit and delete appear on hover and on keyboard focus.
- **Stage change:** a small stage-colored dot and "Moved from Proposal to Negotiation", with the time.

### Pipeline

- A header with the page title and a short hint ("Drag a card to change its stage, or to move it up or down its column"), a white panel with the board's open totals (open pipeline, expected revenue and number of open deals, with the note "Won and Lost aren't counted"), and a "New deal" button.
- Six columns side by side, in stage order, each on a faint Midnight-tinted surface, filling the height of the window and scrolling on its own. All six fit at 1440px wide; the board scrolls sideways if the window is narrower.
- The dashboard's "Your day" column is hidden on this page, so the board gets the full width.
- **Column header:** a stage-color dot and the name, the number of cards, the total value and the expected revenue, plus a "+" button that opens the deal form at that stage.
- **Card:**
  - The deal's name, the organization (or "No organization"), the value in JetBrains Mono with the probability beside it (marked `*` when set by hand), the contact with their initials, and the close date as month and day.
  - A late card has a Raspberry "Late" badge next to its probability, and its date in dark Raspberry. Won cards show the value in dark Sea Green, and Lost cards are muted.
  - Clicking a card opens the deal page. Dragging it moves it.
- **Drag and drop:**
  - A card can be dropped at any point in any column, and a placeholder shows where it will land.
  - The board and column totals update straight away, before the server replies.
  - If the server call fails, the card goes back and an error message shows.
  - Keyboard dragging works through the library's keyboard sensor.
- Moving into Won or Lost shows a short message: "Website redesign marked as won. Close date set to Nov 21, 2026."

### Dashboard

The dashboard has two columns: the main column, and a "Your day" column on the right (360px) that stays in view as the main column scrolls. The main column opens with the page title, a greeting line in Instrument Serif, such as "Good morning. Here's where sales stand on Saturday, November 21", and the "New deal" button, then the following panels, top to bottom:

1. **Figures:** one panel split into three:
   - Open pipeline: value, number of deals, and a thin segmented bar of the open value by stage.
   - Expected revenue: value.
   - Won in the last 12 months: value, number of deals, and the amount won so far this month.
2. **Revenue won, last 12 months:** a line chart, with one point per month for the last 12 calendar months including this one. A month with nothing won shows 0. A tooltip gives the month, the revenue and the number of deals.
3. **Deals won per month:** a bar chart over the same 12 months. Charts 2 and 3 share one panel, "Won over the last 12 months", side by side.
4. **Sales funnel:** horizontal bars from New down to Won. Each bar shows the value that reached that stage, as defined in Concerns 7, with its number of deals and the percentage of New's value that got this far. Bars use the stage colors.
5. **Open pipeline by stage:** one stacked horizontal bar of the open value in each of the four open stages, with a legend. Panels 4 and 5 sit side by side.
The "Your day" column holds:

6. **Follow-ups:**
   - Two count tiles at the top: overdue (pale Raspberry) and the next 7 days (pale Cerulean).
   - Then two groups, Overdue first, sorted by date. Each item shows the date, the description, and the contact or deal as a link.
   - A checkbox marks it done, and the item leaves the list with a short fade.
   - Empty state: "Nothing due in the next 7 days."
7. **Recent activity:** the latest 10 timeline entries across all contacts and deals, including stage changes, each linking to its record. In this narrow column the time sits on its own line under each entry.

The `GET /api/dashboard` response contains the tiles, the 12 monthly rows (month, revenue won, deals won), the funnel rows, the open value by stage, the follow-ups and the recent activity. Every figure comes from the same rules as the rest of the app, so the dashboard always matches the tables.

## Design

The look follows the brand skill. Of the three mockups in `docs/mockups/`, **mockup C, Command (`docs/mockups/c-command.html`), is the chosen design** and the visual reference for Build and Test. It covers the dashboard and the pipeline board; the other screens follow its rail, type, panels and spacing. Mockups A and B are kept for reference only.

### Tokens

These are defined once as CSS custom properties.

| Token | Value | Use |
|---|---|---|
| `--page` | `#F0F4F5` | page background |
| `--panel` | `#FFFFFF` | panels, cards, dialogs |
| `--ink` | `#073B4C` Midnight | body text, headings |
| `--ink-muted` | Midnight at 65% | secondary text, "No organization" |
| `--sea-green` | `#06D6A0` | primary buttons (Midnight text), Won, chart series |
| `--sea-green-ink` | `#047A5B` | Sea Green text on white |
| `--marigold` | `#FFC145` | Qualified, chart series |
| `--marigold-ink` | `#8A5A00` | Marigold text on white |
| `--coral` | `#F78C6B` | Proposal, chart series |
| `--coral-ink` | `#B4441F` | Coral text on white |
| `--cerulean` | `#118AB2` | New, information, links on hover |
| `--cerulean-ink` | `#0B6E8F` | links, Cerulean text on white |
| `--raspberry` | `#EF476F` | late, overdue, delete |
| `--raspberry-ink` | `#C8234F` | Raspberry text, and the delete button fill |
| `--sea-mist` | `#CDD8DB` | Lost, dividers inside panels, disabled states |

Each darker shade meets 4.5:1 or better on white.

Badges use the color at about 18% opacity over white, with the matching ink-colored text. Midnight and Sea Mist badges use Midnight text.

### Type

- Instrument Sans for everything except as noted below. Page titles are 28px semibold, panel titles 16px semibold, and body text 14–15px.
- Instrument Serif only for the dashboard greeting and empty-state lines.
- JetBrains Mono for money, percentages, counts in figure tiles, dates in tables, and record numbers. It uses tabular figures and is right-aligned in tables.

### Surfaces and shape

- Panels and cards are white on the `#F0F4F5` page, rounded at 12px for panels and 10px for cards, with no outline. A very soft shadow, such as `0 1px 2px rgba(7,59,76,0.06)`, separates them from the page, and a stronger shadow marks a dragged card.
- No borders on a single edge, no rule across the top of the page, and no gradient fills. Charts may use a light fill under the revenue line, at low opacity and in a single color.
- Inside a panel, table rows are separated by Sea Mist lines that are 1px and full-width. A row is highlighted on hover with a faint Midnight tint.
- The active navigation item is a solid Sea Green pill with Midnight text on the Midnight rail.
- Focus rings are 2px Cerulean with a 2px offset, on every interactive element.

### Charts

- Revenue won is a Sea Green line with dots. Deals won are Marigold bars.
- The funnel and stage visuals use the stage colors from Concerns 3.
- The brand colors fail a palette check as chart series: Marigold and Coral are close, and Marigold, Sea Green and Sea Mist are faint on white. The brand wins, so every stage mark carries its stage name as a text label next to it, every multi-color chart has a legend, and segments are separated by a 2px white gap. Color is never the only way to tell stages apart.
- Every chart has a hover tooltip with the exact figure.
- Axes and gridlines are Sea Mist, with labels in Midnight at 65%. Money axis labels are shortened, as in `$40k`.
- Tooltips are white panels with Midnight text.

### Tone

Copy is plain business English, with short labels and no exclamation marks, for example:

- "New deal", "Log activity", "Mark as done", "No organization".
- "Nothing here yet. Add your first contact."

## Libraries

These are popular, well-supported choices, in line with the tech stack:

- **Routing:** React Router.
- **Server data:** TanStack Query, for caching, refetching after changes, and optimistic updates on the board.
- **Tables:** TanStack Table, for sorting, filtering and paging.
- **Charts:** Recharts.
- **Drag and drop:** dnd-kit (`@dnd-kit/core` and `@dnd-kit/sortable`), with multiple containers and the keyboard sensor.
- **Dialogs, selects, toggles and toasts:** Radix UI primitives, styled with the tokens above.
- **Forms:** React Hook Form with Zod.
- **Dates:** date-fns.
- **Icons:** Lucide.
- **Fonts:** `@fontsource/instrument-sans`, `@fontsource/instrument-serif` and `@fontsource/jetbrains-mono`.
- **Backend:** FastAPI, Uvicorn, SQLAlchemy Core and Pydantic.
- **Running both servers:** a plain Node script, `scripts/dev.mjs`, that runs both and stops both on Ctrl+C.

## Sample data

The seed lives in `backend/` and is deterministic, using a fixed random seed. Every date is set relative to the day it runs, so the dashboard always looks current after a seed. It looks like the CRM of a B2B software and services company.

- **Organizations:** about 25, across technology, finance, healthcare, retail, manufacturing, logistics and education, each with a website and short notes. Two of them have no deals.
- **Contacts:** about 80, 1 to 5 per organization, with plausible job titles. Statuses are roughly 40% leads, 25% qualified and 35% customers.
- **Deals:** about 70, valued from $5,000 to $150,000 in round-ish figures, such as "Data platform migration" or "Annual support renewal". They're spread as follows:
  - About 30 open, across all four open stages, with close dates over the next 4 months. Four or five of them are late.
  - About 25 won, spread over the past 12 months so that every month has at least one, with an upward trend.
  - About 12 lost.
  - Each deal has stage history that fits its stage. A Lost deal, for example, shows the stages it went through before Lost.
  - A handful of deals have a probability set by hand.
- **Activities:** about 250, as notes, calls and emails, written as realistic one-liners. About 15 have follow-ups that are coming up, 6 are overdue, and 10 are already done.

`npm run seed` deletes the database file, recreates the tables and loads the sample data. The backend does the same on startup when the database file doesn't exist.

## Running it

- **Prerequisites:** Node 24 or later, uv and Google Chrome.
- **`npm run dev`:**
  - Installs anything missing.
  - Starts the API on port 8000 (`ACCOUNTABLE_API_PORT`) and the frontend on port 5173 (`ACCOUNTABLE_WEB_PORT`). Vite forwards `/api` to the backend.
  - Prints the address to open: http://localhost:5173.
- **The database file** is `data/accountable.db`, which git ignores. `ACCOUNTABLE_DB_PATH` can point it elsewhere.
- `npm run seed` resets the data. `npm test` runs every test suite.

`docs/STATUS.md` will hold these instructions once the app is built. `README.md` stays as it is.

## Testing

The tests use their own database, set through `ACCOUNTABLE_DB_PATH` to a temporary file, so running them never touches the user's data.

- **Backend (pytest):**
  - Each stage rule: probability on move, keeping a probability set by hand, the close date on Won and Lost, and the stage-change rows.
  - Card ordering on moves within and between columns.
  - The three delete rules, including the `409` for a contact on deals.
  - The exactly-one-link rule for activities.
  - Every dashboard figure, against a small known dataset with a fixed "today".
  - The funnel counting.
  - Validation errors.
  - That the seed is complete.
- **Frontend (Vitest):** money and date formatting, late and overdue logic, the deal form's stage defaults, table search and sort, and the board's optimistic totals.
- **End to end (Playwright Test, installed Chrome):** one test or more per success criterion in the intent:
  - Starting on the dashboard with sample data.
  - Adding, finding, sorting, editing and deleting each kind of record, and refreshing to check each change has persisted.
  - The status filter.
  - Linked records on each page.
  - Dragging between and within columns, then refreshing.
  - Adding a deal from a column.
  - Winning a deal and checking the dashboard.
  - Logging an activity and a follow-up, and marking it done.
  - Every e2e test also fails on any browser console error.

Passing tests aren't enough on their own. Success criterion 8, a full run-through by eye in a real browser, still applies.
