#!/usr/bin/env node
// Minimal Puppeteer helper to capture Twitter/X web session cookies (auth_token, ct0)
// Usage:
//   npm run capture:twitter
// Env (optional):
//   CAPTURE_POST_URL=https://your.api.example.com/api/twitter/session
//   CAPTURE_BEARER=your-api-token
//   PROFILE_DIR=.data/puppeteer-twitter
//   LOGIN_URL=https://x.com/home

const path = require('path');
const fs = require('fs');

// Load .env.local into process.env for this script (no extra deps)
function loadDotEnvLocal() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim();
    const val = l.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnvLocal();

async function main() {
  // Defer require to allow repo usage without install until runtime
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('\nMissing dependency: puppeteer');
    console.error('Install it with: npm i -D puppeteer\n');
    process.exit(1);
  }

  const userDataDir = process.env.PROFILE_DIR || path.resolve('.data/puppeteer-twitter');
  const loginUrl = process.env.LOGIN_URL || 'https://x.com/home';
  const postUrl = process.env.CAPTURE_POST_URL || 'http://localhost:3000/api/twitter/session';
  const bearer = process.env.CAPTURE_BEARER || process.env.CAPTURE_INGEST_TOKEN || '';
  const timeoutMs = Number(process.env.CAPTURE_TIMEOUT_MS || 5 * 60_000); // 5 minutes

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false, // headful to allow manual login / 2FA
    defaultViewport: null,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);

  console.log('\nOpening Twitter/X… If prompted, please log in.');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  const start = Date.now();
  let authToken = null;
  let ct0 = null;
  let domainSource = null;

  async function readCookies() {
    const cookiesX = await page.cookies('https://x.com');
    const cookiesT = await page.cookies('https://twitter.com');
    const all = [...cookiesX, ...cookiesT];
    const auth = all.find(c => c.name === 'auth_token');
    const csrf = all.find(c => c.name === 'ct0');
    return { authToken: auth?.value || null, ct0: csrf?.value || null, domainSource: auth?.domain || csrf?.domain || null };
  }

  // Poll until we get auth_token (logged-in session)
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await readCookies();
      if (res.authToken) {
        authToken = res.authToken;
        ct0 = res.ct0; // may be null initially; we can keep trying a bit longer
        domainSource = res.domainSource;
        if (!ct0) {
          // Try to trigger ct0 by visiting an API-backed page
          try {
            await page.goto('https://x.com/messages', { waitUntil: 'domcontentloaded' });
            const again = await readCookies();
            ct0 = again.ct0 || ct0;
            domainSource = again.domainSource || domainSource;
          } catch {}
        }
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!authToken) {
    console.error('\nTimed out waiting for login (no auth_token found).');
    console.error('Please ensure you completed sign-in, then re-run.');
    await browser.close();
    process.exit(2);
  }

  const payload = {
    auth_token: authToken,
    ct0: ct0 || null,
    domainSource,
    capturedAt: new Date().toISOString(),
    profileDir: userDataDir,
  };

  console.log('\nCaptured tokens:');
  console.log({
    auth_token: `${authToken.slice(0, 6)}…${authToken.slice(-4)}`,
    ct0: ct0 ? `${ct0.slice(0, 6)}…${ct0.slice(-4)}` : null,
    domainSource,
    profileDir: userDataDir,
  });

  if (postUrl) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
      const r = await fetch(postUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      const text = await r.text();
      console.log(`\nPosted to ${postUrl}:`, r.ok ? 'OK' : `Failed (${r.status})`);
      if (r.ok) {
        try {
          const json = JSON.parse(text);
          if (json && json.id) {
            console.log('Saved session id:', json.id);
          } else {
            console.log('Response:', text);
          }
        } catch {
          console.log('Response:', text);
        }
      } else {
        console.error(text);
      }
    } catch (e) {
      console.error(`\nFailed to POST to ${postUrl}:`, e.message);
    }
  } else {
    console.log('\nNo CAPTURE_POST_URL set — printing full payload for convenience:\n');
    console.log(JSON.stringify(payload, null, 2));
  }

  console.log('\nYou can keep the browser open; the session is saved in:', userDataDir);
  console.log('Re-run later to refresh ct0 without re-login.');

  // Do not auto-close to avoid logging out flows/suspicious terminations
  // Uncomment to auto-close:
  // await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
