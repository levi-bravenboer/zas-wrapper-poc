# Luscii SDK & API — Custom Patient App Capabilities

> Research note: scoping a custom-branded patient mobile app on top of Luscii.
> Source: [Luscii Actions Swift SDK docs](https://luscii.github.io/actions-swift/latest/documentation/actions/gettingstarted).
> Last updated: 2026-05-12.

## Context

Question: if we build our own patient mobile app, how much of the existing Luscii patient app behaviour can we replicate using the public Luscii Actions Swift SDK (and/or REST API)?

Short answer: the SDK only covers the **measurement / action loop**. Everything else (chat, video, education, appointments, push delivery) is either backend-only, behind a partner agreement, or DIY.

## Luscii Actions Swift SDK — surface

Entry class: `Luscii` (auth required before any call).

| Capability                       | API                                                |
| -------------------------------- | -------------------------------------------------- |
| Fetch scheduled actions for today | `todayActions()`                                   |
| Fetch ad-hoc / self-care actions  | `selfCareActions()`                                |
| Launch pre-built measurement UI   | `launchActionFlow(for:on:)` (SwiftUI + UIKit)      |
| Submit measurements programmatically | `submitMeasurements(_:for:completedAt:)`        |
| Observe flow outcome             | `NotificationCenter` `.actionFlowFinished`         |
| Data models                      | DTOs for measurements, instruments, components, planned actions |

iOS only (Swift). No Android SDK confirmed.

## Luscii patient app — feature inventory

Typical features in the off-the-shelf Luscii patient app:

1. Daily measurements (BP, weight, SpO2, glucose, temperature — Bluetooth + manual)
2. Questionnaires / PROMs
3. Symptom check-ins
4. Personalized care program / care plan
5. Reminders + push notifications
6. Educational content (videos, articles, tips)
7. Chat with care team
8. Video consults
9. Appointments calendar
10. Medication reminders / adherence
11. Trend graphs / history of own data
12. Threshold alerts (red flags routed to clinician)
13. Onboarding + consent flow
14. Profile + account management
15. Multi-language
16. Bluetooth device pairing (Withings, A&D, etc.)
17. Self-care actions (ad-hoc measurements)
18. SSO / magic-link auth

## Coverage matrix

Legend: ✅ supported · ⚠️ partial / build-on-top · ❌ not available · ❓ unconfirmed

| Feature                       | SDK (Actions-Swift)                                  | Luscii REST API (likely)             |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Daily measurements            | ✅ `launchActionFlow` + `submitMeasurements`         | ✅                                   |
| Questionnaires / PROMs        | ✅ modeled as Action                                 | ✅                                   |
| Symptom check-ins             | ✅ Action                                            | ✅                                   |
| Care plan view                | ⚠️ partial via `todayActions()`                      | ✅                                   |
| Reminders / push notifications| ❌ no APNs handling                                  | ⚠️ scheduling data yes, delivery DIY |
| Educational content           | ❌                                                   | ❓ ask Luscii                         |
| Chat with care team           | ❌                                                   | ❓ unlikely public                    |
| Video consults                | ❌                                                   | ❌                                   |
| Appointments                  | ❌                                                   | ❓                                   |
| Medication reminders          | ⚠️ if modeled as Action                              | ✅ if API exposes                    |
| Trend graphs / history        | ⚠️ DTOs available, render own UI                     | ✅                                   |
| Threshold / red-flag alerts   | ❌ server-side, no SDK hook                          | ✅ triggered by submit               |
| Onboarding / consent          | ❌                                                   | ⚠️ partial                            |
| Auth (login)                  | ✅ `Luscii` class                                    | ✅                                   |
| Profile management            | ❌                                                   | ⚠️ depends                            |
| Multi-language                | ⚠️ SDK strings only                                  | n/a                                  |
| Bluetooth device pairing      | ❌ build with CoreBluetooth                          | n/a                                  |
| Self-care actions             | ✅ `selfCareActions()`                               | ✅                                   |
| SSO / magic link              | ⚠️ accepts token only                                | ✅                                   |

## Verdict

- SDK is **fit-for-purpose for measurements + scheduled action checklist** in a custom-branded iOS shell.
- Anything beyond that (comms, content, video, appointments) is **not in the SDK** and requires:
  - Luscii partner-tier REST API access, or
  - Reverse-engineered endpoints (not viable for production), or
  - DIY equivalents that integrate via webhook / EMR side.
- Android = open question — separate Kotlin SDK not confirmed.

## Open questions for Luscii

1. Is there a public/partner REST API contract document?
2. Android SDK availability + parity with Swift SDK?
3. Push notification delivery: does Luscii send APNs/FCM to partner apps, or only to first-party app?
4. Chat + video: any SDK or embeddable widget?
5. Educational content: is it exposed as structured data via API?
6. Auth: does the SDK support OIDC / our own IdP, or only Luscii-issued tokens?
7. SLA + data residency for partner apps in NL/EU healthcare context.

## Next steps

- Confirm partner tier + commercial terms with Luscii.
- Cross-check against `docs/research/luscii-care-pathways-research.md` for clinical pathway coverage.
- Decide build-vs-buy per non-covered feature (chat, video, content).
