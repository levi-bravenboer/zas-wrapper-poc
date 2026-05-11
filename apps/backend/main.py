from fastapi import FastAPI

app = FastAPI(
    title="ZAS Wrapper Backend",
    version="0.1.0",
    description="FHIR gateway and orchestrator backend for the ZAS Telegeneeskunde POC.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"name": app.title, "version": app.version}
