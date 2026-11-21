"""Errors the API returns, with messages written for people.

A 422 response looks like:
    {"detail": "Some fields need fixing.", "errors": {"name": "Enter a name."}}
"""

from typing import Any

from fastapi.responses import JSONResponse

FIX_FIELDS = "Some fields need fixing."

# Messages for Pydantic's own error types. Our validators raise ValueError with
# their own message, which is used as it is.
_MESSAGES = {
    "missing": "This is required.",
    "int_parsing": "Enter a whole number.",
    "int_type": "Enter a whole number.",
    "int_from_float": "Enter a whole number.",
    "float_parsing": "Enter a number.",
    "bool_parsing": "Choose yes or no.",
    "bool_type": "Choose yes or no.",
    "string_type": "Enter some text.",
    "date_parsing": "Enter a date as YYYY-MM-DD.",
    "date_from_datetime_parsing": "Enter a date as YYYY-MM-DD.",
    "date_from_datetime_inexact": "Enter a date without a time.",
    "date_type": "Enter a date as YYYY-MM-DD.",
    "datetime_parsing": "Enter a date and time.",
    "datetime_from_date_parsing": "Enter a date and time.",
    "datetime_type": "Enter a date and time.",
    "json_invalid": "The request couldn't be read.",
    "model_attributes_type": "The request couldn't be read.",
    "dict_type": "The request couldn't be read.",
}


# What to say when a required field is left out altogether.
_MISSING = {
    "name": "Enter a name.",
    "organization_id": "Pick an organization.",
    "contact_id": "Pick a main contact.",
    "value_cents": "Enter a value in whole dollars.",
    "close_date": "Enter a close date.",
    "stage": "Pick a stage.",
    "index": "Enter a position.",
    "type": "Pick note, call or email.",
    "description": "Enter a description.",
    "occurred_at": "Enter the date and time it happened.",
}


class ApiError(Exception):
    def __init__(self, status_code: int, detail: str, **extra: Any):
        self.status_code = status_code
        self.detail = detail
        self.extra = extra

    def body(self) -> dict:
        return {"detail": self.detail, **self.extra}


def not_found(kind: str) -> ApiError:
    return ApiError(404, f"{kind} not found.")


def field_errors(errors: dict[str, str]) -> ApiError:
    return ApiError(422, FIX_FIELDS, errors=errors)


def _message(error: dict, field: str) -> str:
    if error.get("type") == "missing" and field in _MISSING:
        return _MISSING[field]
    if error.get("type") == "value_error":
        # Our own validators: "Value error, Enter a name." -> "Enter a name."
        ctx_error = error.get("ctx", {}).get("error")
        if ctx_error is not None:
            return str(ctx_error)
    return _MESSAGES.get(error.get("type", ""), error.get("msg", "This value isn't valid."))


def validation_error_response(errors: list[dict]) -> JSONResponse:
    by_field: dict[str, str] = {}
    for error in errors:
        loc = [part for part in error.get("loc", ()) if part != "body"]
        field = str(loc[0]) if loc else "_form"
        by_field.setdefault(field, _message(error, field))
    return JSONResponse(status_code=422, content={"detail": FIX_FIELDS, "errors": by_field})
