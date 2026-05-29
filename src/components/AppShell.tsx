import { useEffect } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { useStepKeys } from './useStepKeys';
import { useTheme } from '../state/theme';
import styles from './AppShell.module.css';

export function AppShell() {
  const theme = useTheme((s) => s.theme);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <div className={styles.desktop}><DesktopShell /></div>
      <div className={styles.mobile}><MobileShell /></div>
    </>
  );
}
