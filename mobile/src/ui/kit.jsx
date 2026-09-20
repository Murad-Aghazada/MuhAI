/* The handful of primitives every screen needs. Small on purpose — this is a
   five-screen app, not a design system. */
import { forwardRef } from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'

import { color, radius, space, text } from './theme.js'

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Button({ title, onPress, busy, disabled, variant = 'brand', style }) {
  const off = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        variant === 'brand' ? styles.btnBrand : styles.btnGhost,
        off && styles.btnOff,
        pressed && !off && styles.btnPressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'brand' ? '#fff' : color.ink} size="small" />
      ) : (
        <Text style={variant === 'brand' ? styles.btnBrandText : styles.btnGhostText}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export const Field = forwardRef(function Field({ label, hint, ...props }, ref) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={color.ink4}
        style={styles.input}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
})

const TONE = {
  green: { bg: '#e7f6ef', fg: '#0a7d56' },
  amber: { bg: '#fcf2e0', fg: '#7d5210' },
  red: { bg: '#fdecea', fg: '#a8341f' },
  gray: { bg: color.surfaceInset, fg: color.ink3 },
}

export function Badge({ tone = 'gray', children }) {
  const t = TONE[tone] || TONE.gray
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  )
}

/** The honest empty state: says which thing is missing, never a blank panel. */
export function Empty({ title, body }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <View style={styles.errorNote}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space(4),
  },
  btn: {
    minHeight: 48, // a real touch target, not a 32px web button
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(5),
    flexDirection: 'row',
    gap: space(2),
  },
  btnBrand: { backgroundColor: color.brand },
  btnGhost: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineStrong },
  btnOff: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnBrandText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhostText: { color: color.ink, fontWeight: '600', fontSize: 15 },

  field: { gap: space(1.5) },
  fieldLabel: { ...text.sub, fontWeight: '600', color: color.ink2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space(3.5),
    fontSize: 15,
    color: color.ink,
    backgroundColor: color.surface,
  },
  hint: { fontSize: 12, color: color.ink4 },

  badge: {
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11.5, fontWeight: '700' },

  empty: { alignItems: 'center', gap: space(2), paddingVertical: space(12) },
  emptyTitle: { ...text.h2 },
  emptyBody: { ...text.sub, textAlign: 'center', maxWidth: 320, lineHeight: 19 },

  errorNote: {
    backgroundColor: '#fdecea',
    borderColor: '#f3c6bd',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space(3),
  },
  errorText: { color: '#a8341f', fontSize: 13.5, lineHeight: 19 },
})
