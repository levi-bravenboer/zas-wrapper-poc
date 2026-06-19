"""User-domain enums.

The fixed `Role` enum (`admin | caregiver | patient`) was removed by
`dynamic-rbac-roles-permissions`: a user's role is now `users.role_id` → the
tenant-scoped `roles` table (`app.db.models.access.role.Role`), and
identity-type (patient / caregiver / external) is derived from data
(`patient_id` / a `Practitioner` row / org-tree), never from a role.

This module is intentionally left without enums; kept as a stable import
location in case user-domain enums are reintroduced.
"""

from __future__ import annotations
