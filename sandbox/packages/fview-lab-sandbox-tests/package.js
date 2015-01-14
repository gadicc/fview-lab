Package.describe({
  name: 'fview-lab-sandbox-tests',
  summary: 'Tests for the sandbox',
  version: '1.0.0'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0.2.1');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('fview-lab-sandbox-tests');
  api.addFiles('tests.js');
});
