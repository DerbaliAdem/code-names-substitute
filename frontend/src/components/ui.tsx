// Pulp comic building blocks: inked panels with hard offset shadows, buttons, bursts.
import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { FONT, INK, useTheme } from '../theme';
import { Hero } from './Hero';
import { Text } from './Text';

/** Hard offset shadow that looks the same on iOS, Android and web. */
export function Inked({ offset = 5, shadow, style, children, rotate }: { offset?: number; shadow?: string; style?: StyleProp<ViewStyle>; children: React.ReactNode; rotate?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginRight: offset, marginBottom: offset, transform: rotate ? [{ rotate }] : undefined }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: shadow ?? c.ink, transform: [{ translateX: offset }, { translateY: offset }] }]} />
      <View style={style}>{children}</View>
    </View>
  );
}

export function Panel({ children, top, style }: { children: React.ReactNode; top?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <Inked style={[{ backgroundColor: c.panel, borderWidth: 3, borderColor: c.ink, padding: 12, gap: 10 }, top ? { borderTopWidth: 14, borderTopColor: top } : null, style]}>
      {children}
    </Inked>
  );
}

export function Cap({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text style={[{ fontFamily: FONT.bold, fontSize: 13, letterSpacing: 1.6, lineHeight: 17, textTransform: 'uppercase', color: c.ink, opacity: 0.88 }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text style={[{ fontFamily: FONT.body, fontSize: 18, lineHeight: 22, color: c.ink }, style]}>{children}</Text>;
}

export function H3({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1.2, color: c.ink }}>{children}</Text>;
}

export function Note({ text }: { text?: string }) {
  const { c } = useTheme();
  return <Text accessibilityLiveRegion="polite" style={{ fontFamily: FONT.bold, fontSize: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: c.red, minHeight: 18 }}>{text || ''}</Text>;
}

type Variant = 'hl' | 'alt' | 'r' | 'b';
export function Btn({ label, onPress, variant = 'hl', disabled, small, style }: { label: string; onPress?: () => void; variant?: Variant; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = { hl: c.hl, alt: c.panel, r: c.red, b: c.blue }[variant];
  const fg = variant === 'alt' ? c.ink : variant === 'hl' ? INK : '#fff';
  const border = variant === 'alt' ? c.ink : INK;
  const off = small ? 3 : 5;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[{ alignSelf: small ? 'flex-start' : 'stretch', opacity: disabled ? 0.5 : 1 }, style]}>
      {({ pressed }) => (
        <View style={{ marginRight: off, marginBottom: off }}>
          {!pressed && !disabled && <View style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, transform: [{ translateX: off }, { translateY: off }] }]} />}
          <View style={{ backgroundColor: bg, borderWidth: 3, borderColor: border, paddingVertical: small ? 3 : 6, paddingHorizontal: small ? 12 : 18, transform: pressed ? [{ translateX: off }, { translateY: off }] : undefined }}>
            <Text style={{ fontFamily: FONT.display, fontSize: small ? 18 : 24, letterSpacing: 1.2, color: fg, textAlign: 'center' }}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Big tilted yellow title panel. `glow` is the text-shadow colour. */
export function Burst({ title, sub, small, glow }: { title: string; sub?: string; small?: boolean; glow?: string }) {
  const { c } = useTheme();
  return (
    <Inked offset={small ? 5 : 7} rotate="-1.5deg" style={{ backgroundColor: c.hl, borderWidth: 4, borderColor: INK, paddingVertical: small ? 4 : 16, paddingHorizontal: 16, alignItems: 'center' }}>
      <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: small ? 34 : 58, lineHeight: small ? 38 : 60, letterSpacing: 1.5, color: INK, textAlign: 'center', textShadowColor: glow ?? c.red, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 }}>
        {title}
      </Text>
      {sub ? <Text style={{ fontFamily: FONT.bold, fontSize: 16, letterSpacing: 2.2, textTransform: 'uppercase', color: INK, marginTop: 4, textAlign: 'center' }}>{sub}</Text> : null}
    </Inked>
  );
}

export function Field(props: TextInputProps) {
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.ink + '88'} {...props} style={[{ fontFamily: FONT.bold, fontSize: 20, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 3, borderColor: c.ink, backgroundColor: c.panel, color: c.ink }, props.style]} />;
}

export function Tag({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ fontFamily: FONT.display, fontSize: 14, letterSpacing: 0.8, backgroundColor: c.ink, color: c.panel, paddingHorizontal: 8 }}>{children}</Text>;
}

/** First character of a name; whole even when it's an emoji. */
export const initial = (name: string) => ([...name][0] ?? '?').toUpperCase();

export function Avatar({ name, color, badge, small }: { name: string; color: string; badge: string; small?: boolean }) {
  const size = small ? 38 : 60;
  const bw = small ? 2 : 3;
  return (
    <Inked offset={small ? 2 : 3} rotate="-3deg" style={{ width: size, height: size, borderWidth: bw, borderColor: INK }}>
      <Hero badge={badge} color={color} size={size - 2 * bw} />
    </Inked>
  );
}

/** A player line: avatar, name, role tag. */
export function Row({ left, right, you }: { left: React.ReactNode; right?: React.ReactNode; you?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: you ? 3 : 2, borderColor: c.ink, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: you ? c.hl : c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>{left}</View>
      {right}
    </View>
  );
}
