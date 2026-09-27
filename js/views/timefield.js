// The Time field (D53). It reads "Any time" until a time is picked: an item without a time is for sometime that
// day. Tapping it opens the browser's own time picker; the × next to a time goes back to any time.
export class TimeField {
  #input; #any; #clear;   // the time input, the "Any time" button, the × button

  constructor(input, any, clear) {
    this.#input = input;
    this.#any = any;
    this.#clear = clear;
    any.addEventListener('click', () => {
      this.#show(true);
      input.focus();
      try { input.showPicker(); } catch {}   // not every browser opens one on request
    });
    clear.addEventListener('click', () => {
      this.set('');
      any.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));   // the form hears it like a typed change
    });
    input.addEventListener('blur', () => { if (!input.value) this.#show(false); });   // left empty: any time
  }

  set(time) {   // show a time, or any time
    this.#input.value = time ?? '';
    this.#show(Boolean(time));
  }

  #show(timed) {
    this.#any.hidden = timed;
    this.#input.hidden = this.#clear.hidden = !timed;
  }
}
