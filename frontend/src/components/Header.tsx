import { NavLink } from 'react-router';

interface HeaderProps {
    isLoggedIn: boolean;
    currentUser: any;
    onLogout: () => void;
}

export function Header({ isLoggedIn, currentUser, onLogout }: HeaderProps) {
    return (
        <nav aria-label="Main navigation" className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-gray-200 pb-5" >
            <h1 className="mr-auto text-3xl font-bold text-gray-800">
                <i aria-hidden="true" className="fa-solid fa-paw mr-2 text-teal-700" ></i>
                Pawpal
            </h1>
            <NavLink to="/catalog" className={({ isActive }) => `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive ? 'text-teal-800 underline underline-offset-4' : 'text-gray-700 hover:text-teal-800'}`} >
                Catalog
            </NavLink>
            <NavLink to="/recommendations" className={({ isActive }) => `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive ? 'text-teal-800 underline underline-offset-4' : 'text-gray-700 hover:text-teal-800'}`} >
                For my pet
            </NavLink>
            {isLoggedIn && currentUser && (<>
                <NavLink to="/profile">
                    <span className="text-sm font-medium text-teal-900 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-200">
                        <i className="fa-solid fa-user mr-1.5 text-teal-600"></i>
                        {currentUser.firstname}
                    </span>
                </NavLink>
                <NavLink
                    to="/"
                    onClick={onLogout}
                    className="rounded font-semibold text-gray-700 hover:text-red-600 transition-colors">
                    Log out
                </NavLink>
            </>)}
        </nav>
    );
}
