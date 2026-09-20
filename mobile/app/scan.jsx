/* ============================================================
   Scan an invoice — the reason this app exists.

   Photograph a document, send it to /api/compute/ocr (Tesseract 5 + Turkish,
   PSM 6, per-field confidence), review what came back, save it. The OCR
   itself is the server's; the browser-side tesseract.js path does not exist
   here and is blocked at bundle time.

   The image is downscaled to 1600px before upload: that is the threshold the
   server's own preprocessing upscales *to*, so anything larger is bytes spent
   on a phone's cellular connection for no gain in accuracy (N18).
   ============================================================ */
import { useRef, useState } from 'react'
import { router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useData } from '../src/context/DataContext.jsx'
import { useLang } from '../src/i18n/LanguageContext.jsx'
import { scanInvoice } from '../src/shared/api.js'
import { CONFIDENCE_THRESHOLD, ocrToDraft } from '../src/shared/invoiceDraft.js'
import { COLLECTIONS, rememberVendorCategory, saveInvoiceWithLedger } from '../src/shared/db.js'
import { formatCurrency } from '../src/shared/format.js'
import { Badge, Button, Card, ErrorNote, Field } from '../src/ui/kit.jsx'
import { color, radius, space, text } from '../src/ui/theme.js'

const MAX_WIDTH = 1600

export default function Scan() {
  const { t, lang } = useLang()
  const { vendorCategories } = useData()
  const insets = useSafeAreaInsets()
  const cameraRef = useRef(null)

  const [permission, requestPermission] = useCameraPermissions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)

  async function process(uri) {
    setBusy(true)
    setError(null)
    try {
      const shrunk = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_WIDTH } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      )
      // React Native's FormData takes { uri, name, type }; the shared
      // scanInvoice() appends whatever it is given, so it needs no change.
      const result = await scanInvoice({
        uri: shrunk.uri,
        name: 'invoice.jpg',
        type: 'image/jpeg',
      })
      setDraft(ocrToDraft(result))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function capture() {
    if (!cameraRef.current || busy) return
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 })
    if (photo?.uri) process(photo.uri)
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    })
    if (!res.canceled && res.assets?.[0]?.uri) process(res.assets[0].uri)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveInvoiceWithLedger(draft)
      // Teach the classifier, exactly as the web modal does on save.
      if (draft.vendor && draft.category) {
        await rememberVendorCategory(vendorCategories, draft.vendor, draft.category).catch(() => {})
      }
      router.back()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  // ── Permission ──────────────────────────────────────────────────────
  if (!permission) return <View style={styles.screen} />

  if (!permission.granted && !draft) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <Text style={styles.permTitle}>{t('invoices.scanTitle')}</Text>
        <Text style={styles.permBody}>
          Fatura fotoğrafı çekebilmek için kamera izni gerekiyor. Dilerseniz
          galerinizden de seçebilirsiniz.
        </Text>
        <Button title="Kamera izni ver" onPress={requestPermission} />
        <Button title="Galeriden seç" variant="ghost" onPress={pick} />
        <Button title={t('common.close')} variant="ghost" onPress={() => router.back()} />
      </View>
    )
  }

  // ── Review ──────────────────────────────────────────────────────────
  if (draft) {
    const low = (draft.ocrConfidence ?? 0) < CONFIDENCE_THRESHOLD
    const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }))
    const setNumber = (key) => (value) =>
      setDraft((d) => ({ ...d, [key]: Number(String(value).replace(',', '.')) || 0 }))

    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[styles.review, { paddingTop: insets.top + space(4) }]}>
          <Text style={styles.title}>{t('invoices.scanTitle')}</Text>

          {/* The confidence is stated rather than hidden. A scan the engine is
              unsure about is worth a human glance, and saying so is what makes
              the number trustworthy when it is high. */}
          <View style={styles.confRow}>
            <Badge tone={low ? 'amber' : 'green'}>
              %{Math.round((draft.ocrConfidence ?? 0) * 100)}
            </Badge>
            {low && <Text style={styles.confHint}>{t('invoices.needsReview')}</Text>}
          </View>

          <Card style={{ gap: space(3) }}>
            <Field label={t('invoices.colVendor')} value={draft.vendor} onChangeText={set('vendor')} />
            <Field label={t('invoices.colNo')} value={draft.number} onChangeText={set('number')} />
            <Field
              label={t('common.date')}
              value={draft.issueDate || ''}
              onChangeText={set('issueDate')}
              placeholder="YYYY-AA-GG"
              autoCapitalize="none"
            />
            <Field
              label={t('common.amount')}
              value={String(draft.amount ?? 0)}
              onChangeText={setNumber('amount')}
              keyboardType="decimal-pad"
            />
            <Field
              label="KDV"
              value={String(draft.vatAmount ?? 0)}
              onChangeText={setNumber('vatAmount')}
              keyboardType="decimal-pad"
              hint={`${t('common.total')}: ${formatCurrency(draft.amount ?? 0, lang)}`}
            />
          </Card>

          <ErrorNote>{error}</ErrorNote>

          <Button title={t('common.save')} onPress={save} busy={busy} />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setDraft(null)} />
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ── Camera ──────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {busy && (
        <View style={styles.scrim}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.scrimText}>{t('invoices.scanning')}</Text>
        </View>
      )}

      <View style={[styles.frameHint, { top: insets.top + space(6) }]}>
        <Text style={styles.frameText}>Faturayı çerçeveye sığdırın</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + space(6) }]}>
        <Pressable onPress={() => router.back()} style={styles.sideBtn}>
          <Text style={styles.sideText}>{t('common.close')}</Text>
        </Pressable>
        <Pressable onPress={capture} disabled={busy} style={styles.shutter}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable onPress={pick} style={styles.sideBtn}>
          <Text style={styles.sideText}>Galeri</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  centre: {
    backgroundColor: color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
    gap: space(3),
  },
  permTitle: { ...text.title, textAlign: 'center' },
  permBody: { ...text.sub, textAlign: 'center', lineHeight: 20, marginBottom: space(2) },

  review: { padding: space(4), gap: space(3), backgroundColor: color.canvas, flexGrow: 1 },
  title: { ...text.title },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  confHint: { ...text.sub, flexShrink: 1 },

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(3),
    zIndex: 2,
  },
  scrimText: { color: '#fff', fontSize: 14 },

  frameHint: { position: 'absolute', alignSelf: 'center' },
  frameText: {
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.full,
    overflow: 'hidden',
  },

  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
  },
  sideBtn: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sideText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
})
