"""Datetime tool for ADK agents – provides current date and time info."""
from datetime import datetime
import pytz
from google.adk.tools import FunctionTool


def get_current_datetime() -> dict:
    """Returns the current date, time, and timezone information.

    Use this when you need to resolve relative dates (like 'next Friday or three days from now')
    or need to know the current date for scheduling.

    Returns:
        A dict with isoformat string and descriptive parts.
    """
    now = datetime.now(pytz.UTC)
    return {
        "iso": now.isoformat(),
        "utc_now": now.strftime("%A, %B %d, %Y at %I:%M %p UTC"),
        "note": "All scheduling should be relative to this current time."
    }


current_datetime_tool = FunctionTool(get_current_datetime)
