# Post-MVP roadmap — draft v0.1

Horizon: BAU years 1–3 of the initial 48-month term (2028–2030), plus an outlook to the extension period.
MVP itself is year 0 (2027) and is out of scope here.

Sources: `ZAS BAFO slides` (capability grid + per-user grids), `Post-MVP only` tab, `EN_BAFO_assumptions_v3_1`,
`20260015 Telegeneeskunde Bijkomend bestek Prijsmodel`, original specification IV.7.

## The constraint this roadmap has to respect

Post-MVP work is not project-funded. It is drawn from `Doorontwikkeling (Storypoints)`, a flat annual budget of
**±€175k (2027) rising to ±€200k (2030 and 2036)**. That same budget also pays for new care pathways.

ZAS projects growth from **4 pathways (2027) to >15 (2030) to >50 (2036)**, with monthly active users going
55k → 80k → 155k. The specification's BAU description assumes roughly **3 new pathways per year**.

So every platform feature below competes directly with pathway rollout for the same money. A roadmap that lists
features without saying what they cost against that budget is not decision-useful. Two consequences drive the
sequencing:

1. Anything that lowers the marginal cost of adding a pathway should come first, because it buys back capacity
   for everything after it.
2. Anything that only serves one pathway should wait until that pathway exists.

## Wave 1 (2028) — make pathway scaling cheap

Theme: ZAS has to go from 4 to ~7 pathways this year with the same budget. Spend it on leverage, not features.

| Item | Layer | Why now |
|---|---|---|
| Version binding to Luscii builder | Care pathway builder | Without it every Luscii engine release risks re-validating each pathway. Cost grows linearly with pathway count. |
| HiX terminology mapping | Interoperability | Each new pathway currently re-does mapping by hand. This is the single biggest per-pathway tax. |
| PROMs, PREMs and diary for other care pathways | Luscii telemonitoring | Direct prerequisite for pathways 5, 6, 7 — no new pathway lands without it. |
| Orchestrator Replay | Care pathway platform | Debugging and audit of runtime behaviour across a growing pathway set. Cheap now, painful to retrofit. |
| Patient web portal | Digital front door | Removes the app-install barrier. Prerequisite for representative web access in Wave 2. |

## Wave 2 (2029) — widen who can use it

Theme: reach and equity. Pathway count keeps climbing; the platform now has to serve people the MVP excluded.

| Item | Layer | Why now |
|---|---|---|
| Dedicated representative dashboard | Per-user: representative | MVP only covers minor consent. This adds acting on behalf: chat, booking, paying, questionnaires. |
| Automatic interpreter booking on language choice | Care pathway platform | Depends on the MVP language choice already being captured. Antwerp population need. |
| Video consultation | Digital front door | Moved out of MVP. Standalone value, no upstream dependency. |
| Self-booking and rebooking | Digital front door | Moved out of MVP. Needs HiX slot write access — confirm ChipSoft dependency before committing. |
| Time-bound, per-patient external access | Per-user: external professional | Broadens transmural use beyond the MVP's standing therapeutic relationship. |
| Lab results and medical imaging (ingestion + display) | HiX + care pathway platform | Ingestion and display must ship together; neither is useful alone. |

## Wave 3 (2030) — depth and secondary use

Theme: the pathway portfolio is large enough that cross-pathway insight becomes worth more than new features.

| Item | Layer | Why now |
|---|---|---|
| Data warehouse / data lake feeds | Data platform | Foundation. Everything below depends on it. |
| OMOP secondary-use feed | Data platform | Sized L. Research and secondary use. |
| ICHOM exports pipeline | Data platform | Sized M. Builds on MVP PROMs plus the SHDR store. |
| Cohort and benchmark dashboard | Data platform | Only meaningful once feeds exist and enough pathways are live to benchmark across. |
| Cross-system reporting / BI layer | Data platform | Same dependency. |
| MDO complex decision moments + MDO collaboration | Builder + platform | Extends the MVP multidisciplinary meeting into structured decision support. |

## Outlook (extension period, 2031+)

Deliberately not scheduled — these depend on decisions outside the consortium's control.

- Transmural integrations: CoZo, SumEHR, Vaccinet, e-Verwijzing, additional government interfaces
- Medication management (needs Vitalink and Gedeeld Farmaceutisch Dossier; excluded from MVP by assumption 11)
- MCP server and AI integration layer (gated on AI Act review)
- Other non-HiX integrations, CRM and contact centre platforms, non-HiX internal ZAS applications
- Invoicing, billing and payments
- Custom device integrations beyond the Luscii-supported set
- Non-standard identity federation

## Open items before this can go to ZAS

1. Six post-MVP items are unsized: medication management, patient web portal, other language support,
   lab results display, lab results ingestion, cohort and benchmark dashboard.
2. No per-pathway storypoint cost is estimated, so the split between pathway rollout and platform features
   cannot be shown numerically.
3. Self-booking carries an unconfirmed ChipSoft dependency for HiX slot write access.
4. "Plans for Patients (exercise + treatment tools)" traces to URO-016 prehabilitation. Rename it to reference
   URO-016 so ZAS can follow it, or drop it.
