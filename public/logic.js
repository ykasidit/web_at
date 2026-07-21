// Pure logic - no DOM, unit-tested in test/logic.test.js

// '+CSQ: 23,0' -> signal details. rssi 0..31 (99 = unknown), dBm = -113 + 2*rssi
export function parseCSQ(text) {
  const m = text.match(/\+CSQ:\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const rssi = +m[1], ber = +m[2];
  if (rssi === 99) return { rssi, ber, dbm: null, percent: 0 };
  return { rssi, ber, dbm: -113 + 2 * rssi, percent: Math.round((rssi / 31) * 100) };
}

const ACT = { 0: 'GSM', 1: 'GSM Compact', 2: 'UTRAN (3G)', 3: 'GSM+EDGE', 4: '3G HSDPA', 5: '3G HSUPA', 6: '3G HSPA', 7: 'LTE', 9: '5G NR' };
// '+COPS: 0,0,"DEMO NET TH",7' -> {mode, operator, act}
export function parseCOPS(text) {
  const m = text.match(/\+COPS:\s*(\d+)\s*(?:,\s*(\d+)\s*,\s*"([^"]*)"\s*(?:,\s*(\d+))?)?/);
  if (!m) return null;
  return { mode: +m[1], operator: m[3] ?? null, act: m[4] != null ? (ACT[+m[4]] ?? `AcT ${m[4]}`) : null };
}

const REG = { 0: 'not registered', 1: 'registered (home)', 2: 'searching...', 3: 'registration denied', 4: 'unknown', 5: 'registered (roaming)' };
// '+CREG: 0,1' (also CGREG/CEREG) -> status text
export function parseCREG(text) {
  const m = text.match(/\+C(?:G|E)?REG:\s*\d+\s*,\s*(\d+)/);
  return m ? { stat: +m[1], text: REG[+m[1]] ?? `stat ${m[1]}` } : null;
}

// Collect modem output until a final result code (OK/ERROR/...) or timeout.
export function makeResponseCollector() {
  const FINAL = /(^|\r\n)(OK|ERROR|NO CARRIER|BUSY|NO ANSWER|NO DIALTONE|\+CME ERROR:[^\r\n]*|\+CMS ERROR:[^\r\n]*)\r?\n?$/;
  let buf = '';
  let resolveFn = null;
  const check = () => {
    const m = buf.match(FINAL);
    if (m && resolveFn) {
      const r = resolveFn;
      resolveFn = null;
      r({ text: buf, status: m[2].startsWith('+C') ? 'ERROR' : m[2] });
    }
  };
  return {
    feed(text) { buf += text; check(); },
    wait(timeoutMs = 5000) {
      buf = '';
      return new Promise((resolve) => {
        resolveFn = resolve;
        setTimeout(() => {
          if (resolveFn) { resolveFn = null; resolve({ text: buf, status: 'TIMEOUT' }); }
        }, timeoutMs);
        check();
      });
    },
  };
}

// Run commands sequentially; sendAndWait(cmd) -> {text, status}. Stops on ERROR/TIMEOUT
// unless continueOnError. Returns per-command results.
export async function runScript(commands, sendAndWait, { continueOnError = false } = {}) {
  const results = [];
  for (const raw of commands) {
    const cmd = raw.trim();
    if (!cmd || cmd.startsWith('#')) continue;
    const r = await sendAndWait(cmd);
    results.push({ cmd, ...r });
    if (!continueOnError && (r.status === 'ERROR' || r.status === 'TIMEOUT')) break;
  }
  return results;
}
