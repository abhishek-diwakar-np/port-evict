'use strict';

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { join } = require('node:path');
const test = require('node:test');

const cli = join(__dirname, '..', 'cli.js');
const listeners = {
  TCP: "const server = require('node:net').createServer(); server.listen(0, '127.0.0.1', () => process.send(server.address().port));",
  UDP: "const socket = require('node:dgram').createSocket('udp4'); socket.bind(0, '127.0.0.1', () => process.send(socket.address().port));"
};

for (const [protocol, source] of Object.entries(listeners)) {
  test(`CLI terminates a ${protocol} socket owner`, { timeout: 15000 }, async t => {
    const listener = spawn(process.execPath, ['-e', source], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    t.after(() => {
      if (listener.pid && listener.exitCode === null && listener.signalCode === null) listener.kill();
    });
    const exited = once(listener, 'exit');
    const [port] = await Promise.race([
      once(listener, 'message'),
      exited.then(() => { throw new Error('Listener exited before binding'); })
    ]);

    const result = spawnSync(process.execPath, [cli, String(port)], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`Terminated PID ${listener.pid} on port ${port}\\.`));
    await exited;
  });
}
