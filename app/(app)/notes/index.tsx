import { useNotes } from '@/src/hooks/useNotes'
import { useAuthStore } from '@/src/stores/authStore'
import type { Note } from '@/src/types'
import { useFocusEffect } from '@react-navigation/native'
import { router, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

export default function NotesListScreen() {
  const {
    notes,
    archivedNotes,
    isLoading,
    loadNotes,
    loadArchivedNotes,
    createNote,
    deleteNote,
    archiveNote,
    unarchiveNote,
  } = useNotes()
  const { logout } = useAuthStore()
  const [isCreating, setIsCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (showArchived) {
        loadArchivedNotes()
      } else {
        loadNotes()
      }
    }, [loadArchivedNotes, loadNotes, showArchived])
  )

  const handleLogout = async (): Promise<void> => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const handleCreateNote = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)

    try {
      const newNote = await createNote({
        type: 'text',
        title: '',
        body: '',
        userId: '', // Will be set by hook
      })
      router.push(`/(app)/notes/${newNote.id}` as Href)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create note'
      Alert.alert('Error', errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const handleFabPress = (): void => {
    handleCreateNote()
  }

  const handleArchiveNote = async (note: Note): Promise<void> => {
    await archiveNote(note.id)
  }

  const handleRestoreNote = async (note: Note): Promise<void> => {
    await unarchiveNote(note.id)
  }

  const handleDeleteNote = async (note: Note): Promise<void> => {
    await deleteNote(note.id)
  }

  const handleNoteLongPress = (note: Note): void => {
    if (showArchived) {
      Alert.alert('Archived Note', `Choose action for "${note.title || 'Untitled'}"`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            await handleRestoreNote(note)
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await handleDeleteNote(note)
          },
        },
      ])
      return
    }

    Alert.alert('Note Actions', `Choose action for "${note.title || 'Untitled'}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          await handleArchiveNote(note)
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await handleDeleteNote(note)
        },
      },
    ])
  }

  const handleToggleArchived = (): void => {
    const nextShowArchived = !showArchived
    setShowArchived(nextShowArchived)

    if (nextShowArchived) {
      loadArchivedNotes()
      return
    }

    loadNotes()
  }

  const handleNotePress = (noteId: string): void => {
    router.push(`/(app)/notes/${noteId}` as Href)
  }

  const renderNote = ({ item }: { item: Note }) => (
    <Pressable
      style={styles.noteCard}
      onPress={() => handleNotePress(item.id)}
      onLongPress={() => handleNoteLongPress(item)}
    >
      <View style={styles.noteHeader}>
        {item.isPinned && <Text style={styles.pinnedBadge}>📌 Pinned</Text>}
        <Text style={styles.syncStatus}>
          {item.syncStatus === 'pending' && '⏳'}
          {item.syncStatus === 'synced' && '✓'}
          {item.syncStatus === 'failed' && '❌'}
        </Text>
      </View>
      <Text style={styles.noteTitle} numberOfLines={1}>
        {item.title || 'Untitled'}
      </Text>
      {item.body && (
        <Text style={styles.noteBody} numberOfLines={2}>
          {item.body}
        </Text>
      )}
      <Text style={styles.noteDate}>
        {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
    </Pressable>
  )

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {showArchived ? 'No archived notes' : 'No notes yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {showArchived
          ? 'Long press a note in main list and archive it'
          : 'Tap + to create your first note'}
      </Text>
    </View>
  )

  const displayedNotes = showArchived ? archivedNotes : notes

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{showArchived ? 'Archived' : 'Notes'}</Text>
        <View style={styles.headerRightActions}>
          <Pressable style={styles.archiveToggleButton} onPress={handleToggleArchived}>
            <Text style={styles.archiveToggleText}>
              {showArchived ? 'Show Notes' : 'Show Archived'}
            </Text>
          </Pressable>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={displayedNotes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          displayedNotes.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
      />

      <Pressable
        style={[styles.fab, isCreating && styles.fabDisabled]}
        onPress={handleFabPress}
        disabled={isCreating}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archiveToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  archiveToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinnedBadge: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
  },
  syncStatus: {
    fontSize: 14,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  noteBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDisabled: {
    backgroundColor: '#ccc',
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
})
