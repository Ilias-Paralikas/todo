// Small helpers for the page: finding elements, switching screens, messages.
export const $ = selector => document.querySelector(selector);

export function show(screen) {   // 'boot', 'login' or 'main'
  for (const id of ['boot', 'login', 'main']) $(`#${id}`).hidden = id !== screen;
}

let toastTimer;
export function toast(message) {
  Object.assign($('#toast'), { textContent: message, hidden: false });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6000);
}

const MESSAGES = {
  'app/config-missing': "Couldn't load firebase-config.js. Check that it's uploaded next to index.html.",
  'app/config-empty': 'Add your Firebase settings to firebase-config.js (README, step 2).',
  'app/sdk-offline': "Couldn't load Firebase. Open the app once while online so this device keeps a copy.",
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No connection. Signing in needs the internet.',
  'permission-denied': 'The database refused access. Check that firestore.rules is published with your UID (README, step 5).',
  'not-found': 'That task no longer exists. It was probably deleted on another device.',
};
export const explain = err => MESSAGES[err?.code] ?? `Something went wrong (${err?.code || err?.message || err}).`;
