// AsyncStorage wrapper that never throws (works on web, iOS and Android).
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  const p = value == null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(value));
  p.catch(() => {});
}
