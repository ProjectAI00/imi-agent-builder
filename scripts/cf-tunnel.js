#!/usr/bin/env node
// Starts a Cloudflare tunnel to the local Next.js dev server (port 3000)
// and sets Convex ORCHESTRATOR_URL to the public URL using a clean env-file.

const { spawn, execSync } = require('child_process');

function setConvexEnv(url) {
  try {
    execSync(`npx convex env set ORCHESTRATOR_URL ${url}`, { stdio: 'inherit' });
    console.log('[tunnel] Set Convex ORCHESTRATOR_URL to', url);
  } catch (e) {
    console.error('[tunnel] Failed to set Convex env:', e.message);
    console.error('[tunnel] Run manually: npx convex env set ORCHESTRATOR_URL', url);
  }
}

(async () => {
  const port = Number(process.env.PORT || 3000);

  // Check cloudflared availability
  let cfCmd = 'cloudflared';
  try {
    execSync(`${cfCmd} --version`, { stdio: 'ignore' });
  } catch {
    console.error('[tunnel] cloudflared not found. Install with:');
    console.error('  brew install cloudflare/cloudflare/cloudflared');
    console.error('Then run: npm run tunnel:cf');
    process.exit(1);
  }

  // Start the tunnel
  const args = ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'];
  console.log('[tunnel] Starting Cloudflare tunnel on port', port, '...');
  const child = spawn(cfCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let urlPrinted = false;
  function handleData(buf) {
    const text = buf.toString();
    const match = text.match(/https:\/\/[-a-z0-9_.]+\.(?:trycloudflare\.com|cfargotunnel\.com)/i);
    if (match && !urlPrinted) {
      urlPrinted = true;
      const url = match[0];
      setConvexEnv(url);
      console.log('\nCloudflare tunnel running at', url);
      console.log('Press Ctrl+C to stop.');
    }
  }

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);
  child.on('exit', (code) => {
    console.error('[tunnel] cloudflared exited with code', code);
    process.exit(code || 1);
  });
})();

