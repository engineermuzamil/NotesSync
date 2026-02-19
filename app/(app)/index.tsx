import { useAuthStore } from '@/src/stores/authStore'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function AppHomeScreen() {
  const { user, logout } = useAuthStore()

  const handleLogout = async (): Promise<void> => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to NotesSync</Text>
      <Text style={styles.email}>Logged in as: {user?.email}</Text>
      <Text style={styles.subtitle}>Notes functionality coming in Phase 6</Text>

      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 32,
  },
  button: {
    height: 48,
    paddingHorizontal: 32,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
