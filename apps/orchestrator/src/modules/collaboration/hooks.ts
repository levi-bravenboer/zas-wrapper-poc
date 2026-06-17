import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { addNote, deleteNote, fetchNotes, uploadToPresignedUrl } from './api'
import { notesKey } from './keys'
import type { Note, OwnerType } from './types'

export function useNotes(ownerType: OwnerType, ownerId: string): UseQueryResult<Note[], Error> {
  return useQuery({
    queryKey: notesKey(ownerType, ownerId),
    queryFn: () => fetchNotes(ownerType, ownerId),
  })
}

export function useAddNote(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      await addNote(ownerType, ownerId, { body })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: notesKey(ownerType, ownerId) }),
  })
}

/** Upload a file as a note: create the file note (presigned PUT), then push the
 *  bytes straight to storage. */
export function useUploadFileNote(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<void, Error, File> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { upload_url } = await addNote(ownerType, ownerId, {
        file: {
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size: file.size,
        },
      })
      if (upload_url) await uploadToPresignedUrl(upload_url, file)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: notesKey(ownerType, ownerId) }),
  })
}

export function useDeleteNote(
  ownerType: OwnerType,
  ownerId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => deleteNote(ownerType, ownerId, noteId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: notesKey(ownerType, ownerId) }),
  })
}
