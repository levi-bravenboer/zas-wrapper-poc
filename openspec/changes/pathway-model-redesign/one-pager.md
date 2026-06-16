# Pathway Model — Block Concept (1-pager)

A **pathway** is a graph of blocks. Each block carries its own field values, business logic, timing, and runtime UI. There is no separate edge table; connections emerge from each block's `input_logic`.

---

## BaseBlock — what every block shares

```python
class BaseBlock:
    # --- INSTANCE: authored per block on the canvas ---
    name: str                                       # display label
    input_logic: list[InputRule]                    # when may this block trigger
    timing_policy: TimingPolicy                     # how long / when
    lane_kind: LaneKind | None = None               # only set when LANE_KINDS allows multiple

    # --- CLASS: per-kind metadata, no instance state, no DB columns ---
    LABEL:        ClassVar[str]                     # palette label
    DESCRIPTION:  ClassVar[str]                     # builder help text
    ICON:         ClassVar[str]                     # canvas icon
    LANE_KINDS:   ClassVar[tuple[LaneKind, ...]]    # allowed lanes for this kind
    EVENTS:       ClassVar[tuple[str, ...]] = ()    # emittable events
    RESULT_TYPE:  ClassVar[type | None] = None      # typed result on completion
    FIELD_MODES:  ClassVar[dict[str, FieldMode]] = {}  # static / deferred / builder-choice per field
```

Concrete block kinds **inherit** from `BaseBlock` and add their own typed fields and behaviour (polymorphism). No generic `type: str` + JSONB blob anymore. Instance rows are lean: 4 base fields plus the kind's own typed fields.

---

## 3 examples

### 1. AppointmentBlock — workflow + deferred date

```python
class AppointmentBlock(BaseBlock):
    LABEL = "Appointment"
    DESCRIPTION = "A scheduled meeting with a caregiver or patient."
    ICON = "calendar"
    LANE_KINDS = (LANE_KIND_CAREGIVER, LANE_KIND_PATIENT)
    EVENTS = ("rescheduled", "patient_no_show")
    RESULT_TYPE = AppointmentResult
    FIELD_MODES = {
        "mode":             FieldMode.ALWAYS_STATIC,
        "location":         FieldMode.BUILDER_CHOICE,
        "duration_minutes": FieldMode.BUILDER_CHOICE,
        "scheduled_at":     FieldMode.ALWAYS_DEFERRED,
    }

    mode: Literal["in_person", "video", "phone"]
    location: str
    duration_minutes: int
    scheduled_at: datetime
```
Result: `{ attended: bool, outcome_notes: str | None }`

### 2. DecisionBlock — typed outputs for XOR routing

```python
class DecisionBlock(BaseBlock):
    LABEL = "Decision"
    DESCRIPTION = "A caregiver picks one of several declared outcomes."
    ICON = "fork"
    LANE_KINDS = (LANE_KIND_CAREGIVER,)
    RESULT_TYPE = DecisionResult
    FIELD_MODES = {
        "prompt":  FieldMode.ALWAYS_STATIC,
        "outputs": FieldMode.ALWAYS_STATIC,
        "mode":    FieldMode.ALWAYS_STATIC,
    }

    prompt: str
    outputs: tuple[str, ...]                        # e.g. ("biopsy", "no_biopsy")
    mode: Literal["xor", "and"] = "xor"             # XOR = one branch fires; AND = all selected fire
```
Result: `{ chosen_output: str, notes: str | None }`

A downstream block references the chosen branch via `input_logic`:
```python
input_logic = [
    InputRule(node="biopsy-decision", predicate="decision_output", args={"output_key": "biopsy"}),
]
```

### 3. LusciiProgramBlock — mid-execution events

```python
class LusciiProgramBlock(BaseBlock):
    LABEL = "Luscii program"
    DESCRIPTION = "Embeds a Luscii care path; emits events back into the pathway."
    ICON = "activity"
    LANE_KINDS = (LANE_KIND_PATIENT,)
    EVENTS = ("out_of_bounds", "abandoned", "completed")
    RESULT_TYPE = LusciiProgramResult
    FIELD_MODES = {
        "program_ref":              FieldMode.ALWAYS_STATIC,
        "days_in_advance_of_anchor": FieldMode.BUILDER_CHOICE,
    }

    program_ref: str
    days_in_advance_of_anchor: int
```
Luscii emits mid-flight events. A Task block can fire on `out_of_bounds` without the Luscii block being complete:
```python
input_logic = [
    InputRule(node="luscii-measurements", predicate="event", args={"event_type": "out_of_bounds"}),
]
```
Clinical thresholds come from **Luscii**, never from our builder (MDR firewall).

---

## Business logic — how blocks compose

**input_logic** = when a block may trigger. A list of rules over upstream block state, results or events. Closed predicate set:
```
if_done · if_not_done_within · result_field_equals · result_field_in
· decision_output · event · aggregator_all_of · aggregator_n_of_m · aggregator_any_of
```
**No** `numeric_compare` and no free expression language — otherwise we cross into MDR medical-device territory.

**timing_policy** = how long, or when. Allowed shapes:
```
Immediate · FixedDuration · WaitAfter(node, offset) · WaitBefore(node, offset)
· AtEnrollmentPickedDate(deferred_field)
```
`WaitBefore` reaches forward to a **future** block's `scheduled_at` — that is how you schedule "send pre-op info 5 days before Operation".

**FIELD_MODES** = per-field declaration on each block class. `ALWAYS_STATIC` fields are baked in the template; `ALWAYS_DEFERRED` fields are always supplied at runtime; `BUILDER_CHOICE` fields are flipped per instance by the builder. Deferred values get filled either `at_enrollment` (one form up front) or `at_block_trigger` (inline form when the block activates).

---

## Runtime lifecycle of a block

States: `pending → scheduled → active → blocked → complete | skipped | failed`

Per enrollment, every template block spawns a `BlockExecution` row holding state, timestamps, the active actor, emitted events, and the typed `result` once complete. Templates are **immutable** (pinned to a published pathway version); runtime can only mutate state, result, and deferred values.

---

## One line

> A block is **not** a row of data — it is **a typed class with its own fields, logic, events and UI**. Graph relations emerge from `input_logic` references, not from an edge table.
