import { useState } from 'react';
import { useNavigate, Link } from 'react-router';

interface LoginPageProps {
    setLoggedIn: (state: boolean) => void;
    setCurrentUser: (user: any) => void;
}

// Accept setLoggedIn as a property here
export function LoginPage({ setLoggedIn, setCurrentUser }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const navigate = useNavigate(); // Create the navigate function

    const handleLogin = async () => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Success: ' + data.message);
                // Update the App's state! The user is now logged in.
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userInfo', JSON.stringify(data.user));

                setLoggedIn(true);
                setCurrentUser(data.user);

                // end them straight to the catalog page!
                navigate('/catalog');
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Something went wrong connecting to the server!');
        }
    };


    return (
        <div className="p-5 pb-10 bg-green-50 rounded">
            <div className="font-bold mb-5 text-xl text-center">
                <i className="fa-solid fa-paw text-green-900 mr-2"></i>
                Pet Service
            </div>
            <div className="flex flex-col items-center">
                <label className="w-[250px] font-semibold">
                    Username:
                </label>
                <input
                    type="text"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border border-green-600 p-2 rounded w-[250px] mt-1"
                    placeholder="..."
                />
                <label className="w-[250px] font-semibold mt-2">
                    Password:
                </label>
                <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-green-600 p-2 rounded w-[250px] mt-1"
                    placeholder="..."
                />
            </div>
            <div className="flex flex-col items-center justify-center mt-8">
                <button
                    onClick={handleLogin}
                    className="w-[250px] px-5 py-2 rounded-lg bg-green-950 cursor-pointer text-white hover:bg-green-800 transition-colors"
                >
                    Login
                </button>

                <div className="mt-3">
                    Not registered?
                    <Link to="/createuser" className="text-blue-500 font-semibold ml-2">
                        Create an account
                    </Link>
                </div>

            </div>
        </div>
    );
}
