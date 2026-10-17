// Exercise the actual production client bundles. No production configuration or
// deployment is involved: Playwright supplies loopback-only synthetic settings.
import { spawn } from 'node:child_process';

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
    const stop = () => child.kill();
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    child.once('error', reject);
    child.once('exit', code => {
      process.removeListener('SIGTERM', stop);
      process.removeListener('SIGINT', stop);
      if (code === 0) resolve(); else reject(new Error(`Local browser server exited ${code}`));
    });
  });
}

await run(['node_modules/vite/bin/vite.js', 'build']);
await run(['--import', './tests/integration/local-outbound-guard.mjs',
  'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5197', '--strictPort']);
