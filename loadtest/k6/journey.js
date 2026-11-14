// The same journey as load.js, stress.js and spike.js, with the profile chosen by -e PROFILE=...
// run.ps1 uses this file (k6 in Docker, PROFILE=load|stress|spike); the flow lives in flow.js.
import { journey, profileOptions, warmUp } from './flow.js';

export const options = profileOptions(__ENV.PROFILE || 'load');

export function setup() {
    warmUp();
}

export default function () {
    journey();
}
