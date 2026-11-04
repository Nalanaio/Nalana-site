import { googleEnabled } from '#lib/server/googleAuth.js';
import { reply } from '#lib/server/authSession.js';
export const GET = () => reply({ enabled: googleEnabled() });
