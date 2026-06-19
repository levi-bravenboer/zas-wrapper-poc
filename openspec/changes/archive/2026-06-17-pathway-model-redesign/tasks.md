# Tasks

## 1. Domain model

- [ ] 1.1 Introduce `BaseBlock` with shared fields and retire `BlockTypeEntry` registry
- [ ] 1.2 Add concrete block subclasses with typed kind-specific fields
- [ ] 1.3 Move per-kind metadata (label, icon, lanes, branch support) onto the subclasses

## 2. Connectivity

- [ ] 2.1 Add per-block `input_logic` with closed predicate vocabulary + aggregator
- [ ] 2.2 Expose typed `outputs` on branching blocks
- [ ] 2.3 Materialise `pathway_edge_view` as a derived projection

## 3. Timing + deferred fields

- [ ] 3.1 Split `TimingPolicy` (template) from `BlockExecution` (runtime)
- [ ] 3.2 Add first-class deferred-field slot definitions on block subclasses
- [ ] 3.3 Validate required deferred fields at enrollment

## 4. Aggregates + migration

- [ ] 4.1 Add `PathwayEnrollment` aggregate owning `BlockExecution` + `DeferredFieldValue`
- [ ] 4.2 One-shot data migration from old `PathwayBlock` rows into the new hierarchy
- [ ] 4.3 Compatibility serialiser for the old API shape during transition
