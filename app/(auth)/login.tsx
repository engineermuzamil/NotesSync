import * as sessionService from '@/src/services/sessionService'
import { useAuthStore } from '@/src/stores/authStore'
import NetInfo from '@react-native-community/netinfo'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const login = useAuthStore((state) => state.login)

  const handleNavigateToRegister = (): void => {
    router.push('/(auth)/register')
  }

  const handleForgotPassword = (): void => {
    Alert.alert('Forgot Password', 'This feature will be implemented soon.')
  }

  const validateForm = (): string | null => {
    if (!email.trim()) {
      return 'Email is required'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address'
    }

    if (!password) {
      return 'Password is required'
    }

    return null
  }

  const handleLogin = async (): Promise<void> => {
    const validationError = validateForm()
    if (validationError) {
      Alert.alert('Validation Error', validationError)
      return
    }

    setIsLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const networkState = await NetInfo.fetch()
      const isOnline =
        networkState.isConnected === true &&
        networkState.isInternetReachable !== false

      if (!isOnline) {
        const hasOfflineProfile =
          await sessionService.hasOfflineAuthProfileForEmail(normalizedEmail)

        if (!hasOfflineProfile) {
          Alert.alert(
            'Offline Login Unavailable',
            'First login for this account requires internet. Connect once, then you can use offline login on this device.'
          )
          return
        }
      }

      await login(normalizedEmail, password)
      router.replace('/')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed'
      Alert.alert('Login Error', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>Notes Sync</Text>
      <Text style={styles.subtitle}>
        {' '}
        Sign in to sync your notes across devices
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        editable={!isLoading}
      />

      <Pressable
        style={styles.forgotPassword}
        onPress={handleForgotPassword}
        disabled={isLoading}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </Pressable>

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Logging In...' : 'Log In'}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Pressable disabled={isLoading} onPress={handleNavigateToRegister}>
          <Text style={styles.link}>Register</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#007AFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
    color: '#666',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#000',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
  },
  button: {
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
})
