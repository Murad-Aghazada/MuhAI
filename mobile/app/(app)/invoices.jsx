/* Invoices — a list of cards, not a table.

   The web screen's nine-column table is exactly the thing that does not
   survive a 375px screen (N15). Same data, same actions, a shape a thumb can
   use. */
import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useData } from '../../src/context/DataContext.jsx'
import { useLang } from '../../src/i18n/LanguageContext.jsx'
import { formatCurrency, formatDate } from '../../src/shared/format.js'
import { markInvoicePaid } from '../../src/shared/db.js'
import { Badge, Button, Card, Empty } from '../../src/ui/kit.jsx'
import { color, radius, space, text } from '../../src/ui/theme.js'

const TONE = { paid: 'green', pending: 'amber', overdue: 'red' }
const STATUS_LABEL = {
  all: 'common.all',
  paid: 'invoices.stPaid',
  pending: 'invoices.stPending',
  overdue: 'invoices.stOverdue',
}
const FILTERS = ['all', 'pending', 'overdue', 'paid']

export default function Invoices() {
  const { invoices, loading, refresh } = useData()
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const visible = useMemo(() => {
    const rows = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter)
    return [...rows].sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)))
  }, [invoices, filter])

  async function pay(invoice) {
    setBusyId(invoice.id)
    try {
      await markInvoicePaid(invoice)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space(4) }]}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('invoices.title')}</Text>
        <Button title={t('invoices.upload')} onPress={() => router.push('/scan')} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((key) => {
          const count = key === 'all' ? invoices.length : invoices.filter((i) => i.status === key).length
          const on = filter === key
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t(STATUS_LABEL[key])} ({count})
              </Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <Empty title={t('common.none')} body={t('common.emptyBody')} />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowMain}>
                <Text style={styles.vendor} numberOfLines={1}>
                  {item.vendor || '—'}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.number || '—'} · {item.issueDate ? formatDate(item.issueDate, lang) : '—'}
                </Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(item.amount, lang)}</Text>
            </View>

            <View style={styles.rowBottom}>
              <Badge tone={TONE[item.status] || 'gray'}>
                {t(STATUS_LABEL[item.status] || 'common.status')}
              </Badge>
              {item.needsReview ? <Badge tone="amber">{t('invoices.needsReview')}</Badge> : null}
              <View style={{ flex: 1 }} />
              {item.status !== 'paid' && (
                <Button
                  title={t('invoices.markPaid')}
                  variant="ghost"
                  busy={busyId === item.id}
                  onPress={() => pay(item)}
                  style={styles.payBtn}
                />
              )}
            </View>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  head: {
    paddingHorizontal: space(4),
    gap: space(3),
    marginBottom: space(3),
  },
  title: { ...text.title },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), paddingHorizontal: space(4) },
  chip: {
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.full,
    backgroundColor: color.surfaceInset,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: color.ink3 },
  chipTextOn: { color: '#fff' },

  list: { padding: space(4), gap: space(3) },
  row: { gap: space(3) },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rowMain: { flex: 1, minWidth: 0, gap: space(1) },
  vendor: { ...text.body, fontWeight: '700', color: color.ink, fontSize: 15 },
  meta: { ...text.sub, fontSize: 12 },
  amount: { fontSize: 16, fontWeight: '700', color: color.ink },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  payBtn: { minHeight: 38, paddingHorizontal: space(3) },
})
