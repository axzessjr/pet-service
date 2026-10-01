import { useState, useEffect } from 'react';
import type { Pet } from '../types';
import type { User } from '../App';
import { useLoading } from '../context/LoadingContext';

interface ProfilePageProps {
    currentUser: User | null;
}

export function ProfilePage({ currentUser }: ProfilePageProps) {
    const [loading, setLocalLoading] = useState<boolean>(true);
    const [pets, setPets] = useState<Pet[]>([]);
    const { setLoading: setGlobalLoading } = useLoading();

    const fetchPets = async () => {
        if (!currentUser?.id) {
            setLocalLoading(false);
            return;
        }

        setLocalLoading(true);
        setGlobalLoading(true);

        try {
            const response = await fetch(`/api/pet-profile/me?userId=${currentUser.id}`, {
                method: 'GET'
            });
            const data = await response.json();

            if (response.ok) {
                setPets(data);
            }
        } catch (error) {
            console.error('Error fetching pets:', error);
        } finally {
            setLocalLoading(false);
            setGlobalLoading(false);
        }
    };

    useEffect(() => {
        fetchPets();
    }, [currentUser?.id]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">
                    👤 My Profile
                </h2>
                <button
                    onClick={fetchPets}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                    <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
                    Refresh
                </button>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8 shadow-sm">
                <p className="text-gray-700 mb-2">
                    <strong className="text-gray-900 mr-2">Name:</strong>
                    {currentUser?.firstname} {currentUser?.lastname}
                </p>
                <p className="text-gray-700">
                    <strong className="text-gray-900 mr-2">Email:</strong>
                    {currentUser?.email}
                </p>
            </div>

            <h3 className="text-xl font-bold mb-3 text-gray-800">My Pets</h3>

            <ul className="list-none p-0 space-y-3">
                {pets.map((pet) => (
                    <li
                        key={pet.id}
                        className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center shadow-sm"
                    >
                        <strong className="text-blue-900 text-lg mr-2">
                            {pet.name}
                        </strong>
                        <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md text-sm font-semibold">
                            {pet.species}
                        </span>
                        <span className="ml-3 text-sm text-gray-700">
                            Needs: {pet.needs.join(', ')} · Budget: $
                            {pet.maxPrice}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}