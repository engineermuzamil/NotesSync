import {
  createOrEnablePublicShare,
  getNoteShareByNoteId,
  getShareAnalyticsByNoteId,
  revokePublicShare,
} from '@/src/db/note-shares'
import { getNoteById as getDbNoteById } from '@/src/db/notes'
import { useAuthStore } from '@/src/stores/authStore'
import type { NoteId, ShareAnalytics } from '@/src/types'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const PUBLIC_SHARE_BASE_URL = 'https://notessync.app/share'

export default function ShareNoteScreen() {
  const { noteId: paramNoteId } = useLocalSearchParams<{ noteId: string }>()
  const user = useAuthStore((state) => state.user)
  const noteId = (paramNoteId as NoteId) || null

  const [note, setNote] = useState(() =>
    noteId ? getDbNoteById(noteId) : null
  )
  const [noteShare, setNoteShare] = useState(() =>
    noteId ? getNoteShareByNoteId(noteId) : null
  )
  const [shareAnalytics, setShareAnalytics] = useState<ShareAnalytics | null>(
    () => (noteId ? getShareAnalyticsByNoteId(noteId) : null)
  )

  const refreshShareState = (): void => {
    if (!noteId) {
      setNoteShare(null)
      setShareAnalytics(null)
      return
    }

    const loadedShare = getNoteShareByNoteId(noteId)
    const loadedAnalytics = getShareAnalyticsByNoteId(noteId)
    setNoteShare(loadedShare)
    setShareAnalytics(loadedAnalytics)
  }

  useEffect(() => {
    if (!noteId) return

    const loadedNote = getDbNoteById(noteId)
    setNote(loadedNote)

    const loadedShare = getNoteShareByNoteId(noteId)
    const loadedAnalytics = getShareAnalyticsByNoteId(noteId)
    setNoteShare(loadedShare)
    setShareAnalytics(loadedAnalytics)
  }, [noteId])

  const shareUrl =
    noteShare && noteShare.visibility === 'public' && !noteShare.isRevoked
      ? `${PUBLIC_SHARE_BASE_URL}/${noteShare.token}`
      : null

  const handleShareGenerate = (): void => {
    if (!noteId || !user) return

    const updatedShare = createOrEnablePublicShare(noteId, user.id)
    if (!updatedShare) {
      Alert.alert(
        'Share unavailable',
        'Only existing notes owned by your account can be shared.'
      )
      return
    }

    refreshShareState()
    Alert.alert('✨ Public link created!', 'Ready to share with others.')
  }

  const handleShareRevoke = (): void => {
    if (!noteId || !user) return

    Alert.alert('Revoke Public Link', 'This note will become private again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          const updatedShare = revokePublicShare(noteId, user.id)
          if (!updatedShare) {
            Alert.alert('Revoke failed', 'Unable to revoke this shared URL.')
            return
          }

          refreshShareState()
        },
      },
    ])
  }

  const handleCopyLink = async (): Promise<void> => {
    if (!shareUrl) return

    try {
      await Share.share({
        message: `Check out my note: ${shareUrl}`,
        url: shareUrl,
        title: 'Share Note',
      })
    } catch {
      Alert.alert('Error', 'Could not copy link to clipboard.')
    }
  }

  const handleBack = (): void => {
    router.back()
  }

  if (!note) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Share Note</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Note not found</Text>
        </View>
      </View>
    )
  }

  const isShared = shareUrl && noteShare && !noteShare.isRevoked

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Share Note</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.notePreview}>
          <Text style={styles.noteTitle}>{note.title || 'Untitled'}</Text>
          <Text style={styles.notePreviewText} numberOfLines={3}>
            {note.body || 'Empty note'}
          </Text>
        </View>

        {isShared ? (
          <>
            <View style={styles.shareCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardIcon}>🔗</Text>
                  <Text style={styles.cardTitle}>Public Link</Text>
                </View>
                <Text style={styles.badgeActive}>Active</Text>
              </View>

              <View style={styles.urlSection}>
                <Pressable style={styles.urlDisplay} onPress={handleCopyLink}>
                  <Text style={styles.urlText}>{shareUrl}</Text>
                </Pressable>
              </View>

              <Pressable style={styles.copyButton} onPress={handleCopyLink}>
                <Text style={styles.copyButtonIcon}>📋</Text>
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </Pressable>

              {noteShare?.syncStatus === 'pending' && (
                <Text style={styles.syncPending}>
                  ⏱️ Syncing share settings...
                </Text>
              )}
            </View>

            {shareAnalytics && (
              <View style={styles.statsCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardIcon}>📊</Text>
                    <Text style={styles.cardTitle}>Statistics</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {shareAnalytics.accessCount}
                    </Text>
                    <Text style={styles.statLabel}>Views</Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {shareAnalytics.copyCount}
                    </Text>
                    <Text style={styles.statLabel}>Copies</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.revokeCard}>
              <Pressable
                style={styles.revokeButton}
                onPress={handleShareRevoke}
              >
                <Text style={styles.revokeButtonIcon}>🔒</Text>
                <Text style={styles.revokeButtonText}>Revoke Share</Text>
              </Pressable>
              <Text style={styles.revokeText}>
                This note will become private again.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.noShareCard}>
            <Text style={styles.noShareIcon}>🔒</Text>
            <Text style={styles.noShareTitle}>This note is private</Text>
            <Text style={styles.noShareDescription}>
              Generate a public link to share this note with others.
            </Text>
            <Pressable
              style={styles.generateButton}
              onPress={handleShareGenerate}
            >
              <Text style={styles.generateButtonIcon}>✨</Text>
              <Text style={styles.generateButtonText}>
                Generate Public Link
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: -12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  notePreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  notePreviewText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  shareCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  badgeActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#34C759',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  urlSection: {
    marginBottom: 12,
  },
  urlDisplay: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  urlText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
    lineHeight: 18,
  },
  copyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  copyButtonIcon: {
    fontSize: 16,
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  syncPending: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#007AFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e8e8e8',
    marginHorizontal: 16,
  },
  revokeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE8E5',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  revokeButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  revokeButtonIcon: {
    fontSize: 16,
  },
  revokeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  revokeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  noShareCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  noShareIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noShareTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
    textAlign: 'center',
  },
  noShareDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonIcon: {
    fontSize: 16,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
