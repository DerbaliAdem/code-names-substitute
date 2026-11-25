// Root: fonts, persisted prefs, connection, banner, screen switch, phase routing, full-screen effects.
import { Bangers_400Regular } from '@expo-google-fonts/bangers/400Regular';
// Import each weight on its own: the package index would bundle all 18 font files.
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Animated, Linking, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import FxLayer from './src/components/FxLayer';
import UpdatePrompt from './src/components/UpdatePrompt';
import { detectFx, fire, screenShake } from './src/fx';
import { connect } from './src/net';
import type { RoomView } from './src/protocol';
import Board from './src/screens/Board';
import Home from './src/screens/Home';
import Lobby from './src/screens/Lobby';
import { playDiff } from './src/sound';
import { getState, go, loadPersisted, onViewChange, setSoundOn, setState, setThemePref, setView, useApp, type Screen, type ThemePref } from './src/store';
import { FONT, useTheme } from './src/theme';
import { Text } from './src/components/Text';

const SCREENS: Record<Screen, () => React.JSX.Element> = { home: Home, lobby: Lobby, board: Board };
const BANNER = { connecting: '', online: '', waking: 'Waking the server… the first visit can take up to a minute', reconnecting: 'Connection lost. Reconnecting…' };
const NEXT_THEME: Record<ThemePref, ThemePref> = { auto: 'light', light: 'dark', dark: 'auto' };
const THEME_ICON: Record<ThemePref, string> = { auto: '◐', light: '☀', dark: '☾' };

/** Follow the game: lobby → Lobby, play/over → Board. */
function route(a: RoomView | null, b: RoomView | null) {
  if (!b) return;
  const target: Screen = b.phase === 'lobby' ? 'lobby' : 'board';
  if (!a || a.code !== b.code) { if (getState().screen !== 'home' || b.phase !== 'lobby') go(target); return; }
  if (a.phase !== b.phase) go(target);
}

/** Two small round buttons in the corner: sound and theme. No page tabs. */
function Corner() {
  const { soundOn, themePref } = useApp();
  const { c } = useTheme();
  const btn = (label: string, a11y: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}
      style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: c.ink, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 17, color: c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'flex-end' }}>
      {btn(soundOn ? '🔊' : '🔇', soundOn ? 'Sound on, tap to mute' : 'Sound off, tap to unmute', () => setSoundOn(!soundOn))}
      {btn(THEME_ICON[themePref], `Theme ${themePref}, tap to change`, () => setThemePref(NEXT_THEME[themePref]))}
    </View>
  );
}

function Main() {
  const { screen, conn, ready } = useApp();
  const { c, dark } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const Current = SCREENS[screen] ?? Home;

  useEffect(() => {
    const off = onViewChange((a, b) => { playDiff(a, b); detectFx(a, b); route(a, b); });
    (async () => {
      await loadPersisted();
      const url = await Linking.getInitialURL().catch(() => null);
      const m = url && /[?&]room=([A-Za-z]{5})/.exec(url);
      if (m) setState({ inviteCode: m[1].toUpperCase() });
      connect();
    })();
    // Debug hook for testing the UI without a backend (web console): cn.setView(fakeRoomView)
    (globalThis as any).cn = { setView, getState, go, fire };
    return off;
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [screen]);

  const banner = BANNER[conn];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {!!banner && (
        <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.ink, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 3, borderBottomColor: c.red }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 17, letterSpacing: 1.2, color: c.panel, textAlign: 'center' }}>{banner}</Text>
        </View>
      )}
      <Animated.View style={{ flex: 1, transform: [{ translateX: screenShake }] }}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 14 }}>
            {screen !== 'board' && <Corner />}
            {ready ? <Current /> : null}
          </View>
        </ScrollView>
      </Animated.View>
      <FxLayer />
      {ready && <UpdatePrompt />}
    </SafeAreaView>
  );
}

export default function App() {
  const [loaded] = useFonts({ Bangers_400Regular, BarlowCondensed_600SemiBold, BarlowCondensed_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#f6e7a8' }} />;
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
