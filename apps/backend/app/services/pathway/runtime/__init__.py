"""Pathway runtime engine services.

Stateless transitions on `BlockExecution` rows driven by the
slot-#2 `InputLogic` evaluator. Persistence lives behind a thin
repository; this module owns the rules.
"""

from app.services.pathway.runtime.engine import RuntimeEngine


__all__ = ["RuntimeEngine"]
