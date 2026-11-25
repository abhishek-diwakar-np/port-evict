'use strict';

function releaseVersion(base, run) {
  const parts = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(base);
  if (!parts || !/^[1-9]\d*$/.test(run)) {
    throw new Error('Expected a stable package version and a positive GitHub Actions run number.');
  }
  const [, major, minor, patch] = parts;
  const nextPatch = Number(patch) + Number(run);
  if (![Number(major), Number(minor), nextPatch].every(Number.isSafeInteger)) {
    throw new Error('Release version exceeds the supported integer range.');
  }
  return `${major}.${minor}.${nextPatch}`;
}

if (require.main === module) {
  console.log(releaseVersion(require('../package.json').version, process.env.GITHUB_RUN_NUMBER));
}

module.exports = { releaseVersion };
