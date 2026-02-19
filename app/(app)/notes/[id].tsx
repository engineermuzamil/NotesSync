import { getNoteById as getDbNoteById } from '@/src/db/notes'
import { useNotes } from '@/src/hooks/useNotes'
import type { NoteId } from '@/src/types'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { updateNote, deleteNote } = useNotes()
  const noteId = typeof id === 'string' ? (id as NoteId) : null
  const [note, setNote] = useState(() =>
    noteId ? getDbNoteById(noteId) : null
  )

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)

  const saveTimeoutRef = useRef<number | null>(null)

  // Auto-save with debounce
  const debouncedSave = (
    newTitle: string,
    newBody: string,
    newIsPinned: boolean
  ): void => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (noteId) {
        updateNote(noteId, {
          title: newTitle,
          body: newBody,
          isPinned: newIsPinned,
        })
      }
    }, 500) as unknown as number
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!noteId) {
      setNote(null)
      setTitle('')
      setBody('')
      setIsPinned(false)
      return
    }

    const loadedNote = getDbNoteById(noteId)
    setNote(loadedNote)

    if (!loadedNote) {
      setTitle('')
      setBody('')
      setIsPinned(false)
      return
    }

    setTitle(loadedNote.title)
    setBody(loadedNote.body ?? '')
    setIsPinned(loadedNote.isPinned)
  }, [noteId])

  const handleTitleChange = (text: string): void => {
    setTitle(text)
    debouncedSave(text, body, isPinned)
  }

  const handleBodyChange = (text: string): void => {
    setBody(text)
    debouncedSave(title, text, isPinned)
  }

  const handleTogglePin = (): void => {
    const newPinned = !isPinned
    setIsPinned(newPinned)
    if (noteId) {
      updateNote(noteId, { isPinned: newPinned })
    }
  }

  const handleDelete = (): void => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (noteId) {
            await deleteNote(noteId)
            router.back()
          }
        },
      },
    ])
  }

  const handleBack = (): void => {
    router.back()
  }

  if (!note) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Note not found</Text>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.headerButtonText}>← Back</Text>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={handleTogglePin}>
            <Text style={styles.headerButtonText}>
              {isPinned ? '📌 Unpin' : '📌 Pin'}
            </Text>
          </Pressable>

          <Pressable style={styles.headerButton} onPress={handleDelete}>
            <Text style={[styles.headerButtonText, styles.deleteText]}>
              🗑️ Delete
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Note title"
          placeholderTextColor="#999"
          multiline
          autoFocus
        />

        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={handleBodyChange}
          placeholder="Start writing..."
          placeholderTextColor="#999"
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.syncStatus}>
          {note.syncStatus === 'pending' && '⏳ Syncing...'}
          {note.syncStatus === 'synced' && '✓ Synced'}
          {note.syncStatus === 'failed' && '❌ Sync failed'}
        </Text>
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(note.updatedAt).toLocaleString()}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteText: {
    color: '#FF3B30',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    paddingVertical: 8,
  },
  bodyInput: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    minHeight: 200,
    paddingVertical: 8,
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  syncStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
})
