import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSQ, parseCOPS, parseCREG, makeResponseCollector, runScript } from '../public/logic.js';
import { atFeed, createAtState, DemoPort } from '../public/demo.js';

test('parseCSQ: normal, unknown, garbage', () => {
  assert.deepEqual(parseCSQ('+CSQ: 23,0'), { rssi: 23, ber: 0, dbm: -67, percent: 74 });
  assert.equal(parseCSQ('+CSQ: 99,99').dbm, null);
  assert.equal(parseCSQ('hello'), null);
});

test('parseCOPS: operator with AcT, numeric-only, garbage', () => {
  assert.deepEqual(parseCOPS('+COPS: 0,0,"DEMO NET TH",7'), { mode: 0, operator: 'DEMO NET TH', act: 'LTE' });
  assert.deepEqual(parseCOPS('+COPS: 0'), { mode: 0, operator: null, act: null });
  assert.equal(parseCOPS('nope'), null);
});

test('parseCREG: home, roaming, CEREG variant', () => {
  assert.equal(parseCREG('+CREG: 0,1').text, 'registered (home)');
  assert.equal(parseCREG('+CREG: 0,5').text, 'registered (roaming)');
  assert.equal(parseCREG('+CEREG: 0,2').text, 'searching...');
});

test('responseCollector: resolves on OK, ERROR, +CME ERROR, timeout', async () => {
  const c = makeResponseCollector();
  let p = c.wait(1000);
  c.feed('\r\nATI stuff\r\nOK\r\n');
  assert.equal((await p).status, 'OK');
  p = c.wait(1000);
  c.feed('\r\nERROR\r\n');
  assert.equal((await p).status, 'ERROR');
  p = c.wait(1000);
  c.feed('\r\n+CME ERROR: SIM not inserted\r\n');
  assert.equal((await p).status, 'ERROR');
  p = c.wait(50); // nothing fed
  assert.equal((await p).status, 'TIMEOUT');
});

test('runScript: stops on error by default, skips comments/blank', async () => {
  const sent = [];
  const fake = async (cmd) => { sent.push(cmd); return { text: '', status: cmd === 'BAD' ? 'ERROR' : 'OK' }; };
  const r = await runScript(['AT', '', '# comment', 'BAD', 'AT+CSQ'], fake);
  assert.deepEqual(sent, ['AT', 'BAD']);
  assert.equal(r.length, 2);
  const r2 = await runScript(['AT', 'BAD', 'AT+CSQ'], fake, { continueOnError: true });
  assert.equal(r2.length, 3);
});

test('demo modem: echo, canned responses, unknown -> ERROR', () => {
  const s = createAtState();
  assert.match(atFeed('AT+CSQ\r', s), /\+CSQ: 23,0/);
  assert.match(atFeed('AT+NOPE\r', s), /ERROR/);
  atFeed('ATE0\r', s);
  assert.equal(atFeed('AT\r', s), '\r\nOK\r\n');
});

test('DemoPort end-to-end with script runner', async () => {
  const port = new DemoPort();
  await port.open();
  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();
  const dec = new TextDecoder();
  const { makeResponseCollector: mk } = await import('../public/logic.js');
  const col = mk();
  (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      col.feed(dec.decode(value));
    }
  })();
  const sendAndWait = async (cmd) => {
    const w = col.wait(1000);
    await writer.write(new TextEncoder().encode(cmd + '\r'));
    return w;
  };
  const results = await runScript(['AT', 'ATI', 'AT+CSQ', 'AT+COPS?'], sendAndWait);
  assert.equal(results.length, 4);
  assert.ok(results.every((r) => r.status === 'OK'));
  assert.match(results[3].text, /DEMO NET TH/);
  await port.close();
});
