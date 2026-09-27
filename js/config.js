// Fixed settings. Lists are data, not code: add, rename, recolor, reorder or delete them in the app with
// the + after the lists (D9). These are only the lists created at the very first sign-in (D10).
export const DEFAULT_LISTS = [
  { id: 'work',    name: 'Work',    color: '#3559a8' },
  { id: 'hobbies', name: 'Hobbies', color: '#a0458a' },
  { id: 'gym',     name: 'Gym',     color: '#23876a' },
  { id: 'buy',     name: 'To buy',  color: '#c27414' },
];
export const PALETTE = ['#3559a8', '#a0458a', '#23876a', '#c27414', '#6a55c8', '#b5473a', '#2a7d9a', '#6f7f24',   // list colors,
                        '#d0604a', '#c2417a', '#8e44ad', '#3b7dd8', '#4f9a2e', '#b08a14', '#8a5a3c', '#5b6b7f'];  // picked from a grid (D9, D35)
export const SHOPPING_LIST = 'buy';   // the To buy list: typing a price ticks it (D33)
export const PRIOS = [{ id: 1, label: 'High', color: '#b5473a' }, { id: 2, label: 'Normal', color: '#3b7dd8' },   // fixed levels (D12);
                      { id: 3, label: 'Low', color: '#b08a14' }];   // default colors, changeable in the app (D39)
export const DEFAULT_PRIO = 2;
export const DONE_TTL_DAYS = 30;                                  // completed items are deleted after this (D13)
export const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';  // Firebase JS SDK, pinned (D2)
