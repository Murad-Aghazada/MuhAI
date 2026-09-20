/* Two steps, like the web sign-up: the account, then the company. The API
   creates both in one transaction, so a half-registered account is not a
   state that can exist. */
import { useState } from 'react'
import { Link, router } from 'expo-router'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch,
  Text, View,
} from 'react-native'

import { useAuth, authErrorMessage } from '../src/shared/AuthContext.js'
import { useLang } from '../src/i18n/LanguageContext.jsx'
import { Button, ErrorNote, Field } from '../src/ui/kit.jsx'
import { color, space, text } from '../src/ui/theme.js'

export default function Register() {
  const { register } = useAuth()
  const { t, lang } = useLang()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    email: '', password: '', displayName: '',
    name: '', taxId: '', taxOffice: '', city: '',
  })
  const [withDemoData, setWithDemoData] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const stepOneReady = form.email.trim() && form.password.length >= 6
  const stepTwoReady = form.name.trim()

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName,
        company: {
          name: form.name.trim(),
          taxId: form.taxId.trim(),
          taxOffice: form.taxOffice.trim(),
          city: form.city.trim(),
        },
        withDemoData,
      })
      router.replace('/')
    } catch (err) {
      setError(authErrorMessage(err, lang))
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{t('auth.registerTitle')}</Text>
          <Text style={styles.sub}>{t('auth.registerSub')}</Text>
          <View style={styles.steps}>
            <Text style={[styles.step, step === 1 && styles.stepOn]}>1 · {t('auth.step1')}</Text>
            <Text style={[styles.step, step === 2 && styles.stepOn]}>2 · {t('auth.step2')}</Text>
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <Field
              label={t('auth.fullName')}
              value={form.displayName}
              onChangeText={set('displayName')}
              autoCapitalize="words"
            />
            <Field
              label={t('auth.email')}
              value={form.email}
              onChangeText={set('email')}
              placeholder="ornek@sirket.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Field
              label={t('auth.password')}
              value={form.password}
              onChangeText={set('password')}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              hint={t('auth.passwordHint')}
            />
            <ErrorNote>{error}</ErrorNote>
            <Button title={t('auth.next')} onPress={() => setStep(2)} disabled={!stepOneReady} />
          </View>
        ) : (
          <View style={styles.form}>
            <Field label={t('auth.companyName')} value={form.name} onChangeText={set('name')} />
            <Field
              label={t('auth.taxId')}
              value={form.taxId}
              onChangeText={set('taxId')}
              keyboardType="number-pad"
            />
            <Field label={t('auth.taxOffice')} value={form.taxOffice} onChangeText={set('taxOffice')} />
            <Field label={t('auth.city')} value={form.city} onChangeText={set('city')} />

            <Pressable style={styles.demoRow} onPress={() => setWithDemoData((v) => !v)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoLabel}>{t('auth.demoToggle')}</Text>
                <Text style={styles.demoHint}>{t('auth.demoToggleHint')}</Text>
              </View>
              <Switch
                value={withDemoData}
                onValueChange={setWithDemoData}
                trackColor={{ true: color.brand }}
              />
            </Pressable>

            <ErrorNote>{error}</ErrorNote>

            <Button
              title={busy ? t('auth.registering') : t('auth.register')}
              onPress={submit}
              busy={busy}
              disabled={!stepTwoReady}
            />
            <Button title={t('auth.back')} variant="ghost" onPress={() => setStep(1)} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={text.sub}>{t('auth.haveAccount')} </Text>
          <Link href="/login" style={styles.link}>
            {t('auth.signIn')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(6) },
  head: { gap: space(1) },
  title: { ...text.title },
  sub: { ...text.sub, lineHeight: 19 },
  steps: { flexDirection: 'row', gap: space(4), marginTop: space(3) },
  step: { ...text.label, color: color.ink4 },
  stepOn: { color: color.brandDeep },
  form: { gap: space(4) },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  demoLabel: { ...text.body, fontWeight: '600', color: color.ink },
  demoHint: { fontSize: 12, color: color.ink4, lineHeight: 17 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  link: { color: color.brandDeep, fontWeight: '700', fontSize: 13 },
})
