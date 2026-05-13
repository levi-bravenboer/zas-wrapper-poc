from __future__ import annotations

import json
import logging
import logging.config
import sys
from typing import Any

from app.core.settings import Settings

_STANDARD_RECORD_ATTRS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
        "taskName",
    }
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_ATTRS or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class HumanFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<8} {record.name} {record.getMessage()}"
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in _STANDARD_RECORD_ATTRS and not k.startswith("_")
        }
        if extras:
            base += " " + " ".join(f"{k}={v}" for k, v in extras.items())
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def configure_logging(settings: Settings) -> None:
    formatter_cls = JsonFormatter if settings.env == "production" else HumanFormatter
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter_cls())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def log_fhir_ref(resource_type: str, resource_id: str) -> str:
    """Return a `<ResourceType>/<id>` reference suitable for log records.

    The only sanctioned way to mention FHIR resources in logs. Never log a full
    FHIR payload; pass this string to a structured log record instead.
    """
    return f"{resource_type}/{resource_id}"
