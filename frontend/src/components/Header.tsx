import { Link, NavLink, useNavigate } from 'react-router';
import type { User } from '../App';
import { HOME_PATH } from '../routes';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive
        ? 'text-teal-800 underline decoration-amber-500 decoration-[3px] underline-offset-8'
        : 'text-gray-600 hover:text-teal-800'}`;

export function Header({ currentUser, onLogout }: HeaderProps) {
    const navigate = useNavigate();

    return (
        <nav aria-label="Main navigation" className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-gray-200 pb-5">
            <Link
                to={HOME_PATH}
                className="mr-auto flex items-center rounded-md text-3xl font-bold text-gray-900 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            >
                <i aria-hidden="true" className="fa-solid fa-paw mr-2 text-teal-500"></i>
                Pawpal
            </Link>
            <NavLink to={HOME_PATH} className={linkClass}>
                For my pet
            </NavLink>
            <NavLink to="/catalog" className={linkClass}>
                Catalog
            </NavLink>
            <NavLink to="/reviews" className={linkClass}>
                My reviews
            </NavLink>
            {currentUser && (
                <NavLink
                    to="/profile"
                    className={({ isActive }) => `inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold text-gray-900 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${isActive ? 'border-teal-700 bg-teal-100' : 'border-teal-200 bg-teal-50 hover:bg-teal-100'}`}
                >
                    <i aria-hidden="true" className="fa-solid fa-user mr-1.5 text-teal-700"></i>
                    {currentUser.firstname}
                    <span className="sr-only"> (my profile)</span>
                </NavLink>
            )}
            <ThemeToggle />
            <button
                type="button"
                onClick={() => {
                    onLogout();
                    navigate('/', { replace: true });
                }}
                className="min-h-11 rounded-md border-0 bg-transparent px-2 font-semibold text-gray-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            >
                Log out
            </button>
        </nav>
    );
}
