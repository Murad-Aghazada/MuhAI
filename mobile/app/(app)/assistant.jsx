/* The assistant. Gemini when the network allows, the local BM25 knowledge
   base when it does not — and the reply says which, because an answer from a
   keyword index should not be mistaken for one from a model. */
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useData } from '../../src/context/DataContext.jsx'
import { useLang } from '../../src/i18n/LanguageContext.jsx'
import { askAssistant } from '../../src/shared/api.js'
import { Badge } from '../../src/ui/kit.jsx'
import { color, radius, space, text } from '../../src/ui/theme.js'

const SUGGESTION_KEYS = ['suggest1', 'suggest2', 'suggest3', 'suggest4']

export default function Assistant() {
  const { snapshot } = useData()
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()
  const listRef = useRef(null)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const send = useCallback(
    async (text) => {
      const question = (text ?? input).trim()
      if (!question || busy) return

      setInput('')
      setMessages((m) => [...m, { role: 'user', text: question }])
      setBusy(true)
      try {
        const res = await askAssistant(question, snapshot, lang)
        setMessages((m) => [...m, { role: 'bot', text: res.reply, source: res.source }])
      } catch (err) {
        setMessages((m) => [
          ...m,
          { role: 'bot', text: err.message, source: 'error' },
        ])
      } finally {
        setBusy(false)
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
      }
    },
    [input, busy, snapshot, lang],
  )

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + space(4) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom + 60}
    >
      <Text style={styles.title}>{t('nav.assistant')}</Text>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.suggestions}>
            <Text style={styles.suggestTitle}>{t('assistant.subtitle')}</Text>
            {SUGGESTION_KEYS.map((k) => {
              const q = t(`assistant.${k}`)
              return (
                <Pressable key={k} onPress={() => send(q)} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              )
            })}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.msg, item.role === 'user' ? styles.msgUser : styles.msgBot]}>
            <Text style={item.role === 'user' ? styles.msgUserText : styles.msgBotText}>
              {item.text}
            </Text>
            {item.source && item.source !== 'ai' && (
              <View style={styles.sourceRow}>
                <Badge tone={item.source === 'error' ? 'red' : 'gray'}>
                  {item.source === 'offline' ? t('assistant.offlineBadge') : item.source}
                </Badge>
              </View>
            )}
          </View>
        )}
      />

      {busy && (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color={color.brand} />
          <Text style={styles.typingText}>{t('common.computing')}</Text>
        </View>
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + space(2) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={color.ink4}
          style={styles.input}
          multiline
          onSubmitEditing={() => send()}
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || busy}
          style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  title: { ...text.title, paddingHorizontal: space(4), marginBottom: space(2) },
  list: { padding: space(4), gap: space(3) },

  suggestions: { gap: space(2), paddingTop: space(4) },
  suggestTitle: { ...text.label, marginBottom: space(1) },
  suggestion: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space(3.5),
    minHeight: 48,
    justifyContent: 'center',
  },
  suggestionText: { ...text.body },

  msg: { maxWidth: '88%', borderRadius: radius.lg, padding: space(3.5), gap: space(2) },
  msgUser: { alignSelf: 'flex-end', backgroundColor: color.ink },
  msgBot: { alignSelf: 'flex-start', backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  msgUserText: { color: '#fff', fontSize: 14.5, lineHeight: 21 },
  msgBotText: { color: color.ink2, fontSize: 14.5, lineHeight: 21 },
  sourceRow: { flexDirection: 'row' },

  typing: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4) },
  typingText: { ...text.sub, fontSize: 12 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2),
    padding: space(3),
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.lg,
    paddingHorizontal: space(3.5),
    paddingTop: space(3),
    paddingBottom: space(3),
    fontSize: 15,
    color: color.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700' },
})
