/* Root layout.

   Nothing renders until bootClient() has resolved: getToken() is synchronous
   for every caller below this point, and that is only safe once the token has
   been read out of SecureStore and handed to the shared client. */
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { bootClient } from '../src/boot.js'
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx'
import { AuthProvider } from '../src/shared/AuthContext.js'
import { color } from '../src/ui/theme.js'

export default function RootLayout() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    bootClient().finally(() => setBooted(true))
  }, [])

  if (!booted) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={color.brand} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <LanguageProvider>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.canvas },
            }}
          />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.canvas,
  },
})
