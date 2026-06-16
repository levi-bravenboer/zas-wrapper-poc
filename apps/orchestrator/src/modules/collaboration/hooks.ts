import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  addNote,
  createAttachment,
  deleteAttachment,
  fetchAttachments,
  fetchNotes,
  uploadToPresignedUrl,
} from './api'
import { attachmentsKey, notesKey } from './keys'
import type { Attachment, Note, OwnerType } from './types'

export function useNotes(ownerType: OwnerType, ownerId: string): UseQueryResult<Note[], Error> {
  return useQuery({
    queryKey: notesKey(ownerType, ownerId),
    queryFn: () => fetchNotes(ownerType, ownerId),
  })
}

export function useAddNote(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<Note, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => addNote(ownerType, ownerId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: notesKey(ownerType, ownerId) }),
  })
}

export function useAttachments(
  ownerType: OwnerType,
  ownerId: string,
): UseQueryResult<Attachment[], Error> {
  return useQuery({
    queryKey: attachmentsKey(ownerType, ownerId),
    queryFn: () => fetchAttachments(ownerType, ownerId),
  })
}

export function useUploadAttachment(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<void, Error, File> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { upload_url } = await createAttachment(ownerType, ownerId, {
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size: file.size,
      })
      await uploadToPresignedUrl(upload_url, file)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: attachmentsKey(ownerType, ownerId) }),
  })
}

export function useDeleteAttachment(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(ownerType, ownerId, attachmentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: attachmentsKey(ownerType, ownerId) }),
  })
}
