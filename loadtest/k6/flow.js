// The pet owner journey shared by load.js, stress.js, spike.js and journey.js (slide 16).
// Each virtual user logs in once, as a real user keeps a 7-day token, then repeats:
//   GET /catalog?q=groom -> GET /pet-profile/me -> GET /recommendation/pets/:id/map -> 1 s think time.
// Read-only apart from login, so it leaves nothing behind in the shared databases.
// The account comes from K6_USERNAME and K6_PASSWORD (loadtest/secrets.env, git-ignored).
import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 on this machine reaches the frontend on localhost:8080; k6 in Docker passes
// BASE_URL=http://host.docker.internal:8080 (run.ps1 does).
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const USERNAME = __ENV.K6_USERNAME;
const PASSWORD = __ENV.K6_PASSWORD;
const THINK_SECONDS = 1;

// Load, stress and spike as described on slide 16.
export const STAGES = {
    // Ramp to 50 users, hold 2 min.
    load: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '10s', target: 0 },
    ],
    // 50 -> 100 -> 200 -> 400 users, one minute each, to find the knee.
    stress: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 400 },
        { duration: '30s', target: 400 },
        { duration: '10s', target: 0 },
    ],
    // 10 -> 300 users in 10 s, hold 1 min, drop back to 10 and watch recovery.
    spike: [
        { duration: '30s', target: 10 },
        { duration: '10s', target: 300 },
        { duration: '1m', target: 300 },
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '5s', target: 0 },
    ],
};

// Views around Chulalongkorn University at the page's default zoom, as if the user pans.
const VIEWPORTS = [
    'minLat=13.720&minLng=100.510&maxLat=13.750&maxLng=100.550',
    'minLat=13.730&minLng=100.520&maxLat=13.760&maxLng=100.560',
    'minLat=13.710&minLng=100.500&maxLat=13.740&maxLng=100.540',
];

const ROUTES = ['login', 'catalog', 'pet_profile', 'map'];

function thresholds() {
    const t = {
        // NFR 2: recommendations appear within 2 seconds.
        'http_req_duration{name:map}': ['p(95)<2000'],
        http_req_failed: ['rate<0.01'],
    };
    // Listed only so the summary reports each route on its own.
    for (const route of ROUTES) {
        if (!t[`http_req_duration{name:${route}}`]) {
            t[`http_req_duration{name:${route}}`] = ['p(95)>=0'];
        }
        t[`http_reqs{name:${route}}`] = ['count>=0'];
        t[`http_req_failed{name:${route}}`] = ['rate>=0'];
    }
    for (const status of ['200', '401', '429', '500', '502', '503', '504', '0']) {
        t[`http_reqs{status:${status}}`] = ['count>=0'];
    }
    return t;
}

// k6 options for one profile: 'load', 'stress' or 'spike'.
export function profileOptions(profile) {
    if (!STAGES[profile]) {
        throw new Error(`profile must be one of ${Object.keys(STAGES).join(', ')}`);
    }
    return {
        scenarios: {
            [profile]: {
                executor: 'ramping-vus',
                startVUs: 0,
                stages: STAGES[profile],
                gracefulRampDown: '5s',
            },
        },
        thresholds: thresholds(),
        summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    };
}

function login() {
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ username: USERNAME, password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
    );
    check(res, { 'login 200 or 201': (r) => r.status === 200 || r.status === 201 });
    return res.status === 200 || res.status === 201 ? res.json('access_token') : null;
}

// Checks the account once and warms the gateway's database and gRPC connections,
// so the first seconds do not measure a cold start. Requests here are tagged
// name=setup and are not part of any route's numbers.
export function warmUp() {
    if (!USERNAME || !PASSWORD) {
        throw new Error('Set K6_USERNAME and K6_PASSWORD (loadtest/secrets.env)');
    }
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ username: USERNAME, password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'setup' } },
    );
    if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Login failed with HTTP ${res.status} at ${BASE_URL}; check loadtest/secrets.env`);
    }
    const auth = { headers: { Authorization: `Bearer ${res.json('access_token')}` }, tags: { name: 'setup' } };
    const pets = http.get(`${BASE_URL}/api/pet-profile/me`, auth).json();
    if (!Array.isArray(pets) || pets.length === 0) {
        throw new Error('The k6 account has no pets, so there is no map to load');
    }
    for (let i = 0; i < 5; i++) {
        http.get(`${BASE_URL}/api/catalog?q=groom`, { tags: { name: 'setup' } });
        for (const pet of pets) {
            http.get(`${BASE_URL}/api/recommendation/pets/${pet.id}/map?${VIEWPORTS[0]}&zoom=15&includeUnmatched=true`, auth);
        }
    }
}

// Module scope is per virtual user, so each one logs in once and keeps its token.
let token = null;

// One pass of the journey for one virtual user.
export function journey() {
    if (!token) {
        token = login();
        if (!token) {
            sleep(THINK_SECONDS);
            return;
        }
    }
    const auth = { Authorization: `Bearer ${token}` };

    const catalog = http.get(`${BASE_URL}/api/catalog?q=groom`, { tags: { name: 'catalog' } });
    check(catalog, { 'catalog 200': (r) => r.status === 200 });

    const profile = http.get(`${BASE_URL}/api/pet-profile/me`, { headers: auth, tags: { name: 'pet_profile' } });
    check(profile, { 'pet-profile 200': (r) => r.status === 200 });
    const pets = profile.status === 200 ? profile.json() : [];

    if (Array.isArray(pets) && pets.length > 0) {
        const pet = pets[Math.floor(Math.random() * pets.length)];
        const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
        const map = http.get(
            `${BASE_URL}/api/recommendation/pets/${pet.id}/map?${viewport}&zoom=15&includeUnmatched=true`,
            { headers: auth, tags: { name: 'map' } },
        );
        check(map, { 'map 200': (r) => r.status === 200 });
    }

    sleep(THINK_SECONDS);
}
