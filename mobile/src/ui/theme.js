/* The design tokens from web/src/index.css, as JS.
   react-native-svg cannot resolve `var(--c-emerald)`, and Metro cannot import
   a stylesheet, so the palette has to exist as values. Keep these in step with
   index.css by hand — they are a copy, and the only one in this project. */
export const color = {
  canvas: '#f7f7f3',
  surface: '#ffffff',
  surface2: '#fbfbf8',
  surfaceInset: '#f3f3ee',

  ink: '#0e1311',
  ink2: '#3a423f',
  ink3: '#6b7270',
  ink4: '#9aa19e',

  line: '#e9e9e3',
  lineStrong: '#dcdcd4',

  brand: '#0e9f6e',
  brandDeep: '#0a7d56',
  brandTint: '#e7f6ef',

  pos: '#0e9f6e',
  neg: '#e0533d',
  warn: '#e09b2d',

  emerald: '#0e9f6e',
  amber: '#f0a93c',
  coral: '#ef6b53',
  sky: '#3b94d6',
  violet: '#7b71d6',
}

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, full: 999 }

export const space = (n) => n * 4

export const text = {
  title: { fontSize: 24, fontWeight: '700', color: color.ink },
  h2: { fontSize: 17, fontWeight: '700', color: color.ink },
  body: { fontSize: 14.5, color: color.ink2 },
  sub: { fontSize: 13, color: color.ink3 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: color.ink4,
  },
}

export const card = {
  backgroundColor: color.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: color.line,
  padding: 16,
}
