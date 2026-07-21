import { parseCSQ, parseCOPS, parseCREG, makeResponseCollector, runScript } from './logic.js';
import { CATALOG } from './catalog.js';
import { DemoPort } from './demo.js';

const $ = (id) => document.getElementById(id);
const supported = 'serial' in navigator;
if (!supported) $('unsupported').hidden = false;

const VER = window.AT_VERSION || 'dev';
$('titleText').textContent = `AT Command Tester [${VER}] - ClearEvo`;

// ---------- console ----------
const conEl = $('console');
function logText(text, cls) {
  if (!text) return;
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  conEl.appendChild(span);
  conEl.scrollTop = conEl.scrollHeight;
  parseIncoming(text);
}
$('btnClear').onclick = () => { conEl.textContent = ''; };

// ---------- parsed status panel ----------
const sigBars = $('sigBars');
sigBars.innerHTML = Array.from({ length: 10 }, (_, i) =>
  `<i style="height:${6 + i * 2.5}px"></i>`).join('');
function parseIncoming(text) {
  const csq = parseCSQ(text);
  if (csq) {
    $('sigText').textContent = csq.dbm == null
      ? `rssi=99 (unknown)` : `rssi=${csq.rssi} (${csq.dbm} dBm), ber=${csq.ber}`;
    const on = Math.round(csq.percent / 10);
    [...sigBars.children].forEach((b, i) => b.classList.toggle('on', i < on));
  }
  const cops = parseCOPS(text);
  if (cops && cops.operator) $('opText').textContent = `${cops.operator}${cops.act ? ' - ' + cops.act : ''}`;
  const reg = parseCREG(text);
  if (reg) $('regText').textContent = reg.text;
}

// ---------- connection ----------
let port = null, reader = null, writer = null, connected = false;
const collector = makeResponseCollector();
const encoder = new TextEncoder();

async function connectPort(p) {
  port = p;
  connected = true;
  writer = port.writable.getWriter();
  $('btnDisconnect').disabled = false;
  $('sbConn').textContent = port.isDemo ? 'Connected (DEMO SIMULATED)' : 'Connected';
  $('sbConn').classList.toggle('demo', !!port.isDemo);
  $('cmdInput').focus();
  readLoop();
}

async function readLoop() {
  const dec = new TextDecoder();
  try {
    reader = port.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = dec.decode(value, { stream: true });
      logText(text);
      collector.feed(text);
    }
  } catch (e) {
    if (connected) logText(`\n[read error: ${e.message}]\n`);
  } finally {
    try { reader && reader.releaseLock(); } catch {}
    reader = null;
    if (connected) disconnect();
  }
}

async function disconnect() {
  if (!connected) return;
  connected = false;
  try { reader && await reader.cancel(); } catch {}
  try { writer && writer.releaseLock(); } catch {}
  writer = null;
  try { port && await port.close(); } catch {}
  port = null;
  $('btnDisconnect').disabled = true;
  $('sbConn').textContent = 'Disconnected';
  $('sbConn').classList.remove('demo');
}

$('btnConnect').onclick = async () => {
  if (!supported) { alert('Web Serial is not available in this browser - use Chrome or Edge on desktop, or try the DEMO modem.'); return; }
  await disconnect();
  try {
    const p = await navigator.serial.requestPort();
    await p.open({ baudRate: +$('selBaud').value });
    connectPort(p);
  } catch (e) { if (e.name !== 'NotFoundError') logText(`[${e.message}]\n`); }
};
$('btnDisconnect').onclick = disconnect;
$('btnDemo').onclick = async () => {
  await disconnect();
  const p = new DemoPort();
  await p.open();
  connectPort(p);
};

// ---------- sending ----------
async function sendCmd(cmd) {
  if (!connected || !writer) { logText('[not connected - Connect or start the Demo first]\n'); return; }
  logText(cmd + '\n', 'sent');
  try { await writer.write(encoder.encode(cmd + '\r')); }
  catch (e) { logText(`[write error: ${e.message}]\n`); }
}

// send + wait for final result code (used by the script runner)
async function sendAndWait(cmd) {
  if (!connected || !writer) return { text: '', status: 'TIMEOUT' };
  const wait = collector.wait(cmd === 'AT+COPS=?' ? 90000 : 8000);
  logText(cmd + '\n', 'sent');
  await writer.write(encoder.encode(cmd + '\r'));
  return wait;
}

$('btnSend').onclick = () => { const v = $('cmdInput').value.trim(); if (v) { sendCmd(v); $('cmdInput').value = ''; } };
$('cmdInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnSend').onclick(); });

// ---------- catalog ----------
$('catalog').innerHTML = CATALOG.map((c, i) =>
  `<div class="cat-item" data-i="${i}"><code>${c.cmd}</code><small>${c.desc}</small></div>`).join('');
$('catalog').addEventListener('click', (e) => {
  const item = e.target.closest('.cat-item');
  if (item) sendCmd(CATALOG[+item.dataset.i].cmd);
});

// ---------- script runner ----------
$('btnRunScript').onclick = async () => {
  if (!connected) { logText('[not connected - Connect or start the Demo first]\n'); return; }
  $('btnRunScript').disabled = true;
  $('scriptStatus').textContent = 'running...';
  const cmds = $('scriptBox').value.split('\n');
  const results = await runScript(cmds, sendAndWait, { continueOnError: $('chkContinue').checked });
  const ok = results.filter((r) => r.status === 'OK').length;
  $('scriptStatus').textContent = `${ok}/${results.length} OK`;
  $('btnRunScript').disabled = false;
};
