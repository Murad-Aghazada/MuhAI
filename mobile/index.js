// Entry point.
//
// The Intl polyfills load before expo-router, and therefore before any screen
// can call format.js. That ordering is the whole reason this file exists
// rather than the default "main": "expo-router/entry".
//
// Hermes ships an Intl that *exists* but has no Turkish locale data, so
// `new Intl.NumberFormat('tr-TR', { currency: 'TRY' })` silently answers in
// en-US — ₺1.234,56 renders as ₺1,234.56. Wrong money on screen in a finance
// app is worse than a crash, and format.js has no guard on formatNumber,
// formatPercent or formatDate.
//
// `polyfill-force`, not `polyfill`: the non-forcing variant defers to the
// engine's existing Intl, which is exactly the broken one we are replacing.
import '@formatjs/intl-getcanonicallocales/polyfill-force'
import '@formatjs/intl-locale/polyfill-force'
import '@formatjs/intl-pluralrules/polyfill-force'
import '@formatjs/intl-pluralrules/locale-data/tr'
import '@formatjs/intl-pluralrules/locale-data/en'
import '@formatjs/intl-numberformat/polyfill-force'
import '@formatjs/intl-numberformat/locale-data/tr'
import '@formatjs/intl-numberformat/locale-data/en'
import '@formatjs/intl-datetimeformat/polyfill-force'
import '@formatjs/intl-datetimeformat/locale-data/tr'
import '@formatjs/intl-datetimeformat/locale-data/en'
import '@formatjs/intl-datetimeformat/add-all-tz'

import 'expo-router/entry'
