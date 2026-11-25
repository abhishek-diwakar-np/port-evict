'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { scripts } = require('../package.json');
const { releaseVersion } = require('../scripts/ci-version');

test('CI adds the workflow run number to the base patch version', () => {
  assert.equal(releaseVersion('1.0.0', '1'), '1.0.1');
  assert.equal(releaseVersion('1.2.3', '12'), '1.2.15');
  assert.equal(releaseVersion('1.2.3', '13'), '1.2.16');
  assert.equal(releaseVersion('1.2.3', '12'), '1.2.15');
});

test('CI rejects invalid release version inputs', () => {
  assert.throws(() => releaseVersion('1.2.3-beta.1', '1'), /stable package version/);
  assert.throws(() => releaseVersion('1.2.3', undefined), /positive GitHub Actions run number/);
  assert.throws(() => releaseVersion('1.2.3', '0'), /positive GitHub Actions run number/);
  assert.throws(() => releaseVersion('1.2.3', '9007199254740992'), /integer range/);
});

test('release commands update the manifest and lockfile', t => {
  const directory = mkdtempSync(join(tmpdir(), 'port-evict-version-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const manifestPath = join(directory, 'package.json');
  const lockPath = join(directory, 'package-lock.json');
  const manifest = { name: 'port-evict-test', version: '1.2.3', scripts };
  const lock = {
    name: manifest.name,
    version: manifest.version,
    lockfileVersion: 3,
    packages: { '': { name: manifest.name, version: manifest.version } }
  };

  for (const [kind, expected] of Object.entries({
    patch: '1.2.4',
    minor: '1.3.0',
    major: '2.0.0'
  })) {
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(lockPath, JSON.stringify(lock));
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', `version:${kind}`], {
      cwd: directory,
      stdio: 'inherit'
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(readFileSync(manifestPath, 'utf8')).version, expected);
    const updatedLock = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(updatedLock.version, expected);
    assert.equal(updatedLock.packages[''].version, expected);
  }
});
