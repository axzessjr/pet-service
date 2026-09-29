import { Routes, Route, Link } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { ProfilePage } from './pages/ProfilePage';
import './App.css';

function App() {
    return (
        <div className="p-5 font-sans max-w-3xl mx-auto">
            <nav className="flex items-center gap-5 pb-5 border-b-2 border-gray-200 mb-5">
                <h1 className="text-3xl font-bold mr-auto text-gray-800">
                    <i className="fa-solid fa-paw text-purple-600 mr-2"></i> 
                    Pawpal
                </h1>
                
                <Link to="/" className="text-blue-500 font-bold hover:text-blue-700 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-list-ul"></i> Catalog
                </Link>
                <Link to="/profile" className="text-blue-500 font-bold hover:text-blue-700 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-user"></i> My Profile
                </Link>
            </nav>

            {/* 2. This is where the pages change based on the URL! */}
            <Routes>
                {/* When the URL is "/" show the CatalogPage */}
                <Route path="/" element={<CatalogPage />} />
                
                {/* When the URL is "/profile" show the ProfilePage */}
                <Route path="/profile" element={<ProfilePage />} />
            </Routes>
        </div>
    );
}

export default App;
