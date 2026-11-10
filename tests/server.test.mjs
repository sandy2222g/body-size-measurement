import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';

const PORT = 5190;
const FAKE_PORT = 5191;
const base = `http://127.0.0.1:${PORT}`;
let server;
let fake;
let lastBody;

const post = (path, body) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test.before(async () => {
  // Stand-in measurement service so the proxy path is tested without MediaPipe.
  fake = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      lastBody = JSON.parse(data);
      res.writeHead(lastBody.height === 999 ? 400 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lastBody.height === 999 ? { error: 'bad height' } : { measurements: { chest: 1 } }));
    });
  }).listen(FAKE_PORT);
  server = spawn(process.execPath, ['server.cjs'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:', MEASURE_SERVICE_URL: `http://127.0.0.1:${FAKE_PORT}` },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

test.after(async () => {
  server.kill();
  fake.close();
  await once(server, 'exit');
});

test('user + measurement round trip', async () => {
  const created = await (await post('/api/users', { name: 'A', email: 'a@x.com', height: 170 })).json();
  assert.ok(created.id);
  assert.equal((await post('/api/users', { name: 'B', email: 'a@x.com' })).status, 400);
  assert.equal((await post('/api/users', { name: 'B' })).status, 400);
  assert.equal((await fetch(base + '/api/users/9999')).status, 404);

  const m = { chest: 1, waist: 1, hips: 1, shoulder_width: 1, arm_length: 1, inseam: 1, recommended_size: 'M' };
  assert.equal((await post('/api/measurements', { user_id: created.id, measurements: m })).status, 200);
  assert.equal((await post('/api/measurements', { user_id: 9999, measurements: m })).status, 404);
  assert.equal((await post('/api/measurements', {})).status, 400);
  const rows = await (await fetch(`${base}/api/measurements/${created.id}`)).json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recommended_size, 'M');
});

test('/api/measure validates and proxies to the measurement service', async () => {
  assert.equal((await post('/api/measure', {})).status, 400);
  const ok = await post('/api/measure', { images: ['x'], height: 170 });
  assert.equal(ok.status, 200);
  assert.deepEqual(lastBody, { images: ['x'], height: 170 });
  const bad = await post('/api/measure', { images: ['x'], height: 999 });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'bad height');
});
