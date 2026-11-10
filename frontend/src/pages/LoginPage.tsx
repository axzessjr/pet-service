import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useLoading } from '../context/useLoading';
import { controlClass, primaryButtonClass } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { HOME_PATH } from '../routes';
import type { User } from '../types';

interface LoginPageProps {
    setLoggedIn: (state: boolean) => void;
    setCurrentUser: (user: User) => void;
}

type FieldErrors = { username?: string; password?: string };

export function LoginPage({ setLoggedIn, setCurrentUser }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    // From the server: wrong details, or the server could not be reached.
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { setLoading } = useLoading();
    const navigate = useNavigate();

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        const errors: FieldErrors = {};
        if (!username.trim()) errors.username = 'Enter your username.';
        if (!password) errors.password = 'Enter your password.';
        setFieldErrors(errors);
        setFormError('');
        if (errors.username || errors.password) return;

        setSubmitting(true);
        setLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userInfo', JSON.stringify(data.user));
                setLoggedIn(true);
                setCurrentUser(data.user);
                navigate(HOME_PATH);
            } else if (response.status === 401) {
                setFormError('Username or password is incorrect. Check them and try again.');
            } else {
                setFormError(data.message ?? 'Could not log in. Please try again.');
            }
        } catch {
            setFormError('Could not reach Pawpal. Check your connection and try again.');
        } finally {
            setSubmitting(false);
            setLoading(false);
        }
    };

    // A server error is about both fields, so both show it.
    const usernameInvalid = Boolean(fieldErrors.username || formError);
    const passwordInvalid = Boolean(fieldErrors.password || formError);
    const inputClass = (invalid: boolean) =>
        `${controlClass} mt-1 w-full ${invalid ? 'border-red-700' : ''}`;

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-teal-50 px-4 py-12 font-sans">
            <ThemeToggle className="absolute right-4 top-4" />
            <form
                onSubmit={handleLogin}
                noValidate
                className="w-full max-w-sm space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-9"
            >
                <div className="text-center">
                    <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sun text-2xl text-sun-ink">
                        <i className="fa-solid fa-paw"></i>
                    </span>
                    <h1 className="mb-1 mt-3 text-3xl font-bold text-gray-900">Pawpal</h1>
                    <p className="m-0 text-gray-600">Log in to find care for your pet.</p>
                </div>

                <div>
                    <label htmlFor="login-username" className="block text-sm font-semibold text-gray-900">
                        Username
                    </label>
                    <input
                        id="login-username"
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, username: undefined }));
                        }}
                        aria-invalid={usernameInvalid}
                        aria-describedby={fieldErrors.username ? 'login-username-error' : formError ? 'login-error' : undefined}
                        className={inputClass(usernameInvalid)}
                        placeholder="Your email, e.g. name@example.com"
                    />
                    {fieldErrors.username && (
                        <p id="login-username-error" className="mb-0 mt-1 text-sm text-red-700">
                            {fieldErrors.username}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="login-password" className="block text-sm font-semibold text-gray-900">
                        Password
                    </label>
                    <input
                        id="login-password"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        aria-invalid={passwordInvalid}
                        aria-describedby={fieldErrors.password ? 'login-password-error' : formError ? 'login-error' : undefined}
                        className={inputClass(passwordInvalid)}
                        placeholder="Enter your password"
                    />
                    {fieldErrors.password && (
                        <p id="login-password-error" className="mb-0 mt-1 text-sm text-red-700">
                            {fieldErrors.password}
                        </p>
                    )}
                    {formError && (
                        <p id="login-error" role="alert" className="mb-0 mt-2 flex items-start gap-2 text-sm text-red-700">
                            <i aria-hidden="true" className="fa-solid fa-circle-exclamation mt-0.5"></i>
                            <span>{formError}</span>
                        </p>
                    )}
                </div>

                <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
                    {submitting ? 'Logging in…' : 'Log in'}
                </button>
            </form>
        </main>
    );
}
