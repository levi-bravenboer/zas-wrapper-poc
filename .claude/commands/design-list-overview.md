---
name: "Design: List overview"
description: Structured intake before building a new list/overview page. Invokes the `design-list-overview` skill to capture resource, columns, filters, sort, row-click, expand, row actions, bulk actions, realtime topic, persistence, permissions, and copy.
category: Design
tags: [design, datatable, intake, overview]
---

Invoke the `design-list-overview` skill to run the intake.

The argument after `/design-list-overview` should be a short description of the page the user wants to build (e.g. "overview of care pathways" or "list of patient consents"). The skill will turn that into a kebab-case resource and then ask the structured questions in order.

Do NOT start writing files until the user has confirmed the summary at the end of intake.

See `.claude/skills/design-list-overview/SKILL.md` for the full intake checklist.
