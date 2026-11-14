// Load: ramp to 50 users, hold 2 min. Pass: map p95 < 2 s and errors < 1% (NFR 2).
//   k6 run loadtest/k6/load.js
import { journey, profileOptions, warmUp } from './flow.js';

export const options = profileOptions('load');

export function setup() {
    warmUp();
}

export default function () {
    journey();
}
