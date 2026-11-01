'use strict';
// Execute the production page controllers with a wallet that always rejects sends.
// No real wallet, RPC connection, signing or broadcast is available in this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../dist/testnet/shared.js');
const root = path.resolve(__dirname, '../dist/testnet');
const json = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const bundle = { artifact: json('contract-artifact.json'), commitments: json('commitments.json'),
  gate: json('release-status.json'), base: 'https://wheelprints-sepolia.pages.dev/' };
// Preserve the pre-deployment/rejection regression with an explicit closed-mint fixture.
const configuration = { schemaVersion: 1, chainId: 11155111, status: 'not-deployed', contractAddress: null };
const account = '0x1111111111111111111111111111111111111111';

function harness(page, controller, release = bundle) {
  const elements = new Map();
  for (const match of fs.readFileSync(path.join(root, page), 'utf8').matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    elements.set(match[1], { value: '', textContent: '', checked: false,
      disabled: /\bdisabled\b/.test(match[0]), hidden: /\bhidden\b/.test(match[0]),
      classList: { toggle() {} }, listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      click() { if (!this.disabled) this.listeners.click?.(); }
    });
  }
  const counters = { connects: 0, estimates: 0, simulations: 0, walletRequests: 0, saved: 0, artwork: 0 };
  const signer = {
    async estimateGas() { counters.estimates++; return 19906741n; },
    async sendTransaction() { counters.walletRequests++; throw Object.assign(new Error('Rejected by test wallet'), { code: 'ACTION_REJECTED' }); }
  };
  const session = { account: null, chainId: null, revision: 0,
    async connect() { counters.connects++; this.account = account; this.chainId = 11155111; this.revision++; this.changed(this); },
    async assertCurrent(saved) {
      assert.equal(this.chainId, 11155111);
      if (saved) assert.equal(saved.revision, this.revision);
      return { account: this.account, chainId: this.chainId, revision: this.revision };
    },
    getProvider() { return {}; }, async getSigner() { return signer; }
  };
  const mock = { ...T,
    async loadRelease() { return release; }, async fetchJSON() { return configuration; },
    createSession(unused, changed) { session.changed = changed; return session; },
    eth() { return { ContractFactory: class { async getDeployTransaction(url) {
      assert.equal(url, bundle.base); return { data: '0x6001', value: 0n };
    } } }; },
    async verifySource() { return { blockNumber: 12037405 }; },
    async fileHash() { return T.hexHash(bundle.commitments.rendererSourceSHA256); },
    async verifyArtwork() { counters.artwork++; },
    async gasEstimate() { counters.estimates++; return { units: 19906741n, text: 'test estimate' }; },
    async readProvider() { return {}; },
    async validateConstructor(provider, artifact, tx, from, estimate, limit) {
      counters.simulations++; assert.equal(from, account); assert.equal(estimate, 19906741n);
      if (limit !== undefined) assert.equal(limit, 21897416n);
      return { gasLimit: 21897416n, blockNumber: '0xb7ad1d', validation: true };
    },
    fillDetails(element, rows) { element.rows = rows; },
    pending() { return null; }, savePending() { counters.saved++; }
  };
  const location = new URL(bundle.base + 'testnet/' + page);
  const sandbox = { WheelprintsTestnet: mock, ethers: {}, ethereum: {}, URL, Blob, location,
    document: { baseURI: location.href, getElementById: id => elements.get(id) },
    history: { replaceState() {} }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, controller), 'utf8'), sandbox, { filename: controller });
  return { el: id => elements.get(id), counters };
}
async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
(async () => {
  assert.equal(bundle.gate.deploymentEnabled, false, 'The shipped release must not allow another deployment');
  const deploy = harness('deploy.html', 'deploy.js', { ...bundle, gate: { ...bundle.gate, deploymentEnabled: true } }); await settle();
  assert.equal(deploy.counters.connects, 0, 'Page load must not ask wallet permission');
  assert.equal(deploy.el('prepare-deploy').disabled, true);
  deploy.el('connect-wallet').click(); await settle();
  assert.equal(deploy.el('prepare-deploy').disabled, false);
  assert.equal(deploy.el('confirm-deploy').disabled, true);
  deploy.el('prepare-deploy').click(); await settle();
  assert.equal(deploy.el('deployment-review').hidden, false);
  assert.equal(deploy.counters.artwork, 27);
  assert.equal(deploy.counters.simulations, 1);
  assert.equal(deploy.counters.walletRequests, 0, 'Preparing must not request a transaction');
  assert.equal(deploy.el('confirm-deploy').disabled, true, 'Acknowledgement is required');
  deploy.el('accept-testnet').checked = true;
  deploy.el('accept-testnet').listeners.change();
  assert.equal(deploy.el('confirm-deploy').disabled, false);
  deploy.el('confirm-deploy').click(); await settle();
  assert.equal(deploy.counters.simulations, 2, 'Revalidate before the wallet request');
  assert.equal(deploy.counters.walletRequests, 1);
  assert.match(deploy.el('deploy-status').textContent, /wallet request was declined/);
  assert.equal(deploy.counters.saved, 0, 'Rejection must not save a pending transaction');
  assert.equal(deploy.el('recovery-hash').value, '');
  assert.equal(deploy.el('deployment-result').hidden, true);

  const closed = harness('deploy.html', 'deploy.js', { ...bundle, gate: { ...bundle.gate, deploymentEnabled: false } });
  await settle(); closed.el('connect-wallet').click(); await settle();
  assert.equal(closed.el('prepare-deploy').disabled, true, 'A closed gate must still block preparation');
  assert.equal(closed.el('confirm-deploy').disabled, true);

  const mint = harness('index.html', 'mint.js'); await settle();
  assert.equal(mint.el('release-status').textContent, 'Test mint not open yet');
  for (const id of ['connect-wallet', 'prepare-mint', 'confirm-mint']) assert.equal(mint.el(id).disabled, true, id);
  assert.equal(mint.counters.connects, 0);
  assert.equal(mint.counters.walletRequests, 0);
  console.log('PASS: preparation requires connection; checks all 27 artworks; sends only after acknowledgement; revalidates before wallet request; rejection saves no transaction/config; closed gate still blocks; mint stays disabled.');
})().catch(error => { console.error(error); process.exitCode = 1; });
