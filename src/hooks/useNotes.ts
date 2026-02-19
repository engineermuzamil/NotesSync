import { useAuthStore } from '@/src/stores/authStore'
import * as notesDb from '@/src/db/notes'
import type { Note, NoteId } from '@/src/types'
import { useState, useCallback, useEffect } from 'react'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const user = useAuthStore((state) => state.user)

  const loadNotes = useCallback(async (): Promise<void> => {
    if (!user) {
      setNotes([])
      setIsLoading(false)
      return
    }

    try {
      const fetchedNotes = notesDb.getNotes(user.id)
      setNotes(fetchedNotes)
    } catch (error) {
      console.error('Failed to load notes:', error)
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const createNote = useCallback(
    async (input: notesDb.CreateNoteInput): Promise<Note> => {
      if (!user) {
        throw new Error('User not authenticated')
      }

      const newNote = notesDb.createNote({
        ...input,
        userId: user.id,
      })

      setNotes((prev) => [newNote, ...prev])
      return newNote
    },
    [user]
  )

  const updateNote = useCallback(
    async (id: NoteId, input: notesDb.UpdateNoteInput): Promise<Note | null> => {
      const updatedNote = notesDb.updateNote(id, input)
      if (updatedNote) {
        setNotes((prev) =>
          prev.map((note) => (note.id === id ? updatedNote : note))
        )
      }
      return updatedNote
    },
    []
  )

  const deleteNote = useCallback(async (id: NoteId): Promise<boolean> => {
    const success = notesDb.deleteNote(id)
    if (success) {
      setNotes((prev) => prev.filter((note) => note.id !== id))
    }
    return success
  }, [])

  const getNoteById = useCallback(
    (id: NoteId): Note | undefined => {
      return notes.find((note) => note.id === id)
    },
    [notes]
  )

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  return {
    notes,
    isLoading,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    getNoteById,
  }
}
