/* ============================================================
   Boot: tell the shared client where the API is and where the session lives.

   These are the only two facts that differ between the browser and the phone,
   which is why web/src/lib/client.js takes them as arguments instead of
   reading an environment of its own.
   ============================================================ */
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { configureClient } from './shared/client.js'

const TOKEN_KEY = 'muhai.token'

/**
 * Where the API is.
 *
 * EXPO_PUBLIC_API_URL wins when set — that is how you point a phone at the
 * VPS. With nothing set, derive it from whichever machine is serving this
 * bundle: Expo's hostUri is "192.168.1.23:8081", and the dev stack publishes
 * the API on :8000 of that same host. So a laptop running `docker compose up`
 * and `expo start` needs no configuration at all, which is what makes the
 * QR-code demo work on someone else's network.
 */
export function resolveBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL
  if (explicit) return explicit

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    ''
  const host = hostUri.split(':')[0]
  return host ? `http://${host}:8000` : ''
}

/**
 * SecureStore keeps the JWT in the OS keychain rather than in plain storage.
 *
 * `read` returns null by design: SecureStore is asynchronous and the shared
 * client reads the token synchronously inside every request. So the token is
 * read once here at boot and handed to configureClient(), and this adapter
 * only ever has to write.
 */
const secureStore = {
  read: () => null,
  write(token) {
    const done = token
      ? SecureStore.setItemAsync(TOKEN_KEY, token)
      : SecureStore.deleteItemAsync(TOKEN_KEY)
    // Never let a storage failure reject into a render. A session that
    // survives only until the app closes beats a crash on sign-in.
    done.catch(() => {})
  },
}

/** Call once, before anything renders. */
export async function bootClient() {
  let token = null
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    // No keychain (rare, and only some Android OEMs). Sign-in still works;
    // the session just will not survive a restart.
  }

  const baseUrl = resolveBaseUrl()
  configureClient({ baseUrl, tokenStore: secureStore, token })
  return { baseUrl, restored: Boolean(token) }
}
