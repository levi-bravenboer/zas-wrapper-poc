"""MessageBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import ClassVar, Literal

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_PATIENT


MessageChannel = Literal["email", "sms", "push", "in_app"]


class MessageBlock(BaseBlock):
    KIND: ClassVar[str] = "message"
    LABEL: ClassVar[str] = "Bericht"
    DESCRIPTION: ClassVar[str] = "Sends a message to the patient via a chosen channel."
    ICON: ClassVar[str] = "mail"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT,)

    channel: MessageChannel
    subject: str
    body: str
    cta_label: str | None = None
    cta_target: str | None = None


__all__ = ["MessageBlock", "MessageChannel"]
