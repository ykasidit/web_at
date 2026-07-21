// DEMO simulated AT modem - NOT a real device. Same fake-SerialPort pattern as the
// other clearevo web tools. Unit-tested in test/logic.test.js.

export function createAtState() {
  return { echo: true, buf: '' };
}

const R = {
  'AT': '',
  'ATI': 'ClearEvo DEMO Modem (simulated - not a real device)\r\nRevision: DEMO-1.0',
  'AT+CGMI': 'ClearEvo (simulated)',
  'AT+CGMM': 'AT-DEMO-4G',
  'AT+CGMR': 'DEMO-1.0',
  'AT+CGSN': '358000000000000',
  'AT+CIMI': '520000000000000',
  'AT+CCID': '+CCID: 8966000000000000000',
  'AT+ICCID': '+ICCID: 8966000000000000000',
  'AT+CPIN?': '+CPIN: READY',
  'AT+CSQ': '+CSQ: 23,0',
  'AT+CREG?': '+CREG: 0,1',
  'AT+CGREG?': '+CGREG: 0,1',
  'AT+CEREG?': '+CEREG: 0,1',
  'AT+COPS?': '+COPS: 0,0,"DEMO NET TH",7',
  'AT+COPS=?': '+COPS: (2,"DEMO NET TH","DEMO","52000",7),(1,"OTHER NET","OTHER","52001",2),,(0,1,2,3,4),(0,1,2)',
  'AT+CBC': '+CBC: 0,85,3900',
  'AT+CGDCONT?': '+CGDCONT: 1,"IP","internet","0.0.0.0",0,0',
  'AT+CMGF=1': '',
  'ATH': '',
};

export function atRespond(line, state) {
  const cmd = line.trim().toUpperCase();
  if (cmd === '') return '';
  if (cmd === 'ATE0') { state.echo = false; return '\r\nOK\r\n'; }
  if (cmd === 'ATE1') { state.echo = true; return '\r\nOK\r\n'; }
  if (cmd.startsWith('ATD')) return '\r\nNO CARRIER\r\n';
  if (cmd in R) {
    const body = R[cmd];
    return body ? `\r\n${body}\r\n\r\nOK\r\n` : '\r\nOK\r\n';
  }
  return '\r\nERROR\r\n';
}

export function atFeed(text, state) {
  let out = '';
  for (const ch of text) {
    if (state.echo) out += ch;
    if (ch === '\r') {
      out += atRespond(state.buf, state);
      state.buf = '';
    } else if (ch === '\b' || ch === '\x7f') {
      state.buf = state.buf.slice(0, -1);
    } else if (ch !== '\n') {
      state.buf += ch;
    }
  }
  return out;
}

export const DEMO_BANNER =
  '*** DEMO MODE - simulated AT modem, NOT a real device ***\r\n' +
  'All responses are canned. Try the commands on the left.\r\n\r\nOK\r\n';

export class DemoPort {
  constructor() {
    this.isDemo = true;
    this.label = 'DEMO: simulated AT modem';
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const state = createAtState();
    let ctrl = null;
    const enqueue = (text) => { try { ctrl.enqueue(enc.encode(text)); } catch {} };
    this.readable = new ReadableStream({ start(c) { ctrl = c; } });
    this.writable = new WritableStream({
      write(chunk) { enqueue(atFeed(dec.decode(chunk), state)); },
    });
    this.open = async () => { enqueue(DEMO_BANNER); };
    this.close = async () => { try { ctrl.close(); } catch {} };
  }
}
