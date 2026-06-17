"""MessageBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_PATIENT


MessageChannel = Literal["email", "sms", "push", "in_app"]


class MessageBlock(BaseBlock):
    KIND: ClassVar[str] = "message"
    ACTOR: ClassVar[str] = "auto"
    COMPLETION: ClassVar[str] = "auto"
    TYPE_CODE: ClassVar[str] = "message"
    # Catalogue-expansion § A3: this kind doubles as the urology-flow
    # "notification" primitive — fire-and-forget message/notification
    # over a chosen channel. No separate notification kind exists.
    LABEL: ClassVar[str] = "Bericht"
    DESCRIPTION: ClassVar[str] = (
        "Sends a one-shot message/notification to the patient via a "
        "chosen channel (email, sms, push, in-app)."
    )
    ICON: ClassVar[str] = "mail"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT,)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "channel": {
                "type": "string",
                "enum": ["email", "sms", "push", "in_app"],
            },
            "subject": {"type": "string", "minLength": 1, "maxLength": 255},
            "body": {"type": "string", "maxLength": 5000},
            "cta_label": {"type": "string", "maxLength": 64},
            "cta_target": {"type": "string", "maxLength": 1024},
        },
        required=["channel", "subject", "body"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["channel", "subject", "body", "cta_label", "cta_target"],
        "widgets": {"channel": "channel-picker"},
    }

    channel: MessageChannel
    subject: str
    body: str
    cta_label: str | None = None
    cta_target: str | None = None


__all__ = ["MessageBlock", "MessageChannel"]
