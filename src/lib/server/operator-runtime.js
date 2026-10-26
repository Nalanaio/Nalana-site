import * as env from '$app/env/private';
import { createOperatorService } from './operator-auth.js';

// Module lifetime is intentional: the supplemental login limiter survives individual requests.
export const operatorService = createOperatorService(env);
