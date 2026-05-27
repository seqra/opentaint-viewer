import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { useStore } from './state/store';
import { loadContent } from './content/loadContent';

export default function App() {
  useEffect(() => {
    useStore.getState().loadContent(loadContent());
  }, []);
  return <AppShell />;
}
