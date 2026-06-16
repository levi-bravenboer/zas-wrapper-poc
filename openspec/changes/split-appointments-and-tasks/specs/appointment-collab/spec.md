## ADDED Requirements

### Requirement: Appointments carry append-only attributed notes

The backend SHALL persist an `appointment_notes` table (`appointment_id` FK `appointments.id` ON DELETE CASCADE, `author_user_id` FK `users.id` ON DELETE RESTRICT, `body` text NOT NULL, plus inherited columns). Notes are **append-only** at this tier — there is NO edit or delete route. Every note records its author and creation time.

Authorship is **not** restricted to internal staff: any user with visibility of the appointment MAY add a note — internal `ADMIN | CAREGIVER` participants AND **external collaborators** (e.g. a referring GP / `external_reader`-type user holding an access grant to the appointment's patient). The note feed attributes each author by display name regardless of internal/external origin. The guard is "caller can see this appointment" (the same visibility predicate as the read API, which already admits external grant-holders), NOT a fixed role set.

The backend SHALL expose `GET /appointments/{appointment_id}/notes` (chronological, each note carrying the author's display name + timestamp) and `POST /appointments/{appointment_id}/notes` (`{ body }` → 201). Both SHALL require visibility of the appointment.

#### Scenario: Note records its author

- **WHEN** a caregiver POSTs a note to an appointment they can see
- **THEN** the stored note's `author_user_id` MUST equal the caller, and `GET .../notes` MUST return it with the author's display name and creation timestamp

#### Scenario: Notes are append-only

- **WHEN** the appointment notes router is inspected
- **THEN** only `GET` (list) and `POST` (add) routes exist — no `PATCH`/`PUT`/`DELETE`

#### Scenario: Note add requires appointment visibility

- **WHEN** a user without visibility of an appointment POSTs a note to it
- **THEN** the response MUST be `404 Not Found` (existence hiding), and no note is created

#### Scenario: External collaborator can author a note

- **WHEN** an external collaborator holding an access grant to the appointment's patient POSTs a note
- **THEN** the note MUST be created with that external user as author, and `GET .../notes` MUST attribute it by their display name

### Requirement: Appointments carry document attachments on S3-compatible storage

The backend SHALL persist an `appointment_attachments` metadata table (`appointment_id` FK ON DELETE CASCADE, `uploaded_by` FK `users.id` ON DELETE RESTRICT, `filename`, `content_type`, `size` int, `storage_key` unique, plus inherited columns including `deleted_at` for soft-delete). Attachment **bytes** SHALL live in S3-compatible object storage (MinIO in local dev; an EU-region S3 bucket in deployed environments) addressed by `storage_key` — bytes MUST NOT be proxied through the API.

The backend SHALL expose, all guarded by appointment visibility:
- `GET /appointments/{id}/attachments` — metadata list (each with uploader display name + timestamp).
- `POST /appointments/{id}/attachments` — validate `size` against a server-side max of **50 MB** (no content-type allow-list — any type accepted at this tier), create the metadata row, and return a short-TTL **presigned PUT URL** for the client to upload bytes directly.
- `GET /appointments/{id}/attachments/{attachment_id}/url` — return a short-TTL **presigned GET URL** for download.
- `DELETE /appointments/{id}/attachments/{attachment_id}` — **the uploader** may soft-delete their own attachment (`deleted_at` set); a non-uploader receives `403`/`404`. S3 bytes are left to a bucket lifecycle rule, not deleted inline.

`Task`, `appointment_notes`, and `appointment_attachments` SHALL declare `__realtime_resource__` (live invalidation) and `__audited__ = True` (audit-trail capture of create/delete).

#### Scenario: Upload mints a presigned PUT, bytes bypass the API

- **WHEN** a caregiver POSTs attachment metadata (filename, content_type, size) within the 50 MB cap
- **THEN** the response MUST include a short-TTL presigned PUT URL, a metadata row MUST exist with `uploaded_by` = caller, and the API MUST NOT receive the file bytes

#### Scenario: Oversize is rejected before presign

- **WHEN** a caregiver requests an upload with `size` over 50 MB
- **THEN** the response MUST be `422` and NO metadata row or presigned URL is created (size is the only upload limit — any content type is accepted)

#### Scenario: Download is a short-TTL presigned GET

- **WHEN** a caregiver requests an attachment's download URL for an appointment they can see
- **THEN** the response MUST be a short-TTL presigned GET URL for the `storage_key`

#### Scenario: Only the uploader can delete an attachment

- **WHEN** a user `DELETE`s an attachment they did NOT upload
- **THEN** the response MUST be `403`/`404` and the row stays; **WHEN** the original uploader deletes it, `deleted_at` is set and it drops from the list

#### Scenario: Notes and attachments emit realtime + audit events

- **WHEN** a note is added or an attachment is uploaded/deleted
- **THEN** a realtime invalidation MUST fire for the resource, and an audit event MUST be recorded (actor + action) via the `__audited__` hook

### Requirement: Attachment storage backend is S3-compatible and config-swappable

The backend SHALL access object storage through the S3 API (MinIO locally, real AWS S3 when deployed — NOT LocalStack; S3 is the only AWS-managed service in scope). Config: `BACKEND_S3_ENDPOINT_URL` (server-side ops), `BACKEND_S3_PUBLIC_URL` (presigned-URL host for the browser), `BACKEND_S3_BUCKET`, `BACKEND_S3_REGION`, credentials. Locally the two endpoints differ (`minio:9000` internal vs `localhost:9000` public) because SigV4 signs the host and the browser cannot resolve the docker service name; in AWS both resolve to the one real S3 host. No code change SHALL be required to move between local dev and AWS — only configuration.

#### Scenario: Presigned URL is reachable by the browser

- **WHEN** the backend mints a presigned PUT/GET URL locally
- **THEN** the URL host MUST be the browser-reachable `BACKEND_S3_PUBLIC_URL` (e.g. `localhost:9000`), NOT the internal docker endpoint, so the upload/download succeeds from the browser

#### Scenario: Same client, two backends

- **WHEN** `BACKEND_S3_ENDPOINT_URL` points at the local MinIO container
- **THEN** uploads/downloads MUST function against MinIO; and pointed at real S3 with AWS credentials, the same client MUST work with no code change
