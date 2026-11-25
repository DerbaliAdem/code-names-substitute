// Sound effects (WAVs from scripts/make-sounds.mjs) plus haptics on phones.
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { RoomView } from './protocol';
import { getState } from './store';

const SOURCES = {
  good: require('../assets/sounds/good.wav'),
  neutral: require('../assets/sounds/neutral.wav'),
  bad: require('../assets/sounds/bad.wav'),
  boom: require('../assets/sounds/boom.wav'),
  clue: require('../assets/sounds/clue.wav'),
  win: require('../assets/sounds/win.wav'),
  tick: require('../assets/sounds/tick.wav'),
  laugh: require('../assets/sounds/laugh.wav'),
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
const HAPTIC: Partial<Record<Sfx, () => Promise<void>>> = {
  good: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  bad: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  laugh: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  boom: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  clue: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
};

export function play(name: Sfx) {
  if (!getState().soundOn) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
  if (Platform.OS !== 'web') HAPTIC[name]?.().catch(() => {});
}

/** Play effects for what changed between two views of the same room. */
export function playDiff(a: RoomView | null, b: RoomView | null) {
  if (!a || !b || a.code !== b.code) return;
  for (const k of Object.keys(b.revealed || {})) {
    if (a.revealed?.[+k]) continue;
    const r = b.revealed[+k];
    play(r.type === 'x' ? 'boom' : r.type === 'n' ? 'neutral' : r.type === r.team ? 'good' : 'laugh');
  }
  if ((b.log?.length || 0) > (a.log?.length || 0)) play('clue');
  if (a.phase !== 'over' && b.phase === 'over') setTimeout(() => play('win'), b.over?.reason === 'assassin' ? 700 : 0);
}
