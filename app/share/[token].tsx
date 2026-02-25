import { getEnv } from '@/src/config/env'
import {
  incrementShareAccessByToken,
  incrementShareCopyByToken,
} from '@/src/db/note-shares'
import { createNote } from '@/src/db/notes'
import { loadSession } from '@/src/services/sessionService'
import { useAuthStore } from '@/src/stores/authStore'
import type { NoteId, NoteType } from '@/src/types'
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
  const [sharedNoteId, setSharedNoteId] = useState<NoteId | null>(null)
  const [sharedNoteTitle, setSharedNoteTitle] = useState('')
  const [sharedNoteBody, setSharedNoteBody] = useState<string | null>(null)
  const [sharedNoteType, setSharedNoteType] = useState<NoteType>('text')
  const [sharedNoteColorLabel, setSharedNoteColorLabel] = useState<
    string | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSharedNote = async (): Promise<void> => {
      const shareToken = typeof token === 'string' ? token : ''

      if (!shareToken) {
        setSharedNoteId(null)
        setIsLoading(false)
        return
      }

      try {
        const env = getEnv()
        const endpoint = `${env.supabaseUrl}/functions/v1/note-share?token=${encodeURIComponent(shareToken)}`
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: env.supabaseAnonKey,
            authorization: `Bearer ${env.supabaseAnonKey}`,
          },
        })

        if (!response.ok) {
          setSharedNoteId(null)
          setIsLoading(false)
          return
        }

        const payload = (await response.json()) as Record<string, unknown>
        const notePayload = payload.note as Record<string, unknown>
        const noteId = notePayload.id
        const noteTitle = notePayload.title
        const noteBody = notePayload.body
        const noteType = notePayload.type
        const noteColorLabel = notePayload.colorLabel

        if (
          typeof noteId !== 'string' ||
          typeof noteTitle !== 'string' ||
          (noteBody !== null && typeof noteBody !== 'string') ||
          (noteType !== 'text' &&
            noteType !== 'checklist' &&
            noteType !== 'bullets') ||
          (noteColorLabel !== null && typeof noteColorLabel !== 'string')
        ) {
          setSharedNoteId(null)
          setIsLoading(false)
          return
        }

        setSharedNoteId(noteId as NoteId)
        setSharedNoteTitle(noteTitle)
        setSharedNoteBody(noteBody as string | null)
        setSharedNoteType(noteType)
        setSharedNoteColorLabel(noteColorLabel as string | null)

        incrementShareAccessByToken(shareToken)
      } catch {
        setSharedNoteId(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadSharedNote().catch(() => {
      setSharedNoteId(null)
      setIsLoading(false)
    })
  }, [token])

  const handleCopyToMyAccount = async (): Promise<void> => {
    if (!sharedNoteId) {
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

    const shareToken = typeof token === 'string' ? token : ''

    const copiedTitle =
      sharedNoteTitle.trim().length > 0
        ? `Copy of ${sharedNoteTitle}`
        : 'Copy of Untitled note'

    const copiedNote = createNote({
      userId: user.id,
      type: sharedNoteType,
      title: copiedTitle,
      body: sharedNoteBody,
      isPinned: false,
      isArchived: false,
      colorLabel: sharedNoteColorLabel,
    })

    if (shareToken) {
      incrementShareCopyByToken(shareToken)
    }

    const session = await loadSession()
    if (session && shareToken) {
      const env = getEnv()
      const endpoint = `${env.supabaseUrl}/functions/v1/note-share?token=${encodeURIComponent(shareToken)}`
      fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: env.supabaseAnonKey,
          authorization: `Bearer ${session.accessToken}`,
          'content-type': 'application/json',
        },
      }).catch(() => {})
    }

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

  if (!sharedNoteId) {
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
          {sharedNoteTitle || 'Untitled note'}
        </Text>
        <Text style={styles.noteMeta}>Type: {sharedNoteType}</Text>
        <Text style={styles.noteBody}>{sharedNoteBody ?? ''}</Text>
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
