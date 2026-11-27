// Scrolls the app's ScrollView so a text field stays above the on-screen keyboard.
// `windowSoftInputMode: "resize"` (app.json) only shrinks the available screen height; it never
// moves the page, so a field anywhere but the very top can still end up hidden under the keyboard.
// Call `registerKeyboardScroll` once with the app's ScrollView ref, then pass
// `onFocus={scrollInputIntoView}` to any TextInput that can be covered.
import { Platform } from 'react-native';

// react-native's focus event target is a host component instance on the new architecture (with
// its own `measureLayout`), not a numeric node handle, so this is typed loosely on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FocusEvent = { target?: any; nativeEvent?: { target?: any } };
type Scrollable = { scrollTo: (opts: { y: number; animated?: boolean }) => void; getInnerViewNode?: () => unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let scrollRef: React.RefObject<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerKeyboardScroll(ref: React.RefObject<any>) {
  scrollRef = ref;
}

export function scrollInputIntoView(e: FocusEvent) {
  const target = e.target ?? e.nativeEvent?.target;
  const scrollView: Scrollable | null = scrollRef?.current ?? null;
  const scrollNode = scrollView && (scrollView.getInnerViewNode?.() ?? scrollView);
  if (!target || typeof target !== 'object' || !target.measureLayout || !scrollNode) return;
  // Give the keyboard (and, on Android, the window resize) a moment to start before measuring.
  setTimeout(() => {
    target.measureLayout(scrollNode, (_x: number, y: number) => scrollView!.scrollTo({ y: Math.max(0, y - 80), animated: true }), () => {});
  }, Platform.OS === 'android' ? 120 : 0);
}
