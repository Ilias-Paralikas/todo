// Start-up: offline support, the page the address asks for, then Firebase and sign-in.
import { listen } from './events.js';
import { listenForListDrags } from './reorder.js';
import { route } from './router.js';
import { connect, store } from './store.js';
import { onUser } from './sync.js';
import { $, explain, show, toast } from './views/dom.js';
import { renderFields } from './views/fields.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline support unavailable:', err));
}
renderFields();   // before listen(), which listens to them
listen();
listenForListDrags();
route();
try {
  await connect(err => toast(explain(err)));
  store.onUser(onUser);
} catch (err) {
  $('#boot').textContent = explain(err);
  show('boot');
  console.error(err);
}
