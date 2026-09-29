import { useState, useEffect } from 'react';

// Define what our User profile looks like
type UserProfile = {
    name: string;
    email: string;
    pets: { id: number; name: string; species: string }[];
};

export function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = () => {
        setLoading(true);
        // Fetch the profile data from our NestJS backend!
        fetch('http://localhost:3000/pet-profile/me')
            .then((response) => response.json())
            .then((data) => {
                setProfile(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching profile:', error);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    if (loading && !profile) {
        return <p className="text-gray-500 italic">Loading profile...</p>;
    }

    if (!profile) {
        return <p className="text-red-500">Error loading profile.</p>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">👤 My Profile</h2>
                
                <button 
                    onClick={fetchProfile}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                    <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i> 
                    Refresh
                </button>
            </div>
            
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8 shadow-sm">
                <p className="text-gray-700 mb-2"><strong className="text-gray-900">Name:</strong> {profile.name}</p>
                <p className="text-gray-700"><strong className="text-gray-900">Email:</strong> {profile.email}</p>
            </div>

            <h3 className="text-xl font-bold mb-3 text-gray-800">My Pets</h3>
            
            <ul className="list-none p-0 space-y-3">
                {profile.pets.map(pet => (
                    <li 
                        key={pet.id} 
                        className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center shadow-sm"
                    >
                        <strong className="text-blue-900 text-lg mr-2">{pet.name}</strong> 
                        <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md text-sm font-semibold">{pet.species}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

