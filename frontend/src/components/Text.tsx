// Text that doesn't lose the last letter of the comic font on Android. Use it instead of React Native's Text.
import React from 'react';
import { Platform, StyleSheet, Text as NativeText, type TextProps } from 'react-native';
import { FONT } from '../theme';

/**
 * Bangers leans to the right, so its last letter draws past its own width. Android clips it there ("7" looks like "1") and
 * may even wrap and hide the last word. A trailing no-break space gives the letter room; padding doesn't, it clips inside it.
 */
export const TAIL = Platform.OS === 'android' ? ' ' : '';

export function Text({ style, children, ...props }: TextProps) {
  const flat = Platform.OS === 'android' ? StyleSheet.flatten(style) : undefined;
  if (flat?.fontFamily !== FONT.display) return <NativeText {...props} style={style}>{children}</NativeText>;
  // A smaller tail is enough for the lean, and keeps rows that are just wide enough on one line.
  return (
    <NativeText {...props} style={[{ includeFontPadding: false }, style]}>
      {children}<NativeText style={{ fontSize: (flat.fontSize ?? 14) * 0.55, letterSpacing: 0 }}>{TAIL}</NativeText>
    </NativeText>
  );
}
