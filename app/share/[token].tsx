import { getDb } from '@/src/db'
import { createNote, getNoteById as getDbNoteById } from '@/src/db/notes'
import { useAuthStore } from '@/src/stores/authStore'
import type { Note, NoteId, NoteType } from '@/src/types'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

export default function SharedNotePreviewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const user = useAuthStore((state) => state.user)
  const [sharedNote, setSharedNote] = useState<Note | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSharedNote = (): void => {
      const shareToken = typeof token === 'string' ? token : ''

      if (!shareToken) {
        setSharedNote(null)
        setIsLoading(false)
        return
      }

      try {
        const db = getDb()
        const shareRow = db.getFirstSync<{
          note_id: string
          visibility: string
          is_revoked: number
        }>(
          'SELECT note_id, visibility, is_revoked FROM note_shares WHERE token = ? LIMIT 1',
          shareToken
        )

        if (!shareRow) {
          setSharedNote(null)
          setIsLoading(false)
          return
        }

        if (shareRow.visibility !== 'public' || shareRow.is_revoked === 1) {
          setSharedNote(null)
          setIsLoading(false)
          return
        }

        const note = getDbNoteById(shareRow.note_id as NoteId)
        setSharedNote(note)
      } catch {
        setSharedNote(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadSharedNote()
  }, [token])

  const handleCopyToMyAccount = (): void => {
    if (!sharedNote) {
      return
    }

    if (!user) {
      Alert.alert(
        'Login required',
        'Sign in to save your own copy of this note.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Go to Login',
            onPress: () => {
              router.push('/(auth)/login')
            },
          },
        ]
      )
      return
    }

    const copiedTitle =
      sharedNote.title.trim().length > 0
        ? `Copy of ${sharedNote.title}`
        : 'Copy of Untitled note'

    const copiedNote = createNote({
      userId: user.id,
      type: sharedNote.type as NoteType,
      title: copiedTitle,
      body: sharedNote.body,
      isPinned: false,
      isArchived: false,
      colorLabel: sharedNote.colorLabel,
    })

    Alert.alert('Copied', 'A new independent copy was saved to your account.', [
      {
        text: 'Open copy',
        onPress: () => {
          router.replace(`/(app)/notes/${copiedNote.id}`)
        },
      },
      {
        text: 'Done',
        style: 'cancel',
      },
    ])
  }

  const handleGoBack = (): void => {
    router.back()
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.loadingText}>Loading shared note...</Text>
      </View>
    )
  }

  if (!sharedNote) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Shared note unavailable</Text>
        <Text style={styles.message}>
          This link is invalid, revoked, or not available on this device yet.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={handleGoBack}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Public Note Preview</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <Text style={styles.noteTitle}>
          {sharedNote.title || 'Untitled note'}
        </Text>
        <Text style={styles.noteMeta}>Type: {sharedNote.type}</Text>
        <Text style={styles.noteBody}>{sharedNote.body ?? ''}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={handleCopyToMyAccount}>
          <Text style={styles.primaryButtonText}>
            Save a copy to my account
          </Text>
        </Pressable>
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    gap: 10,
  },
  noteTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  noteMeta: {
    fontSize: 13,
    color: '#666',
  },
  noteBody: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: '#eef5ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
})
