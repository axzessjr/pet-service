import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

// The script in index.html sets the class before React loads, so the page
// never flashes the wrong theme. This reads it back.
function currentTheme(): Theme {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function savedTheme(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Storage can be blocked (private mode); the choice then lasts this visit.
    }
    listeners.forEach((listener) => listener());
}

// Until the person picks, follow the system setting as it changes.
if (typeof window !== 'undefined') {
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => {
            if (savedTheme()) return;
            document.documentElement.classList.toggle('dark', event.matches);
            listeners.forEach((listener) => listener());
        });
}

export function useTheme(): [Theme, () => void] {
    const theme = useSyncExternalStore(
        (onChange) => {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        currentTheme,
    );
    const toggle = useCallback(
        () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'),
        [],
    );
    return [theme, toggle];
}
