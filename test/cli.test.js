'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const test = require('node:test');

test('CLI rejects invalid input and accepts the help flag', () => {
  const cli = join(__dirname, '..', 'cli.js');
  for (const args of [[], ['0'], ['65536'], ['-1'], ['1.5'], ['1e3'], ['80', '81']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
    assert.ifError(result.error);
    assert.equal(result.status, 1, JSON.stringify(args));
  }
  const result = spawnSync(process.execPath, [cli, '--help'], { stdio: 'inherit' });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
});
