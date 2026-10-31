import { useTheme } from '../theme';

// Switches between light and dark mode. The label names what it will do.
export function ThemeToggle({ className = '' }: { className?: string }) {
    const [theme, toggle] = useTheme();
    const dark = theme === 'dark';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={label}
            title={label}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${className}`}
        >
            <i aria-hidden="true" className={`fa-solid ${dark ? 'fa-sun text-amber-600' : 'fa-moon text-teal-700'}`}></i>
        </button>
    );
}
