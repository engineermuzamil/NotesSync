import * as noteItemsDb from '@/src/db/note-items'
import { useAuthStore } from '@/src/stores/authStore'
import type { NoteId, NoteItem, NoteItemId, NoteType } from '@/src/types'
import { useCallback, useState } from 'react'

interface CreateItemInput {
  noteId: NoteId
  type: NoteType
  content: string
  position?: number
  isChecked?: boolean
}

export function useNoteItems() {
  const [items, setItems] = useState<NoteItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<NoteId | null>(null)
  const user = useAuthStore((state) => state.user)

  const loadItems = useCallback(async (noteId: NoteId): Promise<void> => {
    setIsLoading(true)
    try {
      const fetchedItems = noteItemsDb.getNoteItems(noteId)
      setItems(fetchedItems)
      setActiveNoteId(noteId)
    } catch {
      setItems([])
      setActiveNoteId(noteId)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createItem = useCallback(
    async (input: CreateItemInput): Promise<NoteItem | null> => {
      if (!user) {
        throw new Error('User not authenticated')
      }

      const createdItem = noteItemsDb.createNoteItem({
        ...input,
        userId: user.id,
      })

      if (!createdItem) {
        return null
      }

      setItems((prev) => [...prev, createdItem])
      setActiveNoteId(input.noteId)
      return createdItem
    },
    [user]
  )

  const updateItem = useCallback(
    async (
      id: NoteItemId,
      input: noteItemsDb.UpdateNoteItemInput
    ): Promise<NoteItem | null> => {
      const updatedItem = noteItemsDb.updateNoteItem(id, input)
      if (!updatedItem) {
        return null
      }

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          return updatedItem
        })
      )

      return updatedItem
    },
    []
  )

  const deleteItem = useCallback(async (id: NoteItemId): Promise<boolean> => {
    const isDeleted = noteItemsDb.deleteNoteItem(id)
    if (!isDeleted) {
      return false
    }

    setItems((prev) => prev.filter((item) => item.id !== id))
    return true
  }, [])

  const reorderItems = useCallback(
    async (noteId: NoteId, orderedItemIds: NoteItemId[]): Promise<void> => {
      noteItemsDb.reorderNoteItems(noteId, orderedItemIds)

      if (activeNoteId !== noteId) {
        return
      }

      setItems((prev) => {
        const nextItems = [...prev]
        const itemMap = new Map(nextItems.map((item) => [item.id, item]))

        return orderedItemIds
          .map((id, index) => {
            const item = itemMap.get(id)
            if (!item) return null
            return {
              ...item,
              position: index,
            }
          })
          .filter((item): item is NoteItem => item !== null)
      })
    },
    [activeNoteId]
  )

  const uncheckAllItems = useCallback(
    async (noteId: NoteId): Promise<void> => {
      const noteItems = noteItemsDb.getNoteItems(noteId)
      const checkedItems = noteItems.filter((item) => item.isChecked)

      checkedItems.forEach((item) => {
        noteItemsDb.updateNoteItem(item.id, { isChecked: false })
      })

      if (activeNoteId !== noteId) {
        return
      }

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isChecked: false,
        }))
      )
    },
    [activeNoteId]
  )

  return {
    items,
    isLoading,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    uncheckAllItems,
  }
}
