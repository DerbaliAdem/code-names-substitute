// Root: fonts, persisted prefs, connection, top bar, screen switch.
import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { BarlowCondensed_600SemiBold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Linking, Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { connect } from './src/net';
import type { RoomView } from './src/protocol';
import Board from './src/screens/Board';
import Home from './src/screens/Home';
import Lobby from './src/screens/Lobby';
import Profile from './src/screens/Profile';
import Rules from './src/screens/Rules';
import Win from './src/screens/Win';
import { playDiff } from './src/sound';
import { getState, go, loadPersisted, onViewChange, setSoundOn, setState, setThemePref, setView, useApp, type Screen, type ThemePref } from './src/store';
import { FONT, INK, useTheme } from './src/theme';

const SCREENS: Record<Screen, () => React.JSX.Element> = { home: Home, profile: Profile, lobby: Lobby, board: Board, win: Win, rules: Rules };
const TABS: [Screen, string][] = [['home', 'Home'], ['profile', 'Profile'], ['lobby', 'Lobby'], ['board', 'Board'], ['win', 'Victory'], ['rules', 'Rules']];
const BANNER = { connecting: '', online: '', waking: 'Waking the server… the first visit can take up to a minute', reconnecting: 'Connection lost. Reconnecting…' };
const NEXT_THEME: Record<ThemePref, ThemePref> = { auto: 'light', light: 'dark', dark: 'auto' };

/** Follow phase changes: lobby→play to board, play→over to victory, over→lobby to lobby. */
function route(a: RoomView | null, b: RoomView | null) {
  if (!b) return;
  if (!a || a.code !== b.code) { if (b.phase === 'play') go('board'); else if (b.phase === 'over') go('win'); return; }
  if (a.phase === b.phase) return;
  go(b.phase === 'play' ? 'board' : b.phase === 'over' ? 'win' : 'lobby');
}

function TopBar() {
  const { screen, soundOn, themePref } = useApp();
  const { c } = useTheme();
  const chip = (label: string, active: boolean, onPress: () => void, key: string, small = false) => (
    <Pressable key={key} onPress={onPress} accessibilityRole={small ? 'button' : 'tab'} accessibilityState={{ selected: active }}
      style={{ backgroundColor: active ? c.hl : c.panel, borderWidth: 3, borderColor: c.ink, paddingHorizontal: 10, paddingVertical: 1, marginRight: active ? 0 : 3, marginBottom: active ? 0 : 3, transform: active ? [{ translateX: 2 }, { translateY: 2 }] : undefined }}>
      <Text style={{ fontFamily: FONT.display, fontSize: small ? 15 : 18, letterSpacing: 0.9, color: active ? INK : c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 }}>
        {TABS.map(([id, label]) => chip(label, screen === id, () => go(id), id))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {chip('Sound: ' + (soundOn ? 'On' : 'Off'), false, () => setSoundOn(!soundOn), 'snd', true)}
        {chip('Theme: ' + themePref[0].toUpperCase() + themePref.slice(1), false, () => setThemePref(NEXT_THEME[themePref]), 'thm', true)}
      </View>
    </View>
  );
}

function Main() {
  const { screen, conn, ready } = useApp();
  const { c, dark } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const Current = SCREENS[screen];

  useEffect(() => {
    const off = onViewChange((a, b) => { playDiff(a, b); route(a, b); });
    (async () => {
      await loadPersisted();
      const url = await Linking.getInitialURL().catch(() => null);
      const m = url && /[?&]room=([A-Za-z]{5})/.exec(url);
      if (m) setState({ inviteCode: m[1].toUpperCase() });
      connect();
    })();
    // Debug hook for testing the UI without a backend (web console): cn.setView(fakeRoomView)
    (globalThis as any).cn = { setView, getState };
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
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 18 }}>
          <TopBar />
          {ready ? <Current /> : null}
        </View>
      </ScrollView>
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
