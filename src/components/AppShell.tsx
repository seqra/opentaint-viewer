import { useEffect, useSyncExternalStore } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { useStepKeys } from './useStepKeys';
import { useTheme } from '../state/theme';

const PHONE_MEDIA = '(max-width: 640px)';
function subscribeViewport(cb: () => void) {
  const mql = window.matchMedia(PHONE_MEDIA);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function readIsPhone() {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_MEDIA).matches;
}

export function AppShell() {
  const theme = useTheme((s) => s.theme);
  const isPhone = useSyncExternalStore(subscribeViewport, readIsPhone, () => false);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return isPhone ? <MobileShell /> : <DesktopShell />;
}
