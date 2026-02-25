import { getNoteById as getDbNoteById } from '@/src/db/notes'
import { useNotes } from '@/src/hooks/useNotes'
import type { NoteId, NoteType } from '@/src/types'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [noteType, setNoteType] = useState<NoteType>('text')

  const saveTimeoutRef = useRef<number | null>(null)

  const normalizeLine = (line: string): string => {
    return line.replace(/^\s*(•\s+|\[\s?[xX ]\]\s+)/, '')
  }

  const adaptBodyForType = (text: string, type: NoteType): string => {
    const lines = text.split('\n')

    if (type === 'text') {
      return lines.map((line) => normalizeLine(line)).join('\n')
    }

    if (type === 'bullets') {
      return lines
        .map((line) => {
          if (line.trim().length === 0) return ''
          const normalized = normalizeLine(line)
          return `• ${normalized}`
        })
        .join('\n')
    }

    return lines
      .map((line) => {
        if (line.trim().length === 0) return ''
        const normalized = normalizeLine(line)
        return `[ ] ${normalized}`
      })
      .join('\n')
  }

  const parseChecklistBody = (
    text: string
  ): { checked: boolean; content: string }[] => {
    const lines = text.split('\n')
    const items = lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const checked = /^\s*\[\s?[xX]\]\s*/.test(line)
        const content = line.replace(/^\s*\[\s?[xX ]\]\s*/, '')
        return {
          checked,
          content,
        }
      })

    return items.length > 0 ? items : [{ checked: false, content: '' }]
  }

  const serializeChecklistBody = (
    items: { checked: boolean; content: string }[]
  ): string => {
    return items
      .map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.content}`)
      .join('\n')
  }

  const parseBulletBody = (text: string): { content: string }[] => {
    const lines = text.split('\n')
    const items = lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const content = line.replace(/^\s*•\s*/, '')
        return { content }
      })

    return items.length > 0 ? items : [{ content: '' }]
  }

  const serializeBulletBody = (items: { content: string }[]): string => {
    return items.map((item) => `• ${item.content}`).join('\n')
  }

  const checklistItems = useMemo(() => {
    if (noteType !== 'checklist')
      return [] as { checked: boolean; content: string }[]
    return parseChecklistBody(body)
  }, [body, noteType])

  const bulletItems = useMemo(() => {
    if (noteType !== 'bullets') return [] as { content: string }[]
    return parseBulletBody(body)
  }, [body, noteType])

  const completedChecklistCount = useMemo(() => {
    if (noteType !== 'checklist') return 0
    return checklistItems.filter((item) => item.checked).length
  }, [checklistItems, noteType])

  // Auto-save with debounce
  const debouncedSave = (
    newTitle: string,
    newBody: string,
    newIsPinned: boolean,
    newType: NoteType
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
          type: newType,
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
      setNoteType('text')
      return
    }

    const loadedNote = getDbNoteById(noteId)
    setNote(loadedNote)

    if (!loadedNote) {
      setTitle('')
      setBody('')
      setIsPinned(false)
      setNoteType('text')
      return
    }

    setTitle(loadedNote.title)
    setBody(loadedNote.body ?? '')
    setIsPinned(loadedNote.isPinned)
    setNoteType(loadedNote.type)
  }, [noteId])

  const handleTitleChange = (text: string): void => {
    setTitle(text)
    debouncedSave(text, body, isPinned, noteType)
  }

  const handleBodyChange = (text: string): void => {
    setBody(text)
    debouncedSave(title, text, isPinned, noteType)
  }

  const handleTypeChange = (type: NoteType): void => {
    if (type === noteType) return

    const adaptedBody = adaptBodyForType(body, type)
    setNoteType(type)
    setBody(adaptedBody)

    if (noteId) {
      updateNote(noteId, {
        type,
        body: adaptedBody,
      })
    }
  }

  const handleChecklistToggle = (index: number): void => {
    if (noteType !== 'checklist') return

    const nextItems = checklistItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        checked: !item.checked,
      }
    })

    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleChecklistTextChange = (index: number, text: string): void => {
    if (noteType !== 'checklist') return

    const nextItems = checklistItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        content: text,
      }
    })

    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleChecklistAddItem = (): void => {
    if (noteType !== 'checklist') return

    const nextItems = [...checklistItems, { checked: false, content: '' }]
    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleChecklistUncheckAll = (): void => {
    if (noteType !== 'checklist') return
    if (completedChecklistCount === 0) return

    const nextItems = checklistItems.map((item) => ({
      ...item,
      checked: false,
    }))

    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleChecklistKeyPress = (index: number, key: string): void => {
    if (noteType !== 'checklist') return
    if (key !== 'Backspace') return

    const currentItem = checklistItems[index]
    if (!currentItem || currentItem.content.length > 0) return
    if (checklistItems.length <= 1) return

    const nextItems = checklistItems.filter(
      (_, itemIndex) => itemIndex !== index
    )
    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleBulletTextChange = (index: number, text: string): void => {
    if (noteType !== 'bullets') return

    const nextItems = bulletItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        content: text,
      }
    })

    const nextBody = serializeBulletBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleBulletAddItem = (): void => {
    if (noteType !== 'bullets') return

    const nextItems = [...bulletItems, { content: '' }]
    const nextBody = serializeBulletBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleBulletKeyPress = (index: number, key: string): void => {
    if (noteType !== 'bullets') return
    if (key !== 'Backspace') return

    const currentItem = bulletItems[index]
    if (!currentItem || currentItem.content.length > 0) return
    if (bulletItems.length <= 1) return

    const nextItems = bulletItems.filter((_, itemIndex) => itemIndex !== index)
    const nextBody = serializeBulletBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleChecklistReorder = (fromIndex: number, toIndex: number): void => {
    if (noteType !== 'checklist') return

    const nextItems = [...checklistItems]
    const [movedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, movedItem)

    const nextBody = serializeChecklistBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
  }

  const handleBulletReorder = (fromIndex: number, toIndex: number): void => {
    if (noteType !== 'bullets') return

    const nextItems = [...bulletItems]
    const [movedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, movedItem)

    const nextBody = serializeBulletBody(nextItems)
    setBody(nextBody)
    debouncedSave(title, nextBody, isPinned, noteType)
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

  const handleOpenShare = (): void => {
    if (noteId) {
      router.push({
        pathname: '/(app)/share-note',
        params: { noteId },
      })
    }
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
          <Pressable style={styles.headerButton} onPress={handleOpenShare}>
            <Text style={styles.headerButtonText}>🔗 Share</Text>
          </Pressable>

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
        <View style={styles.typeSwitchRow}>
          <Pressable
            style={[
              styles.typeSwitchButton,
              noteType === 'text' && styles.typeSwitchButtonActive,
            ]}
            onPress={() => handleTypeChange('text')}
          >
            <Text style={styles.typeSwitchIcon}>📝</Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeSwitchButton,
              noteType === 'bullets' && styles.typeSwitchButtonActive,
            ]}
            onPress={() => handleTypeChange('bullets')}
          >
            <Text style={styles.typeSwitchIcon}>•</Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeSwitchButton,
              noteType === 'checklist' && styles.typeSwitchButtonActive,
            ]}
            onPress={() => handleTypeChange('checklist')}
          >
            <Text style={styles.typeSwitchIcon}>✓</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Note title"
          placeholderTextColor="#999"
          multiline
          autoFocus
        />

        {noteType === 'checklist' ? (
          <View style={styles.checklistContainer}>
            <View style={styles.checklistSummaryRow}>
              <Text style={styles.checklistSummary}>
                {completedChecklistCount}/{checklistItems.length} completed
              </Text>

              <Pressable
                style={[
                  styles.uncheckAllButton,
                  completedChecklistCount === 0 &&
                    styles.uncheckAllButtonDisabled,
                ]}
                onPress={handleChecklistUncheckAll}
                disabled={completedChecklistCount === 0}
              >
                <Text style={styles.uncheckAllButtonText}>Uncheck all</Text>
              </Pressable>
            </View>

            {checklistItems.map((item, index) => (
              <View key={String(index)} style={styles.checklistRow}>
                <Pressable
                  style={styles.checkToggleButton}
                  onPress={() => handleChecklistToggle(index)}
                >
                  <Text style={styles.checkToggleIcon}>
                    {item.checked ? '☑' : '☐'}
                  </Text>
                </Pressable>

                <TextInput
                  style={[
                    styles.checklistInput,
                    item.checked && styles.checklistInputChecked,
                  ]}
                  value={item.content}
                  onChangeText={(text) =>
                    handleChecklistTextChange(index, text)
                  }
                  onKeyPress={({ nativeEvent }) =>
                    handleChecklistKeyPress(index, nativeEvent.key)
                  }
                  placeholder={`Checklist item ${index + 1}`}
                  placeholderTextColor="#999"
                  multiline
                />

                <View style={styles.checklistReorderButtons}>
                  <Pressable
                    style={[
                      styles.reorderButton,
                      index === 0 && styles.reorderButtonDisabled,
                    ]}
                    onPress={() => handleChecklistReorder(index, index - 1)}
                    disabled={index === 0}
                  >
                    <Text style={styles.reorderButtonText}>↑</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.reorderButton,
                      index === checklistItems.length - 1 &&
                        styles.reorderButtonDisabled,
                    ]}
                    onPress={() => handleChecklistReorder(index, index + 1)}
                    disabled={index === checklistItems.length - 1}
                  >
                    <Text style={styles.reorderButtonText}>↓</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              style={styles.addChecklistItemButton}
              onPress={handleChecklistAddItem}
            >
              <Text style={styles.addChecklistItemText}>+ Add item</Text>
            </Pressable>
          </View>
        ) : noteType === 'bullets' ? (
          <View style={styles.bulletContainer}>
            {bulletItems.map((item, index) => (
              <View key={String(index)} style={styles.bulletRow}>
                <Text style={styles.bulletPrefix}>•</Text>

                <TextInput
                  style={styles.bulletInput}
                  value={item.content}
                  onChangeText={(text) => handleBulletTextChange(index, text)}
                  onKeyPress={({ nativeEvent }) =>
                    handleBulletKeyPress(index, nativeEvent.key)
                  }
                  placeholder={`Bullet item ${index + 1}`}
                  placeholderTextColor="#999"
                  multiline
                />

                <View style={styles.bulletReorderButtons}>
                  <Pressable
                    style={[
                      styles.reorderButton,
                      index === 0 && styles.reorderButtonDisabled,
                    ]}
                    onPress={() => handleBulletReorder(index, index - 1)}
                    disabled={index === 0}
                  >
                    <Text style={styles.reorderButtonText}>↑</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.reorderButton,
                      index === bulletItems.length - 1 &&
                        styles.reorderButtonDisabled,
                    ]}
                    onPress={() => handleBulletReorder(index, index + 1)}
                    disabled={index === bulletItems.length - 1}
                  >
                    <Text style={styles.reorderButtonText}>↓</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              style={styles.addBulletItemButton}
              onPress={handleBulletAddItem}
            >
              <Text style={styles.addBulletItemText}>+ Add bullet</Text>
            </Pressable>
          </View>
        ) : (
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={handleBodyChange}
            placeholder={
              noteType === 'text' ? 'Start writing...' : 'Add bullet lines...'
            }
            placeholderTextColor="#999"
            multiline
            textAlignVertical="top"
          />
        )}
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
  typeSwitchRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  typeSwitchButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fff',
  },
  typeSwitchButtonActive: {
    backgroundColor: '#e9f2ff',
    borderColor: '#007AFF',
  },
  typeSwitchIcon: {
    fontSize: 20,
    color: '#333',
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
  sharePanel: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    gap: 10,
    marginBottom: 16,
  },
  shareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  shareStatusText: {
    fontSize: 12,
    color: '#666',
  },
  shareCreateButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#eef5ff',
    alignSelf: 'flex-start',
  },
  shareCreateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  shareUrlButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fff',
  },
  shareUrlButtonText: {
    fontSize: 13,
    color: '#007AFF',
  },
  shareRevokeButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#fff0ee',
    alignSelf: 'flex-start',
  },
  shareRevokeButtonText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600',
  },
  shareHintText: {
    fontSize: 12,
    color: '#666',
  },
  shareErrorText: {
    fontSize: 12,
    color: '#FF3B30',
  },
  shareAnalyticsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareAnalyticsItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  shareAnalyticsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  shareAnalyticsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checklistContainer: {
    gap: 10,
  },
  checklistSummary: {
    fontSize: 13,
    color: '#666',
  },
  checklistSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  uncheckAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  uncheckAllButtonDisabled: {
    opacity: 0.5,
  },
  uncheckAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkToggleButton: {
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  checkToggleIcon: {
    fontSize: 22,
    color: '#007AFF',
  },
  checklistInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    paddingVertical: 4,
  },
  checklistInputChecked: {
    color: '#8a8a8a',
    textDecorationLine: 'line-through',
  },
  addChecklistItemButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#eef5ff',
  },
  addChecklistItemText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bulletContainer: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPrefix: {
    fontSize: 18,
    color: '#333',
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  bulletInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    paddingVertical: 4,
  },
  addBulletItemButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#eef5ff',
  },
  addBulletItemText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  checklistReorderButtons: {
    flexDirection: 'column',
    gap: 2,
  },
  bulletReorderButtons: {
    flexDirection: 'column',
    gap: 2,
  },
  reorderButton: {
    width: 28,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  reorderButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
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
