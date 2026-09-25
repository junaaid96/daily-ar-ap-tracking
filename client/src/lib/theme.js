import { useEffect, useState } from 'react';

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('ledgerly-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f14' : '#0f766e');
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}
