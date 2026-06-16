import type { components } from '@/lib/api/schema'

export type Note = components['schemas']['NoteRead']
export type Attachment = components['schemas']['AttachmentRead']
export type AttachmentUploadResponse = components['schemas']['AttachmentUploadResponse']
export type OwnerType = Note['owner_type']
