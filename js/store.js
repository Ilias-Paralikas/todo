// The only code that talks to Firebase. To change backend, rewrite this file and keep the methods of `store`.
import { SDK } from './config.js';

// Filled in by connect(): onUser, signIn, signOut, watch, add, patch, patchMany, remove, removeMany, putMany, saveSettings.
export const store = {};

const appError = code => Object.assign(new Error(code), { code });
const load = (url, code) => import(url).catch(() => { throw appError(code); });

export async function connect(onError) {
  const { FIREBASE_CONFIG: config } = await load('../firebase-config.js', 'app/config-missing');
  if (!config?.apiKey || config.apiKey.startsWith('PASTE')) throw appError('app/config-empty');
  const [{ initializeApp }, A, F] = await Promise.all(
    ['app', 'auth', 'firestore'].map(name => load(`${SDK}/firebase-${name}.js`, 'app/sdk-offline')));

  const app = initializeApp(config);
  const auth = A.getAuth(app);
  const db = F.initializeFirestore(app, {   // on-device copy: reads work offline, writes queue (D16)
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  let tasks = null, settings = null;   // users/{uid}/tasks and users/{uid}/settings/app (D6)
  const ref = id => F.doc(tasks, id);
  const write = promise => { promise.catch(onError); };   // never awaited (D14)
  const inBatches = (items, add) => {   // a Firestore batch holds at most 500 writes
    for (let i = 0; i < items.length; i += 400) {
      const batch = F.writeBatch(db);
      items.slice(i, i + 400).forEach(item => add(batch, item));
      write(batch.commit());
    }
  };

  Object.assign(store, {
    onUser: callback => A.onAuthStateChanged(auth, user => {
      tasks = user && F.collection(db, 'users', user.uid, 'tasks');
      settings = user && F.doc(db, 'users', user.uid, 'settings', 'app');
      callback(user);
    }),
    signIn: (email, password) => A.signInWithEmailAndPassword(auth, email, password),
    signOut: () => A.signOut(auth),
    watch: (onTasks, onSettings, onFail) => {
      const options = { includeMetadataChanges: true };
      const stops = [
        F.onSnapshot(tasks, options, snap => onTasks(snap.docs.map(d => ({ ...d.data(), id: d.id })), snap.metadata), onFail),
        F.onSnapshot(settings, options, snap => onSettings(snap.exists() ? snap.data() : null, snap.metadata), onFail),
      ];
      return () => stops.forEach(stop => stop());
    },
    add: task => write(F.setDoc(F.doc(tasks), task)),
    patch: (id, fields) => write(F.updateDoc(ref(id), fields)),
    patchMany: items => inBatches(items, (batch, { id, ...fields }) => batch.update(ref(id), fields)),
    remove: id => write(F.deleteDoc(ref(id))),
    removeMany: ids => inBatches(ids, (batch, id) => batch.delete(ref(id))),
    putMany: items => inBatches(items, (batch, { id, ...task }) => batch.set(ref(id), task)),
    saveSettings: fields => write(F.setDoc(settings, fields, { merge: true })),
  });
}
