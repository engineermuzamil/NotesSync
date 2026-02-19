import { StyleSheet } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'

export default function WelcomeScreen(): JSX.Element {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">NotesSync</ThemedText>
      <ThemedText style={styles.subtitle}>Your notes, synced.</ThemedText>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.8,
  },
})
