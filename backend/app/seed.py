"""Deterministic sample data: the CRM of a B2B software and services company.

Every date is relative to the day the seed runs, so the dashboard always looks
current. The same `now` always gives exactly the same rows.

Run `uv run python -m backend.app.seed` (or `npm run seed`) to reset the database.
"""

import random
from datetime import date, datetime, time, timedelta
from pathlib import Path

import sqlalchemy as sa

from . import db, rules

RANDOM_SEED = 20261121

# name, industry, website, notes
ORGANIZATIONS = [
    ("Northbeam Software", "Technology", "https://northbeam.example.com", "Mid-size SaaS vendor. Buys through a central IT budget each spring."),
    ("Quillstack Systems", "Technology", "https://quillstack.example.com", "Fast-growing dev tools company, keen on integrations."),
    ("Lattice Cloud", "Technology", "https://latticecloud.example.com", "Hosting provider. Long procurement cycles."),
    ("Brightpath Analytics", "Technology", "https://brightpath.example.com", "Analytics consultancy that resells our services."),
    ("Tidewater Data", "Technology", "https://tidewaterdata.example.com", "Data brokerage. Security reviews are strict."),
    ("Cobalt Bank", "Finance", "https://cobaltbank.example.com", "Regional bank with 40 branches. Long-standing customer."),
    ("Alder Capital", "Finance", "https://aldercapital.example.com", "Investment firm. Decisions go through the CFO."),
    ("Summit Mutual", "Finance", "https://summitmutual.example.com", "Insurance mutual, modernizing its claims systems."),
    ("Harbor Credit Union", "Finance", "https://harborcu.example.com", "Member-owned credit union, careful with spend."),
    ("Northwind Health", "Healthcare", "https://northwindhealth.example.com", "Hospital group with six sites."),
    ("Clearwater Clinics", "Healthcare", "https://clearwaterclinics.example.com", "Network of outpatient clinics."),
    ("Meridian Labs", "Healthcare", "https://meridianlabs.example.com", "Diagnostic lab chain. Interested in automation."),
    ("Sunrise Pediatrics", "Healthcare", "https://sunrisepeds.example.com", "Small practice group, quick to decide."),
    ("Brightline Retail", "Retail", "https://brightline.example.com", "Department stores in the Midwest."),
    ("Fernway Outfitters", "Retail", "https://fernway.example.com", "Outdoor gear retailer, strong online sales."),
    ("Pennant Home Goods", "Retail", "https://pennanthome.example.com", "Met at a trade show. No project yet."),
    ("Kestrel Manufacturing", "Manufacturing", "https://kestrelmfg.example.com", "Precision parts maker with three plants."),
    ("Ferro Industries", "Manufacturing", "https://ferro.example.com", "Steel fabrication. Big buyer of services."),
    ("Oakmont Plastics", "Manufacturing", "https://oakmontplastics.example.com", "Packaging manufacturer."),
    ("Halverson Logistics", "Logistics", "https://halverson.example.com", "Trucking and warehousing across the Southeast."),
    ("Bluewater Freight", "Logistics", "https://bluewaterfreight.example.com", "Ocean freight forwarder."),
    ("Crossdock Partners", "Logistics", "https://crossdock.example.com", "Third-party logistics provider."),
    ("Maple Ridge College", "Education", "https://mapleridge.example.edu", "Community college, budget set each July."),
    ("Westbrook Academy Trust", "Education", "https://westbrook.example.org", "Group of four schools. Early conversations only."),
    ("Lakeshore University", "Education", "https://lakeshore.example.edu", "Research university with a central IT office."),
]
ORGS_WITHOUT_DEALS = {"Pennant Home Goods", "Westbrook Academy Trust"}

FIRST_NAMES = [
    "Lena", "Daniel", "Priya", "Grace", "Tom", "Sam", "Ana", "Chris", "Rachel", "Marcus",
    "Maria", "James", "Aisha", "Kevin", "Sofia", "Ethan", "Nina", "Omar", "Hannah", "Lucas",
    "Mei", "David", "Olivia", "Raj", "Emma", "Carlos", "Julia", "Ben", "Fatima", "Noah",
    "Chloe", "Victor", "Ingrid", "Tariq", "Elena", "Ryan", "Yuki", "Paul", "Zoe", "Andre",
]
LAST_NAMES = [
    "Fischer", "Reyes", "Natarajan", "Whitfield", "Okafor", "Whitaker", "Costa", "Lam", "Ng", "Bell",
    "Lopez", "Carter", "Rahman", "Murphy", "Rossi", "Hughes", "Petrov", "Haddad", "Schmidt", "Moreau",
    "Chen", "Kim", "Brooks", "Patel", "Novak", "Silva", "Berg", "Turner", "Ali", "Foster",
    "Dubois", "Ivanova", "Larsen", "Mensah", "Garcia", "Walsh", "Tanaka", "Jensen", "Price", "Romero",
]
JOB_TITLES = [
    "Chief Financial Officer", "VP of Operations", "IT Director", "Head of Procurement",
    "Operations Manager", "Chief Technology Officer", "Finance Manager", "Project Manager",
    "Head of Data", "Director of Sales Operations", "Systems Administrator", "Chief Executive Officer",
    "Purchasing Lead", "Head of Customer Service", "Engineering Manager",
]
CONTACTS_PER_ORG = [5, 4, 3, 3, 2, 5, 4, 4, 2, 5, 3, 3, 2, 5, 4, 1, 4, 4, 2, 4, 3, 2, 3, 1, 2]

DEAL_NAMES = [
    "Data platform migration", "Annual support renewal", "Payroll integration", "Inventory forecasting pilot",
    "Patient portal refresh", "Support desk add-on", "Shop floor dashboards", "Route planning trial",
    "Student records cleanup", "Store analytics starter", "Claims workflow review", "Treasury reporting suite",
    "Clinic scheduling platform", "Fleet telematics pilot", "Loyalty program rebuild", "Data warehouse audit",
    "Campus Wi-Fi analytics", "Returns portal", "Underwriting data feed", "Warehouse analytics",
    "Security assessment", "ERP connector bundle", "Telehealth integration", "POS integration rollout",
    "Quality tracking module", "Policy admin migration", "Managed services contract", "Annual licence uplift",
    "Advisor CRM rollout", "Lab results interface", "Cloud backup service", "Plant monitoring",
    "Customer data platform", "Compliance reporting", "Dispatch optimisation", "Mobile app rebuild",
    "Billing system replacement", "Kiosk software", "Research data lake", "Document management upgrade",
    "Single sign-on rollout", "Network monitoring", "Vendor portal", "Forecasting workshop",
    "Disaster recovery plan", "Email archiving", "Field service app", "Supplier scorecards",
    "Contract renewal", "Help desk outsourcing", "API gateway setup", "Training program",
    "Dashboard refresh", "Data quality review", "Reporting automation", "Customer onboarding portal",
    "Shipment tracking feed", "Budgeting tool rollout", "Cyber insurance audit", "Learning platform pilot",
    "Energy usage analytics", "Order management upgrade", "Device management", "Fraud detection pilot",
    "Pricing engine", "Analytics training", "Archive migration", "Website redesign",
    "Mobile scanning app", "Integration health check",
]

CALLS = [
    "Intro call with {first} to understand their current setup",
    "Call with {first} about timing and budget",
    "Walked {first} through the pricing options",
    "Quick check-in call with {first}",
    "Discussed the rollout plan with {first}",
    "Call with {first} and their IT lead about security questions",
    "{first} asked for a reference customer in {industry}",
    "Talked through contract terms with {first}",
]
EMAILS = [
    "Sent {first} the proposal for {deal}",
    "Emailed {first} a summary of our last meeting",
    "Sent case study from another {industry} customer",
    "Followed up with {first} on open questions",
    "Shared the implementation timeline with {first}",
    "Sent {first} the updated quote",
    "Emailed the security questionnaire answers",
    "Sent meeting notes and next steps to {first}",
]
NOTES = [
    "{first} is the main decision maker for {deal}",
    "Budget approved for next quarter, according to {first}",
    "They are also talking to two other vendors",
    "{first} prefers email over calls",
    "Procurement needs three quotes before signing",
    "Good meeting. {first} wants a demo for the wider team",
    "Legal review expected to take two weeks",
    "{first} is moving to a new role in the spring",
]
FOLLOW_UP_TASKS = [
    "Send revised pricing to {first}",
    "Book a demo with {first}'s team",
    "Check in with {first} on the contract",
    "Chase signed order form for {deal}",
    "Share onboarding plan with {first}",
    "Call {first} about the security review",
    "Send {first} the reference contact",
    "Confirm kickoff date for {deal}",
]


class _Clock:
    """Turns day offsets and times into stored strings, never later than now."""

    def __init__(self, now: datetime):
        self.now = now.replace(microsecond=0)
        self.today = self.now.date()

    def day(self, offset: int) -> date:
        return self.today + timedelta(days=offset)

    def at(self, day: date, hour: int, minute: int = 0) -> str:
        moment = datetime.combine(day, time(hour, minute))
        if moment > self.now:
            moment = self.now - timedelta(minutes=5 + minute % 50)
        return moment.isoformat(timespec="seconds")


def _month_start(today: date, months_back: int) -> date:
    year, month = today.year, today.month - months_back
    while month < 1:
        month += 12
        year -= 1
    return date(year, month, 1)


def _month_end(start: date) -> date:
    next_month = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
    return next_month - timedelta(days=1)


def _round_value(rng: random.Random, low: int, high: int) -> int:
    """A round-ish dollar value between low and high, in cents."""
    step = 500 if high <= 50_000 else 1_000
    dollars = rng.randrange(low // step, high // step + 1) * step
    return max(5_000, min(150_000, dollars)) * 100


def build(now: datetime) -> dict[str, list[dict]]:
    """Every sample row, keyed by table name. Pure: the same `now` gives the same rows."""
    rng = random.Random(RANDOM_SEED)
    clock = _Clock(now)
    today = clock.today

    # Organizations
    orgs = []
    for i, (name, industry, website, notes) in enumerate(ORGANIZATIONS, start=1):
        created = clock.at(clock.day(-rng.randrange(200, 400)), 9 + i % 8)
        orgs.append(
            {
                "id": i, "name": name, "website": website, "industry": industry, "notes": notes,
                "created_at": created, "updated_at": created,
            }
        )

    # Contacts, 1 to 5 per organization, with statuses roughly 40/25/35.
    total_contacts = sum(CONTACTS_PER_ORG)
    statuses = (
        ["lead"] * round(total_contacts * 0.40)
        + ["qualified"] * round(total_contacts * 0.25)
    )
    statuses += ["customer"] * (total_contacts - len(statuses))
    rng.shuffle(statuses)
    people = [(f, l) for f in FIRST_NAMES for l in LAST_NAMES]
    rng.shuffle(people)
    contacts = []
    contact_id = 0
    for org, count in zip(orgs, CONTACTS_PER_ORG, strict=True):
        domain = org["website"].split("//")[1]
        for _ in range(count):
            contact_id += 1
            first, last = people[contact_id - 1]
            created = clock.at(clock.day(-rng.randrange(60, 380)), 10 + contact_id % 7)
            contacts.append(
                {
                    "id": contact_id,
                    "name": f"{first} {last}",
                    "email": f"{first.lower()}.{last.lower()}@{domain}",
                    "phone": f"(555) {rng.randrange(200, 999)}-{rng.randrange(1000, 9999)}",
                    "job_title": rng.choice(JOB_TITLES),
                    "organization_id": org["id"],
                    "status": statuses[contact_id - 1],
                    "created_at": created,
                    "updated_at": created,
                }
            )

    org_by_id = {o["id"]: o for o in orgs}
    dealing_contacts = [
        c for c in contacts if org_by_id[c["organization_id"]]["name"] not in ORGS_WITHOUT_DEALS
    ]

    # Deal plans: (stage, close date, value in cents, probability set by hand or None).
    plans: list[tuple[str, date, int, int | None]] = []
    open_counts = {"new": 9, "qualified": 8, "proposal": 7, "negotiation": 6}
    late_slots = {("new", 0), ("qualified", 1), ("proposal", 0), ("negotiation", 1), ("negotiation", 3)}
    by_hand = {("qualified", 2): 35, ("proposal", 3): 40, ("negotiation", 0): 85, ("new", 4): 15}
    for stage, count in open_counts.items():
        for n in range(count):
            if (stage, n) in late_slots:
                close = clock.day(-rng.randrange(2, 21))
            else:
                close = clock.day(rng.randrange(3, 121))
            plans.append((stage, close, _round_value(rng, 5_000, 120_000), by_hand.get((stage, n))))

    # Won: at least one a month for the last 12 months, more and bigger lately.
    won_months = list(range(12)) + [5, 7, 8, 9, 9, 10, 10, 11, 11, 3, 6, 11, 1]
    for months_back_index in won_months:
        start = _month_start(today, 11 - months_back_index)
        end = min(_month_end(start), today)
        close = start + timedelta(days=rng.randrange(0, (end - start).days + 1))
        trend = 15_000 + months_back_index * 6_000
        plans.append(("won", close, _round_value(rng, trend, trend + 45_000), None))

    for _ in range(12):
        plans.append(("lost", clock.day(-rng.randrange(5, 330)), _round_value(rng, 5_000, 150_000), None))

    deals = []
    changes = []
    for deal_id, (stage, close, value, prob) in enumerate(plans, start=1):
        contact = dealing_contacts[(deal_id * 7) % len(dealing_contacts)]
        # Open deals started recently; closed deals started a month or three before closing.
        if rules.is_open(stage):
            started = clock.day(-rng.randrange(14, 120))
            last_step = clock.day(-1)
        else:
            started = close - timedelta(days=rng.randrange(30, 90))
            last_step = close
        if stage == "won":
            path = list(rules.FUNNEL_STAGES)
        elif stage == "lost":
            path = list(rules.OPEN_STAGES[: rng.randrange(1, 5)]) + ["lost"]
        else:
            path = list(rules.OPEN_STAGES[: rules.OPEN_STAGES.index(stage) + 1])
        steps = len(path) - 1
        span = max((last_step - started).days, steps)
        for k in range(steps):
            # Spread the stage changes evenly; the last one lands on last_step.
            when = started + timedelta(days=round(span * (k + 1) / steps))
            changes.append(
                {
                    "deal_id": deal_id, "from_stage": path[k], "to_stage": path[k + 1],
                    "changed_at": clock.at(min(when, last_step), 9 + (deal_id + k) % 8, (deal_id * 13) % 60),
                }
            )
        created = clock.at(started, 9 + deal_id % 8)
        deals.append(
            {
                "id": deal_id,
                "name": DEAL_NAMES[deal_id - 1],
                "organization_id": contact["organization_id"],
                "contact_id": contact["id"],
                "stage": stage,
                "value_cents": value,
                "probability": prob if prob is not None else rules.DEFAULT_PROBABILITY[stage],
                "close_date": close.isoformat(),
                "position": 0,
                "created_at": created,
                "updated_at": created,
            }
        )

    # Card order: open columns by close date; Won and Lost with the latest first.
    for stage in rules.STAGES:
        column = [d for d in deals if d["stage"] == stage]
        column.sort(key=lambda d: d["close_date"], reverse=stage in rules.CLOSED_STAGES)
        for position, deal in enumerate(column):
            deal["position"] = position
    changes.sort(key=lambda c: c["changed_at"])
    for change_id, change in enumerate(changes, start=1):
        change["id"] = change_id

    # Activities: a few on every deal, and some on contacts directly.
    contact_by_id = {c["id"]: c for c in contacts}
    activities = []

    def describe(kind: str, contact: dict, deal: dict | None) -> str:
        template = rng.choice({"call": CALLS, "email": EMAILS, "note": NOTES}[kind])
        return template.format(
            first=contact["name"].split()[0],
            deal=deal["name"] if deal else "the project",
            industry=org_by_id[contact["organization_id"]]["industry"].lower(),
        )

    def add_activity(day: date, contact: dict, deal: dict | None) -> None:
        kind = rng.choice(rules.ACTIVITY_TYPES)
        when = clock.at(day, rng.randrange(8, 18), rng.choice([0, 15, 30, 45]))
        activities.append(
            {
                "type": kind,
                "description": describe(kind, contact, deal),
                "occurred_at": when,
                "follow_up_date": None,
                "done": False,
                "contact_id": None if deal else contact["id"],
                "deal_id": deal["id"] if deal else None,
                "created_at": when,
                "updated_at": when,
            }
        )

    for deal in deals:
        contact = contact_by_id[deal["contact_id"]]
        started = date.fromisoformat(deal["created_at"][:10])
        ended = min(date.fromisoformat(deal["close_date"]), today) if not rules.is_open(deal["stage"]) else today
        span = max((ended - started).days, 1)
        for _ in range(rng.randrange(2, 5)):
            add_activity(started + timedelta(days=rng.randrange(0, span + 1)), contact, deal)

    while len(activities) < 250:
        contact = rng.choice(contacts)
        add_activity(clock.day(-rng.randrange(0, 150)), contact, None)

    activities.sort(key=lambda a: a["occurred_at"])
    for activity_id, activity in enumerate(activities, start=1):
        activity["id"] = activity_id

    # Follow-ups go on the most recent activities: 15 coming up, 6 overdue,
    # 4 beyond the next 7 days, and 10 already done.
    recent = sorted(activities, key=lambda a: a["occurred_at"], reverse=True)[:60]
    rng.shuffle(recent)
    plan = (
        [("coming_up", offset) for offset in [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7]]
        + [("overdue", offset) for offset in [-1, -2, -3, -5, -8, -12]]
        + [("later", offset) for offset in [10, 14, 18, 25]]
        + [("done", offset) for offset in [-1, -2, -3, -4, -6, -7, -9, -10, -14, -20]]
    )
    for activity, (state, offset) in zip(recent, plan):
        contact = contact_by_id[activity["contact_id"]] if activity["contact_id"] else contact_by_id[
            next(d["contact_id"] for d in deals if d["id"] == activity["deal_id"])
        ]
        deal = next((d for d in deals if d["id"] == activity["deal_id"]), None)
        activity["follow_up_date"] = clock.day(offset).isoformat()
        activity["done"] = state == "done"
        activity["description"] = rng.choice(FOLLOW_UP_TASKS).format(
            first=contact["name"].split()[0], deal=deal["name"] if deal else "the project"
        )
        if activity["follow_up_date"] < activity["occurred_at"][:10]:
            # A follow-up is set when the activity is logged, so it can't come before it.
            occurred = clock.at(clock.day(offset - 2), 11)
            activity["occurred_at"] = activity["created_at"] = activity["updated_at"] = occurred

    return {
        "organizations": orgs,
        "contacts": contacts,
        "deals": deals,
        "stage_changes": changes,
        "activities": activities,
    }


def seed(conn: sa.Connection, now: datetime) -> None:
    """Load the sample data into empty tables."""
    rows = build(now)
    for table in (db.organizations, db.contacts, db.deals, db.stage_changes, db.activities):
        conn.execute(table.insert(), rows[table.name])


def reset_database(path: Path, now: datetime) -> None:
    """Empty the database and load the sample data, in one transaction.

    The tables are dropped and recreated in place rather than deleting the file,
    so this also works while the app has the file open.
    """
    engine = db.make_engine(path)
    try:
        with engine.begin() as conn:
            db.metadata.drop_all(conn)
            db.metadata.create_all(conn)
            seed(conn, now)
    finally:
        engine.dispose()


if __name__ == "__main__":
    from . import clock, config

    reset_database(config.db_path(), clock.now())
    print(f"Reset {config.db_path()} to the sample data.")
