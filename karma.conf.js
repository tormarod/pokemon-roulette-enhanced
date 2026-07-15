// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
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
    browsers: ['Chrome'],
    restartOnFileChange: true,
    browserDisconnectTimeout: 30000,
    browserDisconnectTolerance: 3,
    browserNoActivityTimeout: 60000,
    captureTimeout: 120000,
    retryLimit: 3,
  });
};
