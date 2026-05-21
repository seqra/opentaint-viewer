import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { useStore } from './state/store';
import { loadContent } from './content/loadContent';
import { hydrateFromHash } from './state/hydrate';

export default function App() {
  useEffect(() => {
    useStore.getState().loadContent(loadContent());
    if (location.hash) hydrateFromHash(location.hash);
  }, []);
  return <AppShell />;
}
