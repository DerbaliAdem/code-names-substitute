// End-of-game report, shown at the top of the board when phase = 'over':
// the front page of a pulp newspaper, written from the real game stats.
import React, { useState } from 'react';
import { View } from 'react-native';
import { request } from '../net';
import { TEAM, type RoomView, type Team } from '../protocol';
import { me, playerName } from '../store';
import { FONT, INK, useTheme } from '../theme';
import { Btn, Note } from './ui';
import { Text } from './Text';

const PAPER = '#f6ecd0';

export default function VictoryReport({ v }: { v: RoomView }) {
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const o = v.over!;
  const s = v.stats ?? { turns: v.turnNo, found: { r: 0, b: 0 }, topFinders: [], bestClue: null };
  const host = !!me(v)?.isHost;
  const win = TEAM[o.winner], loserK: Team = o.winner === 'r' ? 'b' : 'r', lose = TEAM[loserK];
  const winCol = o.winner === 'r' ? c.red : c.blue;

  const headline = o.reason === 'assassin'
    ? `${lose.n.toUpperCase()} BLOWN UP BY THE ASSASSIN!`
    : `${win.n.toUpperCase()} AGENTS CRACK THE CASE!`;

  // Stories from the real stats.
  const top = s.topFinders[0];
  const slips = Object.values(v.revealed).filter((r) => r.team === loserK && r.type !== loserK);
  const wrong = slips.filter((r) => r.type === o.winner).length, bystanders = slips.filter((r) => r.type === 'n').length;
  const stories: { title: string; body: string }[] = [
    { title: 'Top agent', body: top ? `${playerName(top.playerId, v)} found ${top.count} word${top.count === 1 ? '' : 's'}.` : 'Nobody found a word this time.' },
    { title: 'Clue of the night', body: s.bestClue && s.bestClue.hits
      ? `"${s.bestClue.word} · ${s.bestClue.number}" scored ${s.bestClue.hits} hit${s.bestClue.hits === 1 ? '' : 's'} for ${playerName(s.bestClue.by, v)}.`
      : 'No clue scored a single hit.' },
    { title: `${lose.n}'s bad luck`, body: o.reason === 'assassin'
      ? `${playerName(o.by, v)} walked straight into the assassin.`
      : wrong + bystanders
        ? `${lose.n} hit ${wrong ? `${wrong} rival agent${wrong === 1 ? '' : 's'}` : ''}${wrong && bystanders ? ' and ' : ''}${bystanders ? `${bystanders} bystander${bystanders === 1 ? '' : 's'}` : ''}.`
        : `${lose.n} played clean but ran out of time.` },
  ];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ marginRight: 6, marginBottom: 6 }}>
        <View style={{ position: 'absolute', left: 6, top: 6, right: -6, bottom: -6, backgroundColor: winCol }} />
        <View accessibilityRole="header" style={{ backgroundColor: PAPER, borderWidth: 4, borderColor: INK, padding: 14, gap: 8 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 36, letterSpacing: 2, color: INK, textAlign: 'center', borderBottomWidth: 4, borderBottomColor: INK, paddingBottom: 2 }}>THE PULP GAZETTE</Text>
          <View style={{ flexDirection: 'row', gap: 24, borderBottomWidth: 2, borderBottomColor: INK, paddingBottom: 3 }}>
            <Text style={{ fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1.5, color: INK }}>ROOM {v.code}</Text>
            <Text style={{ fontFamily: FONT.bold, fontSize: 12, letterSpacing: 1.5, color: INK }}>LATE EDITION</Text>
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 42, lineHeight: 44, letterSpacing: 1, color: winCol, textAlign: 'center' }}>{headline}</Text>
          <Text style={{ fontFamily: FONT.bold, fontSize: 15, letterSpacing: 1, color: INK, textAlign: 'center' }}>
            {s.turns} TURNS  ·  {TEAM.r.g} RED FOUND {s.found.r}  ·  {TEAM.b.g} BLUE FOUND {s.found.b}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 2, borderTopColor: INK, paddingTop: 8 }}>
            {stories.map((st) => (
              <View key={st.title} style={{ flexBasis: 160, flexGrow: 1, gap: 2 }}>
                <Text style={{ fontFamily: FONT.display, fontSize: 19, letterSpacing: 1, color: INK }}>{st.title.toUpperCase()}</Text>
                <Text style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 20, color: INK }}>{st.body}</Text>
              </View>
            ))}
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 54, borderWidth: 4, borderColor: c.red, paddingHorizontal: 8, backgroundColor: PAPER, transform: [{ rotate: '12deg' }] }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: 1, color: c.red }}>CASE CLOSED</Text>
          </View>
        </View>
      </View>
      <Btn label={host ? 'Rematch · teams swap sides' : 'Waiting for the host to rematch'} disabled={!host}
        onPress={async () => { const r = await request('game:rematch', { swap: true }); setMsg(r.ok ? '' : r.error.message); }} />
      <Note text={msg} />
    </View>
  );
}
