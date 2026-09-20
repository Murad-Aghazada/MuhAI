/* ============================================================
   Step 0 — the strategy check.

   This screen is temporary. It exists to prove, on a real device, the three
   things the whole shared-layer approach rests on. Every one of them fails
   quietly rather than loudly, which is why they are checked first and by hand:

     1. Metro resolves and bundles ../web/src — and does it with ONE copy of
        React. Two copies throw "Invalid hook call" from somewhere unrelated.
     2. Hermes supports the \p{L}\p{N} regex escapes in db.js's vendorKey().
        If it does not, db.js dies when it is *parsed*, and the key it
        produces is a join key against the backend's expense_classifier —
        a near-miss silently desyncs learned categories rather than throwing.
     3. Intl speaks Turkish. Without the polyfills in index.js, ₺1.234,56
        comes out as ₺1,234.56 and nobody notices until a judge does.

   Delete this file once the auth screens land.
   ============================================================ */
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { resolveBaseUrl } from '../src/boot.js'
import { getToken, ping } from '../src/shared/client.js'
import { vendorKey } from '../src/shared/db.js'
import { formatCurrency, formatDate, formatNumber } from '../src/shared/format.js'
import { monthKey, todayIso } from '../src/shared/analytics.js'
import { translations } from '../src/shared/translations.js'
import { color, radius, space, text } from '../src/ui/theme.js'

function Row({ label, got, want, note }) {
  const ok = want === undefined ? got != null : String(got) === String(want)
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={[styles.badge, ok ? styles.badgeOk : styles.badgeBad]}>
          {ok ? 'OK' : 'FAIL'}
        </Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.got}>{String(got)}</Text>
      {!ok && want !== undefined && <Text style={styles.want}>beklenen: {want}</Text>}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  )
}

export default function SetupCheck() {
  // The root layout has already booted the client; this only reports on it.
  const boot = { baseUrl: resolveBaseUrl(), restored: Boolean(getToken()) }
  const [reachable, setReachable] = useState(null)
  const [regexError, setRegexError] = useState(null)

  useEffect(() => {
    ping().then(setReachable)
  }, [])

  // vendorKey() is called inside try/catch because a Hermes without Unicode
  // property escapes throws at parse time, not call time — this at least
  // surfaces the message instead of a white screen.
  let key = null
  try {
    key = vendorKey('Teknopark Gayrimenkul A.Ş.')
  } catch (err) {
    if (!regexError) setRegexError(err.message)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Muhai · kurulum kontrolü</Text>
      <Text style={styles.sub}>
        Paylaşılan katman ../web/src üzerinden bundle ediliyor.
      </Text>

      <Text style={styles.section}>1 · Metro paylaşılan dosyaları çözüyor</Text>
      <Row label="translations.js" got={translations.tr.nav.dashboard} want="Genel Bakış" />
      <Row label="analytics.js · todayIso()" got={todayIso()} />
      <Row label="analytics.js · monthKey()" got={monthKey('2026-09-20')} want="2026-09" />

      <Text style={styles.section}>2 · Hermes · Unicode regex</Text>
      <Row
        label="db.js · vendorKey()"
        got={regexError || key}
        want="teknopark gayrimenkul as"
        note="Arka uçtaki expense_classifier.vendor_key() ile birebir aynı olmalı."
      />

      <Text style={styles.section}>3 · Intl · Türkçe</Text>
      <Row label="formatCurrency(12350)" got={formatCurrency(12350, 'tr')} want="₺12.350" />
      <Row label="formatNumber(1234567)" got={formatNumber(1234567, 'tr')} want="1.234.567" />
      <Row label="formatDate(2026-09-20)" got={formatDate('2026-09-20', 'tr')} want="20 Eyl 2026" />

      <Text style={styles.section}>4 · API</Text>
      <Row label="çözülen adres" got={boot ? boot.baseUrl || '(boş)' : '…'} />
      <Row label="kayıtlı oturum" got={boot ? (boot.restored ? 'var' : 'yok') : '…'} />
      <Row
        label="/health"
        got={reachable === null ? '…' : reachable ? 'ulaşılabilir' : 'ulaşılamıyor'}
        want="ulaşılabilir"
        note="Telefon için localhost telefonun kendisidir. Aynı Wi-Fi ve 8000 portuna güvenlik duvarı izni gerekir."
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space(5), paddingTop: space(16), gap: space(2) },
  title: text.title,
  sub: { ...text.sub, marginBottom: space(3) },
  section: { ...text.label, marginTop: space(5), marginBottom: space(1) },
  row: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(3),
    gap: space(1),
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  badgeOk: { backgroundColor: color.pos },
  badgeBad: { backgroundColor: color.neg },
  label: { ...text.body, fontWeight: '600', flexShrink: 1 },
  got: { fontSize: 13, color: color.ink, fontFamily: 'monospace' },
  want: { fontSize: 12, color: color.neg },
  note: { fontSize: 11.5, color: color.ink4, lineHeight: 16 },
})
