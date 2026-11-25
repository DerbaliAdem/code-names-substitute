import { Platform } from 'react-native';

/** Production backend on Render. Keep in sync with docs/PROTOCOL.md §1. */
const PROD = 'https://codenames-pulp-api.onrender.com';

/**
 * Local backend while developing:
 * - web and the iOS simulator reach your computer at localhost
 * - the Android emulator reaches it at 10.0.2.2
 * - a real phone in Expo Go needs your computer's LAN IP: set EXPO_PUBLIC_SERVER_URL=http://192.168.x.x:3000
 */
const LOCAL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

function fromWebQuery(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('server');
}

function isLocalWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

const DEV = __DEV__ || isLocalWeb();

/** `?server=` only works in development: on the real site a crafted link could send the player's token to another server. */
export const SERVER_URL: string =
  (DEV && fromWebQuery()) || process.env.EXPO_PUBLIC_SERVER_URL || (DEV ? LOCAL : PROD);
