// Test stand-in for the Firebase SDK (tests/test_app.py serves it instead of gstatic). Not used by the app.
export function initializeApp(config) { (globalThis.__fake ??= {}).config = config; return { config }; }
