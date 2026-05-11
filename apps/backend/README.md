# backend

FastAPI backend for the ZAS Telegeneeskunde POC. Acts as FHIR gateway, MCP host, and integration glue for HiX (ChipSoft) and Luscii.

Stack: **Python 3.13** + **FastAPI 0.136** (`fastapi[standard]`) + **uv** + **pytest** + **ruff**.

## Requirements

- `uv` — `curl -LsSf https://astral.sh/uv/install.sh | sh`. `uv` installs the pinned Python (3.13, see `.python-version`) automatically.

## Commands

Direct:

```bash
uv sync                       # install / refresh deps
uv run fastapi dev main.py    # http://localhost:8000 with autoreload
uv run fastapi run main.py    # production-style server
uv run pytest -q
uv run ruff check
uv run ruff format
```

Through moon (preferred):

```bash
moon run backend:dev
moon run backend:build        # uv sync --frozen
moon run backend:test
moon run backend:lint
moon run backend:format
```

Interactive API docs: <http://localhost:8000/docs> while `dev` is running.

## Conventions

See [`AGENTS.md`](./AGENTS.md). Highlights:

- Full type hints; Pydantic v2 models for payloads.
- Format with `ruff format`, lint with `ruff check`.
- Treat all FHIR payloads as PHI — log resource type + id only, never full payloads.
- HiX + Luscii integrations sit behind adapters; tests use fixtures, never live sandboxes.

## Structure

```
apps/backend/
├── main.py                # FastAPI app entry (single-file while small)
├── tests/
│   └── test_health.py
├── pyproject.toml
├── uv.lock
├── .python-version
├── moon.yml
├── AGENTS.md
└── README.md
```

Split into `app/` package when the API grows past ~150 LOC or two domains. Discuss in an OpenSpec proposal first.
