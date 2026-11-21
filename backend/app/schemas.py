"""Request and response models.

Each request field validates itself and raises a message written for people,
which the API returns next to the field name in a 422.

Create models require what the spec requires. Patch models make every field
optional; only the fields sent are changed (see `model_fields_set`), and a
required field sent as null is refused.
"""

import re
from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict

from . import rules

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _text(message: str, max_length: int = 200):
    def check(value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(message)
        value = value.strip()
        if len(value) > max_length:
            raise ValueError(f"Keep this to {max_length} characters or fewer.")
        return value

    return check


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Enter some text.")
    return value.strip() or None


def _website(value: Any) -> str | None:
    value = _optional_text(value)
    if value is None:
        return None
    # Any case, as the form allows: "HTTPS://acme.com" is a fine website.
    if not re.match(r"^https?://\S+$", value, re.IGNORECASE):
        raise ValueError("Start the website with http:// or https://.")
    return value


def _email(value: Any) -> str | None:
    value = _optional_text(value)
    if value is None:
        return None
    if not EMAIL.match(value):
        raise ValueError("Enter a valid email address, such as name@company.com.")
    return value


def _choice(options: tuple[str, ...], message: str):
    def check(value: Any) -> str:
        if value not in options:
            raise ValueError(message)
        return value

    return check


def _whole_number(value: Any, message: str) -> int:
    if isinstance(value, bool):
        raise ValueError(message)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        value = int(value)
    if not isinstance(value, int):
        raise ValueError(message)
    return value


def _id(message: str):
    def check(value: Any) -> int:
        if value is None or value == "":
            raise ValueError(message)
        number = _whole_number(value, message)
        if number < 1:
            raise ValueError(message)
        return number

    return check


def _optional_id(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return _id("Pick from the list.")(value)


def _value_cents(value: Any) -> int:
    number = _whole_number(value, "Enter a value in whole dollars.")
    if number < 0:
        raise ValueError("Enter a value of $0 or more.")
    return number


def _probability(value: Any) -> int:
    number = _whole_number(value, "Enter a probability from 0 to 100.")
    if not 0 <= number <= 100:
        raise ValueError("Enter a probability from 0 to 100.")
    return number


def _date(message: str):
    def check(value: Any) -> str:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value.isoformat()
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()):
            raise ValueError(message)
        try:
            return date.fromisoformat(value.strip()).isoformat()
        except ValueError:
            raise ValueError(message) from None

    return check


def _optional_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return _date("Enter a date, or leave it blank.")(value)


def _datetime(value: Any) -> str:
    message = "Enter the date and time it happened."
    if not value:
        raise ValueError(message)
    try:
        moment = value if isinstance(value, datetime) else datetime.fromisoformat(str(value))
    except ValueError:
        raise ValueError(message) from None
    if moment.tzinfo is not None:
        moment = moment.astimezone().replace(tzinfo=None)
    return moment.replace(microsecond=0).isoformat(timespec="seconds")


def _bool(value: Any) -> bool:
    if not isinstance(value, bool):
        raise ValueError("Choose yes or no.")
    return value


Name = Annotated[str, BeforeValidator(_text("Enter a name."))]
Description = Annotated[str, BeforeValidator(_text("Enter a description.", max_length=5000))]
OptionalText = Annotated[str | None, BeforeValidator(_optional_text)]
Website = Annotated[str | None, BeforeValidator(_website)]
Email = Annotated[str | None, BeforeValidator(_email)]
Status = Annotated[str, BeforeValidator(_choice(rules.STATUSES, "Pick a status: lead, qualified or customer."))]
Stage = Annotated[str, BeforeValidator(_choice(rules.STAGES, "Pick a stage."))]
ActivityType = Annotated[str, BeforeValidator(_choice(rules.ACTIVITY_TYPES, "Pick note, call or email."))]
OrganizationRef = Annotated[int, BeforeValidator(_id("Pick an organization."))]
ContactRef = Annotated[int, BeforeValidator(_id("Pick a main contact."))]
OptionalRef = Annotated[int | None, BeforeValidator(_optional_id)]
ValueCents = Annotated[int, BeforeValidator(_value_cents)]
Probability = Annotated[int, BeforeValidator(_probability)]
CloseDate = Annotated[str, BeforeValidator(_date("Enter a close date."))]
OptionalDate = Annotated[str | None, BeforeValidator(_optional_date)]
OccurredAt = Annotated[str, BeforeValidator(_datetime)]
Flag = Annotated[bool, BeforeValidator(_bool)]


class _Request(BaseModel):
    model_config = ConfigDict(extra="ignore", validate_default=False)

    def sent(self) -> dict:
        """Only the fields the client sent."""
        return {name: getattr(self, name) for name in self.model_fields_set}


# Organizations


class OrganizationCreate(_Request):
    name: Name
    website: Website = None
    industry: OptionalText = None
    notes: OptionalText = None


class OrganizationPatch(_Request):
    name: Name = None  # type: ignore[assignment]
    website: Website = None
    industry: OptionalText = None
    notes: OptionalText = None


# Contacts


class ContactCreate(_Request):
    name: Name
    organization_id: OrganizationRef
    email: Email = None
    phone: OptionalText = None
    job_title: OptionalText = None
    status: Status = "lead"


class ContactPatch(_Request):
    name: Name = None  # type: ignore[assignment]
    organization_id: OrganizationRef = None  # type: ignore[assignment]
    email: Email = None
    phone: OptionalText = None
    job_title: OptionalText = None
    status: Status = None  # type: ignore[assignment]


# Deals


class DealCreate(_Request):
    name: Name
    contact_id: ContactRef
    organization_id: OptionalRef = None
    stage: Stage = "new"
    value_cents: ValueCents
    probability: Probability | None = None
    close_date: CloseDate


class DealPatch(_Request):
    name: Name = None  # type: ignore[assignment]
    contact_id: ContactRef = None  # type: ignore[assignment]
    organization_id: OptionalRef = None
    stage: Stage = None  # type: ignore[assignment]
    value_cents: ValueCents = None  # type: ignore[assignment]
    probability: Probability = None  # type: ignore[assignment]
    close_date: CloseDate = None  # type: ignore[assignment]


class DealMove(_Request):
    stage: Stage
    index: Annotated[int, BeforeValidator(lambda v: max(0, _whole_number(v, "Enter a position.")))]


# Activities


class ActivityCreate(_Request):
    type: ActivityType
    description: Description
    occurred_at: OccurredAt
    follow_up_date: OptionalDate = None
    done: Flag = False
    contact_id: OptionalRef = None
    deal_id: OptionalRef = None


class ActivityPatch(_Request):
    type: ActivityType = None  # type: ignore[assignment]
    description: Description = None  # type: ignore[assignment]
    occurred_at: OccurredAt = None  # type: ignore[assignment]
    follow_up_date: OptionalDate = None
    done: Flag = None  # type: ignore[assignment]


# Responses


class _Response(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Link(_Response):
    id: int
    name: str


class OrganizationRow(_Response):
    id: int
    name: str
    website: str | None
    industry: str | None
    notes: str | None
    contact_count: int
    open_deal_count: int
    created_at: str
    updated_at: str


class ContactRow(_Response):
    id: int
    name: str
    email: str | None
    phone: str | None
    job_title: str | None
    organization_id: int | None
    organization_name: str | None
    status: str
    created_at: str
    updated_at: str


class DealRow(_Response):
    id: int
    name: str
    organization_id: int | None
    organization_name: str | None
    contact_id: int
    contact_name: str
    stage: str
    value_cents: int
    probability: int
    probability_by_hand: bool
    expected_cents: int
    close_date: str
    late: bool
    position: int
    created_at: str
    updated_at: str


class Activity(_Response):
    id: int
    type: str
    description: str
    occurred_at: str
    follow_up_date: str | None
    done: bool
    contact_id: int | None
    deal_id: int | None
    created_at: str
    updated_at: str


class TimelineEntry(_Response):
    kind: Literal["activity", "stage_change"]
    id: int
    at: str
    # Activity fields
    type: str | None = None
    description: str | None = None
    follow_up_date: str | None = None
    done: bool | None = None
    contact_id: int | None = None
    deal_id: int | None = None
    # Stage change fields
    from_stage: str | None = None
    to_stage: str | None = None
    # Where the entry came from, for labels and links
    contact: Link | None = None
    deal: Link | None = None
    organization: Link | None = None


class OrganizationDetail(OrganizationRow):
    contacts: list[ContactRow]
    deals: list[DealRow]
    open_pipeline_cents: int
    won_cents: int


class ContactDetail(ContactRow):
    organization: Link | None
    deals: list[DealRow]
    timeline: list[TimelineEntry]


class DealDetail(DealRow):
    timeline: list[TimelineEntry]


class OrganizationImpact(_Response):
    name: str
    contact_count: int
    deal_count: int


class ContactImpact(_Response):
    name: str
    deals: list[Link]
    activity_count: int


class DealImpact(_Response):
    name: str
    activity_count: int
    stage_change_count: int


class PipelineColumn(_Response):
    stage: str
    count: int
    total_cents: int
    expected_cents: int
    deals: list[DealRow]


class PipelineTotals(_Response):
    open_cents: int
    expected_cents: int
    open_count: int


class Pipeline(_Response):
    columns: list[PipelineColumn]
    totals: PipelineTotals


class DashboardFigures(_Response):
    open_pipeline_cents: int
    open_count: int
    expected_cents: int
    won_12m_cents: int
    won_12m_count: int
    won_this_month_cents: int
    won_this_month_count: int
    overdue_count: int
    coming_up_count: int


class MonthRow(_Response):
    month: str
    revenue_cents: int
    deals: int


class FunnelRow(_Response):
    stage: str
    value_cents: int
    count: int
    percent_of_new: int


class StageValue(_Response):
    stage: str
    value_cents: int
    count: int


class FollowUp(_Response):
    id: int
    type: str
    description: str
    occurred_at: str
    follow_up_date: str
    contact: Link | None
    deal: Link | None


class FollowUps(_Response):
    overdue: list[FollowUp]
    coming_up: list[FollowUp]


class Dashboard(_Response):
    today: str
    figures: DashboardFigures
    months: list[MonthRow]
    funnel: list[FunnelRow]
    open_by_stage: list[StageValue]
    follow_ups: FollowUps
    recent: list[TimelineEntry]
