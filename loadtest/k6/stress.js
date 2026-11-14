// Stress: 50 -> 100 -> 200 -> 400 users, one minute each, to find the knee.
//   k6 run loadtest/k6/stress.js
import { journey, profileOptions, warmUp } from './flow.js';

export const options = profileOptions('stress');

export function setup() {
    warmUp();
}

export default function () {
    journey();
}
