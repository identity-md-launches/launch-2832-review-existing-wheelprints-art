'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'preservation/manifest.json'), 'utf8'));
const known = new Set(manifest.files.map(f => f.path));
const errors = [];
for (const file of manifest.files) {
  const target = path.join(root, file.path);
  try {
    assert.ok(!path.isAbsolute(file.path) && !file.path.split('/').includes('..'));
    assert.ok(fs.lstatSync(target).isFile() && !fs.lstatSync(target).isSymbolicLink());
    const bytes = fs.readFileSync(target);
    assert.equal(bytes.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
  } catch { errors.push(file.path); }
}
function inspect(relative) {
  for (const item of fs.readdirSync(path.join(root, relative), {withFileTypes: true})) {
    const name = relative + '/' + item.name;
    if (name === 'tests/review' && item.isDirectory()) continue;
    if (item.isSymbolicLink()) { errors.push('Unexpected symlink: ' + name); continue; }
    if (item.isDirectory()) inspect(name);
    else if (!known.has(name) && !manifest.allowedUnprotectedFiles.includes(name)) errors.push('Unexpected file: ' + name);
  }
}
for (const directory of manifest.frozenDirectories) inspect(directory);
try {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'dist/testnet/deployment.json'), 'utf8'));
  const gate = JSON.parse(fs.readFileSync(path.join(root, 'dist/testnet/release-status.json'), 'utf8'));
  assert.equal(config.chainId, 11155111);
  assert.equal(config.status, 'deployed');
  assert.equal(config.contractAddress, manifest.contractAddress);
  assert.equal(config.artworkBaseURL, manifest.artworkBaseURL);
  assert.equal(gate.deploymentEnabled, false);
  assert.equal(gate.status, 'sepolia-test-mint-ready');
} catch { errors.push('Deployment identity or release gate'); }
if (errors.length) {
  console.error('FAIL: protected baseline differs:\n' + errors.map(x => '- ' + x).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.files.length} protected files match SHA-256; all 81 artwork exports, existing Sepolia deployment and closed deployment gate are preserved.`);
}
