// Shared animation helpers (React Native Animated, works on Android, iOS and web).
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** Native driver is not available on web. */
export const ND = Platform.OS !== 'web';

/** True when the player asked the OS for reduced motion. Animations then jump straight to the end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
