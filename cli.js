#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync, readlinkSync } = require('node:fs');

function readProc(action, fallback) {
  try {
    return action();
  } catch (error) {
    if (['ENOENT', 'ESRCH', 'EACCES', 'EPERM'].includes(error.code)) return fallback;
    throw error;
  }
}

function findLinuxProcessIds(port) {
  const sockets = new Set();
  for (const table of ['tcp', 'tcp6', 'udp', 'udp6']) {
    const rows = readProc(() => readFileSync(`/proc/net/${table}`, 'utf8'), '');
    for (const row of rows.split('\n').slice(1)) {
      const [, localAddress, , state, , , , , , inode] = row.trim().split(/\s+/);
      if (Number.parseInt(localAddress?.split(':')[1], 16) !== port) continue;
      if (table.startsWith('tcp') && state !== '0A') continue;
      if (inode && inode !== '0') sockets.add(`socket:[${inode}]`);
    }
  }
  if (sockets.size === 0) return [];

  const processIds = [];
  for (const pid of readdirSync('/proc').filter(entry => /^\d+$/.test(entry))) {
    const directory = `/proc/${pid}/fd`;
    const descriptors = readProc(() => readdirSync(directory), []);
    if (descriptors.some(fd => sockets.has(readProc(() => readlinkSync(`${directory}/${fd}`))))) {
      processIds.push(Number(pid));
    }
  }
  if (processIds.length === 0) throw new Error(`Could not identify the owner of port ${port}.`);
  return processIds;
}

function findProcessIds(port) {
  if (process.platform === 'linux') return findLinuxProcessIds(port);
  const options = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 };

  if (process.platform === 'win32') {
    const output = execFileSync('netstat.exe', ['-ano'], options);
    const processIds = [];
    for (const line of output.split(/\r?\n/)) {
      const [protocol, localAddress, , stateOrPid, tcpPid] = line.trim().split(/\s+/);
      if (!localAddress?.endsWith(`:${port}`)) continue;
      if (protocol === 'UDP') processIds.push(Number(stateOrPid));
      if (protocol === 'TCP' && stateOrPid === 'LISTENING') {
        processIds.push(Number(tcpPid));
      }
    }
    return processIds;
  }

  const processIds = [];
  for (const filters of [[`-iTCP:${port}`, '-sTCP:LISTEN'], [`-iUDP:${port}`]]) {
    let output;
    try {
      output = execFileSync('lsof', ['-nP', '-Fpn', ...filters], options);
    } catch (error) {
      if (error.status === 1 && !error.stdout?.trim() && !error.stderr?.trim()) continue;
      if (error.code === 'ENOENT') throw new Error('lsof is required on this platform.');
      throw error;
    }
    let pid;
    for (const line of output.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      if (line.startsWith('n') && line.slice(1).split('->')[0].endsWith(`:${port}`)) {
        processIds.push(pid);
      }
    }
  }
  return processIds;
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: port-evict <port>');
    return;
  }

  const port = Number(args[0]);
  if (args.length !== 1 || !/^\d+$/.test(args[0]) || port < 1 || port > 65535) {
    console.error('Usage: port-evict <port> (an integer from 1 to 65535)');
    process.exitCode = 1;
    return;
  }

  const processIds = new Set(findProcessIds(port));
  if (processIds.size === 0) {
    console.log(`No matching processes found for port ${port}.`);
    return;
  }

  for (const pid of processIds) {
    if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid ||
        (process.platform === 'win32' && pid === 4)) {
      console.error(`Cannot stop PID ${pid} on port ${port}.`);
      process.exitCode = 1;
      continue;
    }
    try {
      process.kill(pid, 'SIGKILL');
      console.log(`Terminated PID ${pid} on port ${port}.`);
    } catch (error) {
      if (error.code === 'ESRCH') continue;
      console.error(`Could not stop PID ${pid} on port ${port}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
