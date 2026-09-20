/* Bank reconciliation.

   Which movements are already in the books and which are not — unmatched
   first, because that is the row worth a person's attention. Fetches when a
   bank is configured, imports a CSV when one is not, and says plainly which
   setting is missing rather than pretending to be connected. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useData } from '../../src/context/DataContext.jsx'
import { useLang } from '../../src/i18n/LanguageContext.jsx'
import {
  getBankStatus, importStatement, invoiceRefs, reconcileStatement, syncStatement,
} from '../../src/shared/bank.js'
import { COLLECTIONS, addItem } from '../../src/shared/db.js'
import { formatCurrency, formatDate } from '../../src/shared/format.js'
import { Badge, Button, Card, Empty, ErrorNote } from '../../src/ui/kit.jsx'
import { color, radius, space, text } from '../../src/ui/theme.js'

const FILTERS = ['unmatched', 'matched', 'all']

export default function Bank() {
  const { invoices, learnedCategories } = useData()
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()

  const [status, setStatus] = useState(null)
  const [statement, setStatement] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState({})
  const [filter, setFilter] = useState('unmatched')

  useEffect(() => {
    getBankStatus().then(setStatus).catch((e) => setError(e.message))
  }, [])

  const refs = useMemo(() => invoiceRefs(invoices), [invoices])

  const run = useCallback(async (work) => {
    setBusy(true)
    setError(null)
    try {
      setStatement(await work())
      setSaved({})
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const fetchFromBank = () =>
    run(() => syncStatement({ invoices: refs, learned: learnedCategories }))

  const importCsv = () =>
    run(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      })
      if (picked.canceled || !picked.assets?.[0]) return statement
      const file = picked.assets[0]

      const imported = await importStatement({
        uri: file.uri,
        name: file.name || 'ekstre.csv',
        type: 'text/csv',
      })
      const matched = await reconcileStatement({
        rows: imported.rows,
        invoices: refs,
        learned: learnedCategories,
      })
      return { ...matched, source: 'csv', since: imported.since, until: imported.until }
    })

  async function addToLedger(row, index) {
    setSaved((s) => ({ ...s, [index]: 'saving' }))
    try {
      await addItem(COLLECTIONS.transactions, row.ledger)
      setSaved((s) => ({ ...s, [index]: 'saved' }))
    } catch (err) {
      setSaved((s) => ({ ...s, [index]: null }))
      setError(err.message)
    }
  }

  const rows = statement?.rows ?? []
  const matches = statement?.matches ?? []
  const summary = statement?.summary
  const invoiceById = useMemo(
    () => Object.fromEntries(invoices.map((i) => [i.id, i])),
    [invoices],
  )

  const visible = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index, match: matches[index] }))
        .filter(({ match }) => {
          if (filter === 'all') return true
          const isMatched = match?.status === 'matched'
          return filter === 'matched' ? isMatched : !isMatched
        }),
    [rows, matches, filter],
  )

  const live = status?.live

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space(4) }]}>
      <Text style={styles.title}>{t('bank.title')}</Text>

      <View style={styles.conn}>
        <Card style={{ gap: space(2) }}>
          <View style={styles.connRow}>
            <View style={[styles.dot, live && styles.dotLive]} />
            <Text style={styles.connName}>
              {live ? status.display_name : t('bank.notConnected')}
            </Text>
          </View>
          <Text style={styles.connHint}>
            {live ? t('bank.connectedHint') : status?.reason || t('bank.notConnectedHint')}
          </Text>
          <View style={styles.actions}>
            {live && <Button title={t('bank.fetch')} onPress={fetchFromBank} busy={busy} />}
            <Button
              title={t('bank.importCsv')}
              variant={live ? 'ghost' : 'brand'}
              onPress={importCsv}
              busy={busy && !live}
            />
          </View>
        </Card>
      </View>

      <ErrorNote>{error}</ErrorNote>

      {summary && (
        <View style={styles.stats}>
          <Stat label={t('bank.kpiRows')} value={summary.total} />
          <Stat label={t('bank.kpiMatched')} value={summary.matched} tone={color.pos} />
          <Stat label={t('bank.kpiUnmatched')} value={summary.unmatched} tone={summary.unmatched ? color.neg : undefined} />
          <Stat label={t('bank.kpiNet')} value={formatCurrency(summary.net, lang)} small />
        </View>
      )}

      {statement && (
        <View style={styles.filters}>
          {FILTERS.map((key) => {
            const count =
              key === 'all' ? rows.length : key === 'matched' ? summary?.matched ?? 0 : summary?.unmatched ?? 0
            const on = filter === key
            return (
              <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {t(`bank.filter.${key}`)} ({count})
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={({ index }) => String(index)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          busy ? null : (
            <Empty
              title={t('bank.emptyTitle')}
              body={live ? t('bank.emptyBodyLive') : t('bank.emptyBodyCsv')}
            />
          )
        }
        renderItem={({ item: { row, index, match } }) => {
          const isMatched = match?.status === 'matched'
          const invoice = isMatched ? invoiceById[match.invoice_id] : null
          const state = saved[index]
          return (
            <Card style={{ gap: space(3) }}>
              <View style={styles.rowTop}>
                <View style={styles.rowMain}>
                  <Text style={styles.desc} numberOfLines={2}>
                    {row.description || row.counterparty || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {row.date ? formatDate(row.date, lang) : '—'} · {t(`dashboard.cat.${row.category}`)}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: row.amount >= 0 ? color.pos : color.neg }]}>
                  {row.amount >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(row.amount), lang)}
                </Text>
              </View>

              <View style={styles.rowBottom}>
                {isMatched ? (
                  <Badge tone="green">
                    {invoice?.number || t('bank.matched')} · %{Math.round((match.confidence || 0) * 100)}
                  </Badge>
                ) : (
                  <Badge tone="amber">{t('bank.unmatched')}</Badge>
                )}
                <View style={{ flex: 1 }} />
                {!isMatched &&
                  (state === 'saved' ? (
                    <Text style={styles.savedText}>{t('bank.added')}</Text>
                  ) : (
                    <Button
                      title={t('bank.addToLedger')}
                      variant="ghost"
                      busy={state === 'saving'}
                      onPress={() => addToLedger(row, index)}
                      style={styles.smallBtn}
                    />
                  ))}
              </View>
            </Card>
          )
        }}
      />
    </View>
  )
}

function Stat({ label, value, tone, small }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, small && { fontSize: 14 }, tone && { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  title: { ...text.title, paddingHorizontal: space(4), marginBottom: space(3) },
  conn: { paddingHorizontal: space(4) },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.ink4 },
  dotLive: { backgroundColor: color.pos },
  connName: { ...text.h2, fontSize: 15 },
  connHint: { ...text.sub, lineHeight: 18 },
  actions: { gap: space(2), marginTop: space(1) },

  stats: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), marginTop: space(3) },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(2.5),
    gap: space(1),
  },
  statLabel: { ...text.label, fontSize: 9 },
  statValue: { fontSize: 17, fontWeight: '700', color: color.ink },

  filters: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), marginTop: space(3) },
  chip: {
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.full,
    backgroundColor: color.surfaceInset,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: color.ink3 },
  chipTextOn: { color: '#fff' },

  list: { padding: space(4), gap: space(3) },
  rowTop: { flexDirection: 'row', gap: space(3) },
  rowMain: { flex: 1, minWidth: 0, gap: space(1) },
  desc: { ...text.body, fontWeight: '600', color: color.ink, fontSize: 14 },
  meta: { ...text.sub, fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '700' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  smallBtn: { minHeight: 38, paddingHorizontal: space(3) },
  savedText: { ...text.sub, color: color.pos, fontWeight: '600' },
})
