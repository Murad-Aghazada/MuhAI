import { useState } from 'react'
import { router, Link } from 'expo-router'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'

import { useAuth, authErrorMessage } from '../src/shared/AuthContext.js'
import { useLang } from '../src/i18n/LanguageContext.jsx'
import { Button, ErrorNote, Field } from '../src/ui/kit.jsx'
import { color, space, text } from '../src/ui/theme.js'

export default function Login() {
  const { login } = useAuth()
  const { t, lang, setLanguage } = useLang()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await login({ email: email.trim(), password })
      router.replace('/')
    } catch (err) {
      // The shared context already turns an ApiError into a sentence a
      // business owner can read, in their language.
      setError(authErrorMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* The app defaults to Turkish for everyone. This is the only way back
            to English on mobile, so it lives on the first screen rather than
            behind a Settings page the native app does not have. */}
        <View style={styles.langRow}>
          {['tr', 'en'].map((code) => (
            <Pressable key={code} onPress={() => setLanguage(code)} hitSlop={8}>
              <Text style={[styles.langBtn, lang === code && styles.langBtnOn]}>
                {code.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.brand}>
          <Text style={styles.logo}>Muhai</Text>
          <Text style={styles.tagline}>{t('common.tagline')}</Text>
        </View>

        <View style={styles.form}>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@sirket.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          <ErrorNote>{error}</ErrorNote>

          <Button
            title={busy ? t('auth.loggingIn') : t('auth.login')}
            onPress={submit}
            busy={busy}
            disabled={!email.trim() || !password}
          />

          {/* There is no password reset, by decision — the web app dropped it
              when Firebase went and self-hosting would need an SMTP sender.
              A dead link here would be worse than none. */}
          <View style={styles.footer}>
            <Text style={text.sub}>{t('auth.noAccount')} </Text>
            <Link href="/register" style={styles.link}>
              {t('auth.createOne')}
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', gap: space(2) },
  langBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: color.ink4,
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  langBtnOn: { color: color.brandDeep },

  screen: { flex: 1, backgroundColor: color.canvas },
  content: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(8) },
  brand: { alignItems: 'center', gap: space(1) },
  logo: { fontSize: 32, fontWeight: '800', color: color.ink, letterSpacing: -0.5 },
  tagline: { ...text.sub },
  form: { gap: space(4) },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  link: { color: color.brandDeep, fontWeight: '700', fontSize: 13 },
})
