// Checks GitHub Releases for a newer Android build. The APK isn't in a store, so nothing else would tell players.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const LATEST = 'https://api.github.com/repos/DerbaliAdem/code-names-substitute/releases/latest';

export interface Update {
  version: string;
  /** The APK for this phone's processor, or the release page if there's none. */
  url: string;
}

interface Release {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; browser_download_url: string }[];
}

/** 1.10.0 > 1.9.2; anything that isn't digits counts as 0. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

/** Release assets are named codenames-pulp-<abi>.apk; older releases have one universal APK. */
export function pickApk(release: Release, abis: readonly string[]): string | null {
  const apks = (release.assets ?? []).filter((a) => a.name.endsWith('.apk'));
  const order = ['arm64-v8a', 'armeabi-v7a', 'x86_64'].filter((abi) => abis.includes(abi));
  for (const abi of order) {
    const match = apks.find((a) => a.name.endsWith(`-${abi}.apk`));
    if (match) return match.browser_download_url;
  }
  const universal = apks.find((a) => !/-(arm64-v8a|armeabi-v7a|x86_64|x86)\.apk$/.test(a.name));
  return universal?.browser_download_url ?? null;
}

export async function findUpdate(): Promise<Update | null> {
  const current = Constants.expoConfig?.version;
  if (Platform.OS !== 'android' || !current) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
    if (!res.ok) return null;
    const release = (await res.json()) as Release;
    if (!release.tag_name || release.draft || release.prerelease || !isNewer(release.tag_name, current)) return null;
    const url = pickApk(release, Device.supportedCpuArchitectures ?? []) ?? release.html_url;
    return url ? { version: release.tag_name.replace(/^v/i, ''), url } : null;
  } catch {
    return null; // offline or rate-limited: try again next launch
  } finally {
    clearTimeout(timer);
  }
}
