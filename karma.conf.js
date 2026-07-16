// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const fs = require('fs');
const path = require('path');

// This machine has no system Chrome installed. Pick a browser for Karma and
// point CHROME_BIN at it (skipped if CHROME_BIN is already set, e.g. CI or a
// manual override), so `npm test` "just works" with no per-invocation prefix.
//
// Preference order:
//   1. Playwright's standalone Chromium if present — a real Chromium *test*
//      binary (isolated in the user cache, not a system browser). It launches
//      and, crucially, EXITS cleanly headless on Windows. Edge-as-Chrome does
//      not: it launches flakily and hangs on teardown for minutes.
//   2. Edge, as a Chromium-based fallback if no Playwright Chromium exists.
// On the Linux CI runner none of these paths exist, so this whole block is a
// no-op and the launcher finds the runner's real Chrome as before.
if (!process.env.CHROME_BIN) {
  let picked;

  // 1. Newest Playwright Chromium build, version-agnostic (survives updates).
  const pwRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  try {
    const builds = fs.readdirSync(pwRoot)
      .filter(d => d.startsWith('chromium-')) // excludes chromium_headless_shell-*
      .map(d => ({ d, n: parseInt(d.split('-')[1], 10) || 0 }))
      .sort((a, b) => b.n - a.n);
    for (const { d } of builds) {
      const exe = ['chrome-win64', 'chrome-win']
        .map(sub => path.join(pwRoot, d, sub, 'chrome.exe'))
        .find(p => fs.existsSync(p));
      if (exe) { picked = exe; break; }
    }
  } catch { /* ms-playwright absent (e.g. CI) — fall through to Edge */ }

  // 2. Edge fallback.
  if (!picked) {
    picked = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].find(p => fs.existsSync(p));
  }

  if (picked) process.env.CHROME_BIN = picked;
}

module.exports = function (config) {
  config.set({
    basePath: '',
    // Karma's fixed default port (9876) makes two concurrent local runs — two
    // agents, or a stale orphaned run still holding the socket — collide and
    // hang until the disconnect timeouts expire. Bind an OS-assigned free port
    // instead so concurrent runs never contend. CI runs a single instance, so
    // this is a no-op there.
    port: 0,
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/pokemon-roulette-enhanced'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    // Local Windows headless runs (Edge via CHROME_BIN, no real Chrome installed) were
    // reliably losing the browser partway through the suite — "ChromeHeadless failed 2
    // times (cannot start)" — with karma-chrome-launcher's defaults giving up almost
    // immediately (0-2s) after any hiccup. custom launcher below adds the standard
    // flags for headless-browser stability in constrained/sandboxed environments, plus
    // much more generous timeouts so a slow relaunch gets a real chance to succeed
    // instead of the whole run being abandoned.
    customLaunchers: {
      ChromeHeadlessStable: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-extensions',
        ]
      }
    },
    // Default to the stabilized headless launcher defined above (the flags are
    // what keep the browser from dropping mid-suite). CI overrides this with an
    // explicit --browsers=ChromeHeadless, so this default only governs local runs.
    browsers: ['ChromeHeadlessStable'],
    restartOnFileChange: true,
    browserDisconnectTimeout: 30000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: 60000,
    captureTimeout: 120000,
    retryLimit: 3,
  });
};
