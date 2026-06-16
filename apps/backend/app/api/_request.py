"""Shared extraction of client metadata off the incoming request.

Used by audit / auth-event paths that record the caller's IP and user agent.
"""

from __future__ import annotations

from fastapi import Request


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")
