// Test stand-in for the Firebase SDK (tests/test_app.py serves it instead of gstatic). Not used by the app.
const fake = (globalThis.__fake ??= {});
const listeners = new Set();
const current = () => JSON.parse(localStorage.getItem('fakeUser') || 'null');
const set = user => { localStorage.setItem('fakeUser', JSON.stringify(user)); listeners.forEach(cb => cb(user)); };
export const getAuth = app => ({ app });
export function onAuthStateChanged(auth, cb) { listeners.add(cb); setTimeout(() => cb(current()), 5); return () => listeners.delete(cb); }
export async function signInWithEmailAndPassword(auth, email, password) {
  await new Promise(r => setTimeout(r, 30));
  if (email !== 'me@example.com' || password !== 'correct horse') throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
  const user = { uid: 'UID123', email }; set(user); return { user };
}
export async function signOut() { set(null); }
