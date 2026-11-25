import React from 'react';
import { Text, View } from 'react-native';
import { Body, Btn, Burst, Inked, Panel } from '../components/ui';
import { go } from '../store';
import { FONT, useTheme } from '../theme';

const STEPS = [
  ['PICK SIDES', 'Join the red or blue team in the lobby as the spymaster or as an agent. Each team has one spymaster who sees the key.'],
  ['GIVE A CLUE', 'The spymaster sends one word and one number. The number says how many board words it connects. A clue cannot match a word on the board.'],
  ['GUESS', 'Agents tap words. Right colour and you keep going, up to the number plus one. Wrong colour ends the turn. A timer can be turned on in the lobby.'],
  ['AVOID THE ✖', 'Tap the assassin and your team loses at once. Find all your words first to win. Red is ▲, blue is ●, so colour is never the only clue.'],
];

export default function Rules() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <Burst title="HOW TO PLAY" sub="Learn it in four panels" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {STEPS.map(([title, text], i) => (
          <View key={title} style={{ flexGrow: 1, flexBasis: 200 }}>
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Inked offset={0} rotate="-6deg" style={{ width: 34, height: 34, backgroundColor: c.red, borderWidth: 3, borderColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: FONT.display, fontSize: 20, color: '#fff' }}>{i + 1}</Text>
                </Inked>
                <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 24, color: c.ink }}>{title}</Text>
              </View>
              <Body>{text}</Body>
            </Panel>
          </View>
        ))}
      </View>
      <Btn label="Got it" onPress={() => go('home')} />
    </View>
  );
}
