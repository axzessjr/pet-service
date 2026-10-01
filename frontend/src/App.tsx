import { Routes, Route, Navigate } from 'react-router';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { useState } from 'react';
import './App.css';

export interface ProtectedRouteProps {
    isLoggedIn: boolean;
    children: React.ReactNode;
}

export interface User {
    id: any;
    firstname: string;
    lastname: string;
    email: string;
}

function ProtectedRoute({ isLoggedIn, children }: ProtectedRouteProps) {
    if (!isLoggedIn) {
        // Not logged in? Kick them back to the login page!
        return <Navigate to="/" replace />
    }
    // Logged in? Render the page
    return <>{children}</>;
}

function App() {
    // const [isLoggedIn, setLoggedIn] = useState<boolean>(false);
    const [isLoggedIn, setLoggedIn] = useState<boolean>(() => {
        return localStorage.getItem('isLoggedIn') === 'true';
    });
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            return JSON.parse(userInfo);
        }
        return null;
    });

    const handleLogout = () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userInfo');
        setLoggedIn(false);
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-5 font-sans sm:px-6">
            {/* Pass the state to the Header! */}
            {isLoggedIn && <> <Header isLoggedIn={isLoggedIn} currentUser={currentUser} onLogout={handleLogout} /> </>}

            {/* This is where the pages change based on the URL! */}
            <Routes>
                {/* Public route */}
                {!isLoggedIn && (
                    <Route path="/" element={<LoginPage setLoggedIn={setLoggedIn} setCurrentUser={setCurrentUser} />} />
                )}

                {/* Protected routes */}
                {isLoggedIn && (
                    <>
                        <Route path="/catalog" element={
                            <ProtectedRoute isLoggedIn={isLoggedIn}>
                                <CatalogPage />
                            </ProtectedRoute>}
                        />
                        <Route path="/recommendations" element={
                            <ProtectedRoute isLoggedIn={isLoggedIn}>
                                <RecommendationsPage currentUser={currentUser} />
                            </ProtectedRoute>}
                        />
                        <Route path="/profile" element={
                            <ProtectedRoute isLoggedIn={isLoggedIn}>
                                <ProfilePage currentUser={currentUser} />
                            </ProtectedRoute>}
                        />
                    </>
                )}

                {/* Fallback: redirect unknown paths */}
                <Route path="*" element={<Navigate to={isLoggedIn ? "/catalog" : "/"} replace />} />
            </Routes>

            {isLoggedIn && <> <Footer /> </>}
        </div >
    );
}

export default App;
