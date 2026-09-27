// Test stand-in for Firestore (tests/test_app.py serves it instead of gstatic). Same call shapes as the real SDK
// for the functions the app uses; data lives in localStorage so reloads keep it. Not used by the app.
const fake = (globalThis.__fake ??= {});
Object.assign(fake, { fromCache: localStorage.getItem('fakeOffline') === '1', pending: false,
                      denyReads: localStorage.getItem('denyReads') === '1', log: [] });
const db = () => JSON.parse(localStorage.getItem('fakeDB') || '{}');
const save = d => localStorage.setItem('fakeDB', JSON.stringify(d));
const listeners = new Set();
const emitAll = () => listeners.forEach(l => l());
fake.setOffline = (offline, pending = false) => { fake.fromCache = offline; fake.pending = pending; emitAll(); };
export const initializeFirestore = (app, opts) => { fake.firestoreOpts = opts; return { app }; };
export const persistentLocalCache = o => ({ kind: 'persistentLocalCache', ...o });
export const persistentMultipleTabManager = () => ({ kind: 'persistentMultipleTabManager' });
export const collection = (_db, ...segs) => ({ kind: 'collection', path: segs.join('/') });
const rid = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.random() * 62 | 0]).join('');
export function doc(parent, ...segs) {   // doc(collectionRef, id?) or doc(db, 'a', 'b', ...)
  if (parent.kind === 'collection') { const id = segs[0] ?? rid(); return { kind: 'doc', id, path: `${parent.path}/${id}` }; }
  return { kind: 'doc', id: segs.at(-1), path: segs.join('/') };
}
const change = (fn, what) => { const d = db(); const r = fn(d); save(d); fake.log.push(what); queueMicrotask(emitAll); return r; };
export const setDoc = (ref, data, opts) => change(d => {
  d[ref.path] = opts?.merge ? { ...d[ref.path], ...structuredClone(data) } : structuredClone(data);
  return Promise.resolve();
}, ['set', ref.id, opts?.merge ? 'merge' : 'replace']);
export const updateDoc = (ref, fields) => change(d => d[ref.path]
  ? (Object.assign(d[ref.path], structuredClone(fields)), Promise.resolve())
  : Promise.reject(Object.assign(new Error('nf'), { code: 'not-found' })), ['update', ref.id, fields]);
export const deleteDoc = ref => change(d => { delete d[ref.path]; return Promise.resolve(); }, ['delete', ref.id]);
export const writeBatch = () => { const ops = []; return {
  delete: ref => ops.push(d => delete d[ref.path]),
  set: (ref, data) => ops.push(d => { d[ref.path] = structuredClone(data); }),
  commit: () => change(d => { ops.forEach(op => op(d)); return Promise.resolve(); }, ['batch', ops.length]),
}; };
export function onSnapshot(ref, opts, next, error) {
  fake.snapshotOpts = opts;
  if (fake.denyReads) { setTimeout(() => error(Object.assign(new Error('denied'), { code: 'permission-denied' })), 5); return () => {}; }
  const metadata = () => ({ hasPendingWrites: fake.pending, fromCache: fake.fromCache });
  const emit = ref.kind === 'doc'
    ? () => { const data = db()[ref.path]; next({ exists: () => data !== undefined, data: () => structuredClone(data), metadata: metadata() }); }
    : () => {
      const depth = ref.path.split('/').length + 1;
      const docs = Object.entries(db()).filter(([p]) => p.startsWith(ref.path + '/') && p.split('/').length === depth)
        .map(([p, data]) => ({ id: p.split('/').pop(), data: () => structuredClone(data) }));
      next({ docs, metadata: metadata() });
    };
  listeners.add(emit); setTimeout(emit, 5);
  return () => listeners.delete(emit);
}
