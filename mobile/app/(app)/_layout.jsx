/* The signed-in shell. DataProvider mounts here rather than at the root, so
   the workspace is only ever loaded for someone who is actually signed in —
   the same arrangement as web/src/components/layout/AppLayout.jsx. */
import { Redirect, Tabs } from 'expo-router'
import { Text } from 'react-native'

import { useAuth } from '../../src/shared/AuthContext.js'
import { DataProvider } from '../../src/context/DataContext.jsx'
import { useLang } from '../../src/i18n/LanguageContext.jsx'
import { color } from '../../src/ui/theme.js'

/* Emoji rather than an icon package: lucide-react-native would pull in a
   second SVG dependency for five glyphs. Swap it for icons when the app earns
   more than five tabs. */
function Icon({ glyph, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>
}

export default function AppLayout() {
  const { user, profile, loading } = useAuth()
  const { t } = useLang()

  if (loading) return null
  if (!user) return <Redirect href="/login" />
  if (!profile?.companyId) return <Redirect href="/no-company" />

  return (
    <DataProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.brandDeep,
          tabBarInactiveTintColor: color.ink4,
          tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          sceneStyle: { backgroundColor: color.canvas },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('nav.dashboard'),
            tabBarIcon: ({ focused }) => <Icon glyph="◈" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="invoices"
          options={{
            title: t('nav.invoices'),
            tabBarIcon: ({ focused }) => <Icon glyph="▤" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="assistant"
          options={{
            title: t('nav.assistant'),
            tabBarIcon: ({ focused }) => <Icon glyph="✦" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="bank"
          options={{
            title: t('nav.bank'),
            tabBarIcon: ({ focused }) => <Icon glyph="⇄" focused={focused} />,
          }}
        />
      </Tabs>
    </DataProvider>
  )
}
