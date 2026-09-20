/* Dashboard.

   Every figure comes from the shared layer: /api/compute/dashboard when the
   API answers, the identical local aggregation when it does not. Which one
   you are looking at is stated on screen — never a blank panel, never an
   invented number. */
import { useCallback, useState } from 'react'
import { router } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useData } from '../../src/context/DataContext.jsx'
import { useAuth } from '../../src/shared/AuthContext.js'
import { useLang } from '../../src/i18n/LanguageContext.jsx'
import { formatCurrency, formatDate } from '../../src/shared/format.js'
import { Badge, Button, Card, Empty } from '../../src/ui/kit.jsx'
import { color, radius, space, text } from '../../src/ui/theme.js'

function Kpi({ label, value, delta, lang }) {
  const up = Number(delta) >= 0
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta != null && Number.isFinite(Number(delta)) ? (
        <Text style={[styles.kpiDelta, { color: up ? color.pos : color.neg }]}>
          {up ? '▲' : '▼'} {Math.abs(Number(delta)).toFixed(1)}%
        </Text>
      ) : null}
    </View>
  )
}

/* A bar per month. Plain Views rather than SVG — twelve rectangles do not
   need a drawing library, and this keeps react-native-svg out of the first
   screen the user ever sees. */
function MiniBars({ series, lang }) {
  const max = Math.max(...series.map((m) => Math.max(m.income, m.expense)), 1)
  return (
    <View style={styles.bars}>
      {series.map((m) => (
        <View key={m.month} style={styles.barCol}>
          <View style={styles.barPair}>
            <View
              style={[styles.bar, { height: `${(m.income / max) * 100}%`, backgroundColor: color.brand }]}
            />
            <View
              style={[styles.bar, { height: `${(m.expense / max) * 100}%`, backgroundColor: color.coral }]}
            />
          </View>
          <Text style={styles.barLabel}>{m.month.slice(5)}</Text>
        </View>
      ))}
    </View>
  )
}

export default function Dashboard() {
  const { dashboard, score, compliance, apiOnline, loading, isEmpty, refresh } = useData()
  const { company } = useAuth()
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)

  const cur = useCallback((v) => formatCurrency(v, lang), [lang])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  if (loading && !dashboard) return null

  const k = dashboard?.kpis
  const monthly = (dashboard?.monthly || []).slice(-12)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space(4) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} />}
    >
      <View style={styles.head}>
        <Text style={styles.company} numberOfLines={1}>
          {company?.name || '—'}
        </Text>
        <Text style={styles.title}>{t('dashboard.greeting')}</Text>
        {!apiOnline && (
          <View style={styles.offline}>
            <Badge tone="amber">{t('common.offline')}</Badge>
            <Text style={styles.offlineHint}>{t('common.offlineHint')}</Text>
          </View>
        )}
      </View>

      {isEmpty ? (
        <Empty title={t('common.emptyTitle')} body={t('common.emptyBody')} />
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <Kpi label={t('dashboard.kpiRevenue')} value={cur(k?.revenue ?? 0)} delta={k?.revenue_delta} lang={lang} />
            <Kpi label={t('dashboard.kpiExpense')} value={cur(k?.expense ?? 0)} delta={k?.expense_delta} lang={lang} />
            <Kpi label={t('dashboard.kpiProfit')} value={cur(k?.profit ?? 0)} delta={k?.profit_delta} lang={lang} />
            <Kpi label={t('dashboard.kpiTax')} value={cur(k?.tax ?? 0)} delta={k?.tax_delta} lang={lang} />
          </View>

          {monthly.length > 1 && (
            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.cashflowTitle')}</Text>
              <MiniBars series={monthly} lang={lang} />
            </Card>
          )}

          <Card>
            <Text style={styles.cardTitle}>{t('dashboard.insightTitle')}</Text>
            <Text style={styles.insight}>{dashboard?.insight}</Text>
          </Card>

          {score && (
            <Card>
              <View style={styles.scoreRow}>
                <View>
                  <Text style={styles.cardTitle}>Muhai Score</Text>
                  <Text style={styles.sub}>
                    {Math.round(score.cash_runway_days)} {lang === 'en' ? 'days of runway' : 'günlük nakit pisti'}
                  </Text>
                </View>
                <Text style={styles.scoreValue}>{score.total_score}</Text>
              </View>
            </Card>
          )}

          {compliance?.alerts?.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.compliance.title')}</Text>
              {compliance.alerts.slice(0, 4).map((a, i) => (
                <View key={`${a.type}-${i}`} style={styles.alert}>
                  <Badge tone={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'gray'}>
                    {t(`dashboard.compliance.sev.${a.severity}`)}
                  </Badge>
                  <Text style={styles.alertText}>{a.description}</Text>
                </View>
              ))}
            </Card>
          )}

          {dashboard?.deadlines?.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.taxWidgetTitle')}</Text>
              {dashboard.deadlines.map((d) => (
                <View key={`${d.type}-${d.due_date}`} style={styles.deadline}>
                  <Text style={styles.deadlineName}>{d.name}</Text>
                  <Text style={[styles.deadlineDate, d.is_due_soon && { color: color.neg }]}>
                    {formatDate(d.due_date, lang)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      <Button title={t('invoices.upload')} onPress={() => router.push('/scan')} />
      <View style={{ height: space(6) }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space(4), gap: space(3) },
  head: { gap: space(1), marginBottom: space(1) },
  company: { ...text.label },
  title: { ...text.title },
  offline: { gap: space(1), marginTop: space(2) },
  offlineHint: { fontSize: 12, color: color.ink4, lineHeight: 17 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  kpi: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(3),
    gap: space(1),
  },
  kpiLabel: { ...text.label, fontSize: 10 },
  kpiValue: { fontSize: 19, fontWeight: '700', color: color.ink },
  kpiDelta: { fontSize: 11.5, fontWeight: '600' },

  cardTitle: { ...text.h2, marginBottom: space(2) },
  sub: { ...text.sub },
  insight: { ...text.body, lineHeight: 21 },

  bars: { flexDirection: 'row', height: 120, gap: space(1), alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: space(1) },
  barPair: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 96 },
  bar: { width: 5, borderRadius: 2, minHeight: 2 },
  barLabel: { fontSize: 9, color: color.ink4 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreValue: { fontSize: 32, fontWeight: '800', color: color.brandDeep },

  alert: { gap: space(1), paddingVertical: space(2), borderTopWidth: 1, borderTopColor: color.line },
  alertText: { ...text.sub, lineHeight: 18 },

  deadline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space(2),
    borderTopWidth: 1,
    borderTopColor: color.line,
    gap: space(2),
  },
  deadlineName: { ...text.body, flexShrink: 1 },
  deadlineDate: { ...text.sub, fontWeight: '600' },
})
