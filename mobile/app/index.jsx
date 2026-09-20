/* The gate. Three states, not two — the same three web/src/components/auth/
   ProtectedRoute.jsx handles:

     loading                  → splash
     no user                  → sign in
     user with no companyId   → an account whose company row is missing. Rare
                                (register creates both in one transaction) but
                                recoverable, and it must not strand the user
                                on a blank screen.
*/
import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { useAuth } from '../src/shared/AuthContext.js'
import { color } from '../src/ui/theme.js'

export default function Gate() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={color.brand} />
      </View>
    )
  }

  if (!user) return <Redirect href="/login" />
  if (!profile?.companyId) return <Redirect href="/no-company" />
  return <Redirect href="/(app)" />
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.canvas,
  },
})
