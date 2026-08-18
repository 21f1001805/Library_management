import { useEffect, type ReactNode } from 'react';

// Fixed dark theme, no light/system mode or toggle — see styles.css's `.dark` block
// for the actual color tokens.
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return <>{children}</>;
}
