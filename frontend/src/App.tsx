import { Routes, Route, Navigate, useLocation } from 'react-router';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { MyReviewsPage } from './pages/MyReviewsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { useState } from 'react';
import { HOME_PATH } from './routes';
import type { User } from './types';
import './App.css';

export interface ProtectedRouteProps {
    isLoggedIn: boolean;
    children: React.ReactNode;
}

function ProtectedRoute({ isLoggedIn, children }: ProtectedRouteProps) {
    if (!isLoggedIn) {
        return <Navigate to="/" replace />
    }
    return <>{children}</>;
}

function App() {
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
        setCurrentUser(null);
    }

    // After the profile page saves new account details.
    const handleUserUpdated = (user: User) => {
        localStorage.setItem('userInfo', JSON.stringify(user));
        setCurrentUser(user);
    }

    // The map page needs the room; the other pages read better narrower.
    const { pathname } = useLocation();
    const wide = pathname.startsWith('/recommendations');

    if (!isLoggedIn) {
        return (
            <Routes>
                <Route path="/" element={<LoginPage setLoggedIn={setLoggedIn} setCurrentUser={setCurrentUser} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <div className={`mx-auto px-4 py-5 font-sans sm:px-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
            <Header currentUser={currentUser} onLogout={handleLogout} />

            <Routes>
                <Route path={HOME_PATH} element={
                    <ProtectedRoute isLoggedIn={isLoggedIn}>
                        <RecommendationsPage currentUser={currentUser} />
                    </ProtectedRoute>}
                />
                <Route path="/catalog" element={
                    <ProtectedRoute isLoggedIn={isLoggedIn}>
                        <CatalogPage currentUser={currentUser} />
                    </ProtectedRoute>}
                />
                <Route path="/reviews" element={
                    <ProtectedRoute isLoggedIn={isLoggedIn}>
                        <MyReviewsPage currentUser={currentUser} />
                    </ProtectedRoute>}
                />
                <Route path="/profile" element={
                    <ProtectedRoute isLoggedIn={isLoggedIn}>
                        <ProfilePage currentUser={currentUser} onUserUpdated={handleUserUpdated} />
                    </ProtectedRoute>}
                />

                {/* "/" and unknown paths go home. */}
                <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
            </Routes>

            <Footer />
        </div>
    );
}

export default App;
