/** True when the layout is at the phone breakpoint the mobile shell targets. */
export function isPhoneViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 640px)').matches
  );
}
