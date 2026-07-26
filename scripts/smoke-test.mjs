/**
 * Smoke test: serves the production build and loads it in a real browser.
 *
 * The unit suite mocks HttpClient and never bootstraps the app, so it cannot
 * see a failure that only exists in the built artifact. Release 4.0.1 shipped
 * a malformed locale file: `ng build` copied it through as a static asset, all
 * 957 specs passed, the deploy went green, and the live site rendered a blank
 * white page because the translation load blocks the first render.
 *
 * This checks the things only a browser can: the bundle boots, the router
 * renders every route, assets resolve under the deployed base href, and no
 * uncaught error or untranslated key reaches the page.
 *
 * Usage: node scripts/smoke-test.mjs [--base-href=/] [--dist=<dir>]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  })
);

const DIST = resolve(args.get('dist') || 'dist/pokemon-roulette-enhanced/browser');
// Matches `ng deploy --base-href=...`: serving under the deployed prefix is how
// an asset path that only breaks on GitHub Pages gets caught here instead.
const BASE_HREF = (args.get('base-href') || '/').replace(/\/*$/, '/');
const ROUTES = ['', 'credits', 'coffee', 'stats', 'settings', 'no-such-page'];

const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build found at ${DIST}. Run \`ng build\` first.`);
  process.exit(1);
}

/** Static server with an SPA fallback, so deep links hit the Angular router. */
function startServer() {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = path.startsWith(BASE_HREF) ? path.slice(BASE_HREF.length) : path.slice(1);
    const candidate = join(DIST, normalize('/' + relative));

    let file = candidate;
    if (!candidate.startsWith(DIST) || !existsSync(candidate) || !extname(candidate)) {
      file = join(DIST, 'index.html');
    }

    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(file)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(500).end();
    }
  });

  return new Promise(resolvePort => {
    server.listen(0, '127.0.0.1', () => resolvePort({ server, port: server.address().port }));
  });
}

/**
 * Every top-level i18n key, used to spot an untranslated `settings.theme.dark`
 * left on screen. Without this the app-initializer's error handler would let a
 * broken locale file render raw keys instead of blanking — quieter, but still
 * broken, and still worth failing the build over.
 */
async function untranslatedKeyPattern() {
  const en = JSON.parse(await readFile(join(DIST, 'assets/i18n/en.json'), 'utf8'));
  return new RegExp(`\\b(${Object.keys(en).join('|')})(\\.[A-Za-z0-9_]+)+\\b`, 'g');
}

const { server, port } = await startServer();
const origin = `http://127.0.0.1:${port}`;
const failures = [];

// A locale file too broken to parse is a failure in its own right, but don't
// stop here — the browser checks below show what it does to the actual page.
let keyPattern = null;
try {
  keyPattern = await untranslatedKeyPattern();
} catch (error) {
  failures.push(`assets/i18n/en.json\n    - not valid JSON: ${error.message}`);
  console.log('FAIL  assets/i18n/en.json is not valid JSON');
}

const browser = await chromium.launch({
  // Same convention karma.conf.js uses: fall back to whatever Chromium is
  // already on the machine when Playwright's own download isn't available.
  executablePath: process.env['CHROME_BIN'] || undefined,
  // Chromium's sandbox can't start as root, which is how it runs in containers.
  chromiumSandbox: process.getuid?.() !== 0,
});

try {
  for (const route of ROUTES) {
    const url = `${origin}${BASE_HREF}${route}`;
    const page = await browser.newPage();
    const problems = [];

    // Stub every third-party request (analytics, sprite artwork) rather than
    // letting the network decide whether CI is green today.
    await page.route('**/*', async routeRequest => {
      if (routeRequest.request().url().startsWith(origin)) {
        return routeRequest.continue();
      }
      const isImage = routeRequest.request().resourceType() === 'image';
      return routeRequest.fulfill({
        status: 200,
        contentType: isImage ? 'image/png' : 'text/javascript',
        body: isImage
          ? Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              'base64'
            )
          : '',
      });
    });

    page.on('pageerror', error => problems.push(`uncaught error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') {
        problems.push(`console error: ${message.text()}`);
      }
    });
    page.on('response', response => {
      if (response.url().startsWith(origin) && response.status() >= 400) {
        problems.push(`HTTP ${response.status()} for ${response.url()}`);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    if (text.length < 20) {
      problems.push(`rendered nothing (body text: ${JSON.stringify(text)})`);
    }

    const untranslated = keyPattern ? [...new Set(text.match(keyPattern) ?? [])] : [];
    if (untranslated.length) {
      problems.push(`untranslated i18n keys on screen: ${untranslated.slice(0, 5).join(', ')}`);
    }

    await page.close();

    const label = `${BASE_HREF}${route}`;
    if (problems.length) {
      failures.push(`${label}\n    - ${problems.join('\n    - ')}`);
      console.log(`FAIL  ${label}`);
    } else {
      console.log(`ok    ${label}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n\n  ${failures.join('\n\n  ')}\n`);
  process.exit(1);
}

console.log(`\nAll ${ROUTES.length} routes loaded cleanly from ${DIST} at ${BASE_HREF}`);
