import { Routes, Route, NavLink } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import './App.css';

function App() {
    return (
        <div className="mx-auto max-w-5xl px-4 py-5 font-sans sm:px-6">
            <nav
                aria-label="Main navigation"
                className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-gray-200 pb-5"
            >
                <h1 className="mr-auto text-3xl font-bold text-gray-800">
                    <i
                        aria-hidden="true"
                        className="fa-solid fa-paw mr-2 text-teal-700"
                    ></i>
                    Pawpal
                </h1>
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive ? 'text-teal-800 underline underline-offset-4' : 'text-gray-700 hover:text-teal-800'}`
                    }
                >
                    Catalog
                </NavLink>
                <NavLink
                    to="/recommendations"
                    className={({ isActive }) =>
                        `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive ? 'text-teal-800 underline underline-offset-4' : 'text-gray-700 hover:text-teal-800'}`
                    }
                >
                    For my pet
                </NavLink>
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `rounded-md px-2 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isActive ? 'text-teal-800 underline underline-offset-4' : 'text-gray-700 hover:text-teal-800'}`
                    }
                >
                    My Profile
                </NavLink>
            </nav>

            {/* 2. This is where the pages change based on the URL! */}
            <Routes>
                {/* When the URL is "/" show the CatalogPage */}
                <Route path="/" element={<CatalogPage />} />
                <Route
                    path="/recommendations"
                    element={<RecommendationsPage />}
                />

                {/* When the URL is "/profile" show the ProfilePage */}
                <Route path="/profile" element={<ProfilePage />} />
            </Routes>
        </div>
    );
}

export default App;
