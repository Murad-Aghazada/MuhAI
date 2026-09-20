/* The third auth state: an account that exists but whose company row does
   not. Registration creates both in one transaction so this is rare, but it
   is recoverable and must not strand the user on a blank screen.

   The full company-setup form lives on the web app; rebuilding it natively
   for a state almost nobody reaches would be the wrong place to spend the
   effort. Saying so plainly is better than a half-form. */
import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { useAuth } from '../src/shared/AuthContext.js'
import { useLang } from '../src/i18n/LanguageContext.jsx'
import { Button } from '../src/ui/kit.jsx'
import { color, space, text } from '../src/ui/theme.js'

export default function NoCompany() {
  const { logout } = useAuth()
  const { t, lang } = useLang()

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{lang === 'en' ? 'Company setup needed' : 'İşletme kurulumu gerekli'}</Text>
      <Text style={styles.body}>
        Bu hesaba bağlı bir işletme kaydı bulunamadı. Kurulumu web
        uygulamasından tamamladıktan sonra buradan giriş yapabilirsiniz.
      </Text>
      <Button
        title={t('auth.logout')}
        variant="ghost"
        onPress={async () => {
          await logout()
          router.replace('/login')
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
    gap: space(3),
  },
  title: { ...text.title, textAlign: 'center' },
  body: { ...text.sub, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
})
