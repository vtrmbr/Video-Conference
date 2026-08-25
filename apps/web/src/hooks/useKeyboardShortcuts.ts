import { useEffect } from 'react';

export function useKeyboardShortcuts(onToggleDiagnostics: () => void) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        onToggleDiagnostics();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onToggleDiagnostics]);
}
