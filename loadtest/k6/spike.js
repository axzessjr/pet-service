// Spike: 10 -> 300 users in 10 s, hold 1 min, drop back to 10 and watch recovery.
//   k6 run loadtest/k6/spike.js
import { journey, profileOptions, warmUp } from './flow.js';

export const options = profileOptions('spike');

export function setup() {
    warmUp();
}

export default function () {
    journey();
}
