// Whole-screen comic effects drawn above everything: giant clue bubble, HA HA HA, BOOM.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, useWindowDimensions } from 'react-native';
import { onFx, screenShake, type Fx } from '../fx';
import { ND, useReducedMotion } from '../motion';
import { TEAM } from '../protocol';
import { playerName } from '../store';
import { FONT, INK, useTheme } from '../theme';
import { TAIL, Text } from './Text';

const JOKER_GREEN = '#3fbf3f', JOKER_PURPLE = '#6a2c91';

export default function FxLayer() {
  const [queue, setQueue] = useState<Fx[]>([]);
  useEffect(() => onFx((f) => setQueue((q) => (f.kind === 'assassin' ? [f] : [...q, f]).slice(-4))), []);
  const cur = queue[0];
  if (!cur) return null;
  const done = () => setQueue((q) => q.slice(1));
  return (
    <Pressable onPress={done} accessibilityLabel="Dismiss" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 100 }}>
      {cur.kind === 'clue' && <ClueFx key={cur.id} fx={cur} done={done} />}
      {cur.kind === 'laugh' && <LaughFx key={cur.id} fx={cur} done={done} />}
      {cur.kind === 'assassin' && <AssassinFx key={cur.id} fx={cur} done={done} />}
      {cur.kind === 'neutral' && <NeutralFx key={cur.id} fx={cur} done={done} />}
      {cur.kind === 'turn' && <TurnFx key={cur.id} fx={cur} done={done} />}
      {cur.kind === 'end' && <EndFx key={cur.id} fx={cur} done={done} />}
    </Pressable>
  );
}

const fill = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' as const, justifyContent: 'center' as const };
const comic = (size: number, color: string, shadow = INK, off = 4) => ({
  fontFamily: FONT.display, fontSize: size, color, letterSpacing: 2, textAlign: 'center' as const,
  textShadowColor: shadow, textShadowOffset: { width: off, height: off }, textShadowRadius: 0,
});

/** In → hold → out on one value (0 → 1 → 2), then done(). */
function useLife(hold: number, done: () => void, inMs = 0) {
  const a = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    const anim = Animated.sequence([
      inMs ? Animated.timing(a, { toValue: 1, duration: inMs, easing: Easing.out(Easing.back(2)), useNativeDriver: ND })
        : Animated.spring(a, { toValue: 1, friction: 5, tension: 90, useNativeDriver: ND }),
      Animated.delay(hold),
      Animated.timing(a, { toValue: 2, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
    ]);
    if (reduced) { a.setValue(1); const t = setTimeout(done, hold + 300); return () => clearTimeout(t); }
    anim.start(({ finished }) => finished && done());
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { a, reduced };
}

function ClueFx({ fx, done }: { fx: Extract<Fx, { kind: 'clue' }>; done: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const { a, reduced } = useLife(2600, done);
  const cl = fx.clue, team = cl.team === 'r' ? c.red : c.blue;
  // Size the word from the real space inside the bubble so even a 16-letter clue fits on one line, never clipped.
  const bubbleW = Math.min(width - 32, 760);
  const inner = bubbleW - 10 /* shadow */ - 12 /* borders */ - 2 * 22 /* padding */;
  const perChar = 0.56;                    // Bangers glyph width ≈ 0.5em, plus letter spacing and shadow
  // +0.6em: room for the italic lean and the hard shadow of the last letter (they draw past the glyph box)
  const wordSize = Math.floor(Math.max(26, Math.min(120, inner / (Math.max(3, cl.word.length) * perChar + 0.6))));
  const lean = Math.ceil(wordSize * 0.22);
  return (
    <View style={fill} accessibilityLiveRegion="assertive" accessibilityLabel={`${TEAM[cl.team].n} spymaster says ${cl.word}, ${cl.number === 0 ? 'unlimited' : cl.number}`}>
      <Animated.View style={[fill, { backgroundColor: 'rgba(22,19,14,0.8)', opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }) }]} />
      <Animated.View style={{ alignItems: 'center', width: bubbleW, opacity: a.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
        transform: reduced ? [] : [{ scale: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.04] }) }, { rotate: a.interpolate({ inputRange: [0, 1, 2], outputRange: ['-12deg', '-1.5deg', '0deg'] }) }] }}>
        <View style={{ marginRight: 10, marginBottom: 10, alignSelf: 'stretch' }}>
          <View style={{ position: 'absolute', left: 10, top: 10, right: -10, bottom: -10, backgroundColor: INK, borderRadius: 48 }} />
          <View style={{ backgroundColor: '#fff', borderWidth: 6, borderColor: INK, borderRadius: 48, paddingVertical: Math.max(18, Math.min(40, height * 0.04)), paddingHorizontal: 22, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: FONT.bold, fontSize: 18, letterSpacing: 2.5, color: team, textTransform: 'uppercase', textAlign: 'center' }}>{TEAM[cl.team].g} {TEAM[cl.team].n} spymaster says</Text>
            <Text numberOfLines={1} style={[comic(wordSize, INK, team, Math.max(2, Math.round(wordSize / 22))), { letterSpacing: 1, lineHeight: Math.round(wordSize * 1.1), paddingHorizontal: lean }]}>{cl.word}</Text>
            <View style={{ marginTop: 6, backgroundColor: team, borderWidth: 4, borderColor: INK, paddingHorizontal: 22, transform: [{ rotate: '4deg' }] }}>
              <Text style={comic(Math.max(36, Math.min(72, Math.round(wordSize * 0.6))), '#fff', INK, 3)}>{cl.number === 0 ? '∞' : cl.number}</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 0, height: 0, marginTop: -14, marginLeft: -140, borderLeftWidth: 22, borderRightWidth: 22, borderTopWidth: 44, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: INK }} />
      </Animated.View>
    </View>
  );
}

function LaughFx({ fx, done }: { fx: Extract<Fx, { kind: 'laugh' }>; done: () => void }) {
  const { width } = useWindowDimensions();
  const { a, reduced } = useLife(3200, done, 200);   // the laugh lingers
  const has = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current); // eslint-disable-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (reduced) { has.forEach((h) => h.setValue(1)); return; }
    Animated.stagger(220, has.map((h) => Animated.spring(h, { toValue: 1, friction: 3, tension: 140, useNativeDriver: ND }))).start();
    const wob = Animated.loop(Animated.sequence([
      Animated.timing(screenWobble, { toValue: 1, duration: 120, useNativeDriver: ND }),
      Animated.timing(screenWobble, { toValue: -1, duration: 120, useNativeDriver: ND }),
    ]));
    wob.start();
    return () => { wob.stop(); screenWobble.setValue(0); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const size = Math.min(150, width / 4.2);
  const words = ['HA', 'HA', 'HA!'];
  return (
    <View style={fill} accessibilityLiveRegion="assertive" accessibilityLabel={`Ha ha ha! ${TEAM[fx.team].n} picked a ${TEAM[fx.card].n} card`}>
      <Animated.View style={[fill, { backgroundColor: JOKER_PURPLE, opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.82, 0] }) }]} />
      <Animated.View style={{ alignItems: 'center', opacity: a.interpolate({ inputRange: [0, 1, 1.6, 2], outputRange: [0, 1, 1, 0] }) }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {words.map((w, i) => (
            <Animated.Text key={i} style={[comic(size * (i === 2 ? 1.25 : 1), i === 1 ? '#ffd23c' : JOKER_GREEN, INK, 6), { marginHorizontal: 4,
              transform: [
                { scale: has[i].interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                { rotate: screenWobble.interpolate({ inputRange: [-1, 1], outputRange: i % 2 ? ['10deg', '-6deg'] : ['-10deg', '6deg'] }) },
                { translateY: screenWobble.interpolate({ inputRange: [-1, 1], outputRange: i % 2 ? [-10, 6] : [6, -10] }) },
              ] }]}>{w}{TAIL}</Animated.Text>
          ))}
        </View>
        <View style={{ marginTop: 18, backgroundColor: '#fff', borderWidth: 4, borderColor: INK, paddingHorizontal: 16, paddingVertical: 6, transform: [{ rotate: '-2deg' }] }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 26, letterSpacing: 1, color: INK, textAlign: 'center' }}>
            {TEAM[fx.team].g} {playerName(fx.by)} picked {fx.word}… a {TEAM[fx.card].n.toUpperCase()} card!
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
const screenWobble = new Animated.Value(0);

function AssassinFx({ fx, done }: { fx: Extract<Fx, { kind: 'assassin' }>; done: () => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { a, reduced } = useLife(2600, done, 260);
  const flash = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const kick = (x: number, d = 50) => Animated.timing(screenShake, { toValue: x, duration: d, useNativeDriver: ND });
    Animated.parallel([
      Animated.sequence([kick(-18), kick(18), kick(-14), kick(14), kick(-10), kick(10), kick(-5), kick(0, 80)]),
      Animated.sequence([Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: ND }), Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: ND })]),
      Animated.loop(Animated.timing(rays, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: ND })),
    ]).start();
    return () => { screenShake.setValue(0); rays.stopAnimation(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const big = Math.min(220, width / 2.8);
  const loser = TEAM[fx.team];
  return (
    <View style={fill} accessibilityLiveRegion="assertive" accessibilityLabel={`Boom! ${loser.n} team hit the assassin and loses`}>
      <Animated.View style={[fill, { backgroundColor: INK, opacity: a.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 0.94, 0.94, 0] }) }]} />
      {/* spinning burst rays */}
      <Animated.View style={[fill, { opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.9, 0] }), transform: [{ rotate: rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={{ position: 'absolute', width: 34, height: Math.max(width, 900) * 1.2, backgroundColor: i % 2 ? c.red : '#ffd23c', opacity: 0.35, transform: [{ rotate: `${i * 15}deg` }] }} />
        ))}
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', opacity: a.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
        transform: [{ scale: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.1, 1, 1.5] }) }] }}>
        <Text style={comic(big, '#ffd23c', c.red, 10)}>BOOM!</Text>
        <Text style={comic(Math.round(big * 0.32), '#fff', INK, 0)}>✖ THE ASSASSIN ✖</Text>
        <View style={{ marginTop: 16, backgroundColor: fx.team === 'r' ? c.red : c.blue, borderWidth: 5, borderColor: '#fff', paddingHorizontal: 22, paddingVertical: 4, transform: [{ rotate: '-4deg' }] }}>
          <Text style={comic(Math.round(big * 0.3), '#fff', INK, 3)}>{loser.g} {loser.n.toUpperCase()} LOSES</Text>
        </View>
        <Text style={{ marginTop: 14, fontFamily: FONT.bold, fontSize: 18, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' }}>{playerName(fx.by)} tapped {fx.word}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, { backgroundColor: '#fff', opacity: flash }]} />
    </View>
  );
}

/** White (neutral) card: a big grey "MEH…" stamp and who picked it, on every screen. */
function NeutralFx({ fx, done }: { fx: Extract<Fx, { kind: 'neutral' }>; done: () => void }) {
  const { width } = useWindowDimensions();
  const { a } = useLife(1700, done, 220);
  const big = Math.min(170, width / 3.4);
  return (
    <View style={fill} accessibilityLiveRegion="assertive" accessibilityLabel={`${playerName(fx.by)} picked ${fx.word}, a neutral card`}>
      <Animated.View style={[fill, { backgroundColor: '#3a362e', opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.72, 0] }) }]} />
      <Animated.View style={{ alignItems: 'center', opacity: a.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1, 2], outputRange: [-260, 0, 40] }) }, { rotate: a.interpolate({ inputRange: [0, 1, 2], outputRange: ['14deg', '-5deg', '-8deg'] }) }] }}>
        <View style={{ backgroundColor: '#efe6cc', borderWidth: 6, borderColor: INK, paddingHorizontal: 28, paddingVertical: 6 }}>
          <Text style={comic(big, '#8a8270', INK, 5)}>MEH…</Text>
        </View>
        <View style={{ marginTop: 18, backgroundColor: '#fff', borderWidth: 4, borderColor: INK, paddingHorizontal: 16, paddingVertical: 6, maxWidth: width - 32, transform: [{ rotate: '2deg' }] }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1, color: INK, textAlign: 'center' }}>
            {TEAM[fx.team].g} {playerName(fx.by)} picked {fx.word}… an innocent bystander. Turn over!
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** Turn changes and the first turn: a team-coloured banner sweeps across the screen. */
function TurnFx({ fx, done }: { fx: Extract<Fx, { kind: 'turn' }>; done: () => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { a } = useLife(fx.start ? 1300 : 800, done, 260);
  const col = fx.team === 'r' ? c.red : c.blue;
  const t = TEAM[fx.team];
  return (
    <View style={fill} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityLabel={fx.start ? `Mission start. ${t.n} goes first` : `${t.n} team's turn`}>
      <Animated.View style={{ width: width + 80, alignItems: 'center', backgroundColor: col, borderTopWidth: 6, borderBottomWidth: 6, borderColor: INK, paddingVertical: 12,
        transform: [{ rotate: '-4deg' }, { translateX: a.interpolate({ inputRange: [0, 1, 2], outputRange: [-width - 80, 0, width + 80] }) }] }}>
        {fx.start && <Text style={{ fontFamily: FONT.bold, fontSize: 18, letterSpacing: 4, color: '#fff' }}>MISSION START</Text>}
        <Text style={comic(Math.min(84, width / 7), '#fff', INK, 5)}>{t.g} {t.n.toUpperCase()}{fx.start ? ' GOES FIRST' : "'S TURN"}</Text>
      </Animated.View>
    </View>
  );
}

/** Game over, personal: YOU WIN with confetti, or YOU LOSE with a slump. Spectators see who won. */
function EndFx({ fx, done }: { fx: Extract<Fx, { kind: 'end' }>; done: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const { a, reduced } = useLife(2400, done, 300);
  const win = fx.mine === null ? null : fx.mine === fx.winner;
  const col = fx.winner === 'r' ? c.red : c.blue;
  const bits = useRef(Array.from({ length: 28 }, (_, i) => ({ x: Math.random(), d: Math.random(), color: [c.red, c.blue, '#ffd23c', '#fff'][i % 4], r: Math.random() * 360 }))).current;
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!reduced) Animated.timing(fall, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: ND }).start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const big = Math.min(160, width / 4);
  const title = win === null ? `${TEAM[fx.winner].n.toUpperCase()} WINS!` : win ? 'YOU WIN!' : 'YOU LOSE…';
  return (
    <View style={fill} accessibilityLiveRegion="assertive" accessibilityLabel={title}>
      <Animated.View style={[fill, { backgroundColor: win === false ? '#1a1712' : col, opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.88, 0] }) }]} />
      {win !== false && bits.map((b, i) => (
        <Animated.View key={i} style={{ position: 'absolute', top: 0, left: b.x * width, width: 12, height: 18, backgroundColor: b.color, borderWidth: 2, borderColor: INK,
          opacity: a.interpolate({ inputRange: [0, 0.5, 1.6, 2], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40 - b.d * 200, height + 40] }) }, { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: [`${b.r}deg`, `${b.r + 540}deg`] }) }] }} />
      ))}
      <Animated.View style={{ alignItems: 'center', opacity: a.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] }),
        transform: win === false
          ? [{ translateY: a.interpolate({ inputRange: [0, 1, 2], outputRange: [-120, 0, 60] }) }, { rotate: a.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '-6deg', '-12deg'] }) }]
          : [{ scale: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 1, 1.2] }) }] }}>
        <Text style={comic(big, win === false ? '#8a8270' : '#ffd23c', INK, 7)}>{title}</Text>
        <View style={{ marginTop: 10, backgroundColor: col, borderWidth: 4, borderColor: '#fff', paddingHorizontal: 18, paddingVertical: 4, transform: [{ rotate: '-3deg' }] }}>
          <Text style={comic(Math.round(big * 0.28), '#fff', INK, 3)}>{TEAM[fx.winner].g} {TEAM[fx.winner].n.toUpperCase()} TEAM WINS</Text>
        </View>
      </Animated.View>
    </View>
  );
}
