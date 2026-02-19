import { useAuthStore } from '@/src/stores/authStore'
import { Redirect } from 'expo-router'

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Redirect href="/(app)" />
  }

  return <Redirect href="/(auth)/login" />
}
