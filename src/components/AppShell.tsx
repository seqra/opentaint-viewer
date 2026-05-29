import { useEffect } from 'react';
import { DesktopShell } from './DesktopShell';
import { useStepKeys } from './useStepKeys';
import { useTheme } from '../state/theme';

export function AppShell() {
  const theme = useTheme((s) => s.theme);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return <DesktopShell />;
}
