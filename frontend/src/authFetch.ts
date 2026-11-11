const TOKEN_KEY = 'token';
export const UNAUTHORIZED_EVENT = 'pawpal:unauthorized';

export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    const token = getAuthToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
}

export async function authFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const response = await fetch(input, {
        ...init,
        headers: authHeaders(init.headers),
    });
    if (response.status === 401) {
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return response;
}
