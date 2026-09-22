/** Raw terminal sequences for feeding ink-testing-library's stdin. */
export const KEYS = {
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  home: '\x1b[H',
  end: '\x1b[F',
  pageUp: '\x1b[5~',
  pageDown: '\x1b[6~',
  tab: '\t',
  enter: '\r',
  escape: '\x1b',
  space: ' ',
  backspace: '\x7f',
  delete: '\x1b[3~',
  ctrl: (letter: string) => String.fromCharCode(letter.toLowerCase().charCodeAt(0) - 96),
};
