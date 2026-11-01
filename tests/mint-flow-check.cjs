'use strict';
// Run the shipped mint controller with isolated wallet/chain doubles. No network or signer.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ethers = require('ethers'), T = require('../dist/testnet/shared.js');
const root = path.resolve(__dirname, '../dist/testnet');
const json = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const configuration = json('deployment.json');
const bundle = { artifact: json('contract-artifact.json'), commitments: json('commitments.json'), gate: json('release-status.json'), base: configuration.artworkBaseURL };
const account = '0x1111111111111111111111111111111111111111';
const txHash = '0x' + 'ab'.repeat(32);
const iface = new ethers.Interface(bundle.artifact.abi);
function harness(fault, variantId = 0) {
  const elements = new Map(), pending = [], counters = { connections: 0, simulations: 0, sends: 0, verifications: 0, signers: 0, estimates: 0 };
  function element(id = '') { return { id, value: '', textContent: '', hidden: false, disabled: false, children: [], listeners: {},
    classList: { toggle() {} }, addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { if (!this.disabled) this.listeners.click?.(); }, appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; } }; }
  for (const match of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const e = element(match[1]); e.hidden = /\bhidden\b/.test(match[0]); e.disabled = /\bdisabled\b/.test(match[0]); elements.set(e.id, e);
  }
  const signer = { async sendTransaction(tx) {
    counters.sends++; assert.equal(tx.to, configuration.contractAddress); assert.equal(tx.chainId, 11155111); assert.equal(tx.value, 0n);
    assert.equal(tx.from, account);
    assert.equal(tx.data, iface.encodeFunctionData('mint', [variantId]));
    assert.equal(tx.gasLimit, undefined, 'Do not introduce a hard-coded or inflated gas allowance');
    if (fault === 'reject') throw Object.assign(new Error('Wallet rejected'), { code: 'ACTION_REJECTED' });
    return { hash: txHash };
  } };
  const session = { account: null, chainId: null, revision: 0,
    async connect() { counters.connections++; this.account = account; this.chainId = fault === 'wrong-chain' ? 1 : 11155111; this.revision++; this.changed(this); },
    async assertCurrent(saved) { T.assert(this.account && this.chainId === 11155111, 'Switch your wallet to Sepolia before continuing.');
      if (saved) T.assert(this.revision === saved.revision && this.account === saved.account, 'Wallet changed. Review again.');
      return { account: this.account, chainId: this.chainId, revision: this.revision }; },
    getProvider() { throw new Error('Mint checks must not use the rate-limited wallet RPC'); },
    async getSigner() { counters.signers++; return signer; }
  };
  const connectedContract = { mint: {
    async staticCall(id, overrides) {
      counters.simulations++; assert.equal(id, variantId); assert.equal(overrides.from, account);
      if (fault === 'simulation' || (fault === 'minted-after-review' && counters.simulations === 2)) throw new Error('AlreadyMinted');
      if (fault === 'account-during-review') { session.account = '0x2222222222222222222222222222222222222222'; session.revision++; }
      return 1n;
    },
    async populateTransaction(id) { return { to: configuration.contractAddress, data: iface.encodeFunctionData('mint', [id]) }; }
  } };
  const event = iface.encodeEventLog(iface.getEvent('Transfer'), [ethers.ZeroAddress, account, 1n]);
  const readProvider = {
    async estimateGas(tx) {
      counters.estimates++;
      assert.equal(tx.from, account); assert.equal(tx.chainId, 11155111); assert.equal(tx.value, 0n);
      assert.equal(tx.data, iface.encodeFunctionData('mint', [variantId]));
      if (fault === 'estimate') throw new Error('Estimate unavailable');
      return 492477n;
    },
    async getFeeData() { return { maxFeePerGas: 10n }; },
    async waitForTransaction(hash) { assert.equal(hash, txHash);
      if (fault === 'pending') return null;
      return { status: 1, logs: [{ address: configuration.contractAddress, ...event }] };
    }
  };
  const mock = { ...T,
    async loadRelease() { return bundle; },
    async fetchJSON() { return fault === 'unconfigured' ? { schemaVersion: 1, chainId: 11155111, status: 'not-deployed', contractAddress: null } : configuration; },
    createSession(unused, changed) { session.changed = changed; return session; },
    async verifyContract(provider) { assert.equal(provider, readProvider); counters.verifications++;
      if (fault === 'read-rate-limit') throw { code: 'CALL_EXCEPTION', shortMessage: 'missing revert data', info: { error: { message: 'HTTP request failed. Status: 429' } } };
      return {
      runtimeCodeHash: fault === 'runtime' || (fault === 'runtime-after-review' && counters.verifications === 2) ? '0xdead' : configuration.runtimeCodeHash,
      artworkBaseURL: configuration.artworkBaseURL,
      contract: { ...connectedContract, async minted() { return fault === 'duplicate'; } }
    }; },
    async verifyArtwork() { T.assert(fault !== 'artwork', 'Hosted artwork mismatch'); },
    fillDetails(e, rows) { e.rows = rows; }, pending() { return null; }, savePending(key, data) { pending.push({ key, data }); },
    addLink(e, label, href) { const link = { textContent: label, href }; e.appendChild(link); return link; },
    async readProvider() { T.assert(fault !== 'read-outage', 'Read provider unavailable'); return readProvider; }
  };
  const location = new URL(bundle.base + 'testnet/?' + T.compositionQuery(variantId));
  const sandbox = { WheelprintsTestnet: mock, ethers, ethereum: {}, URL, location, history: { replaceState() {} },
    document: { baseURI: location.href, getElementById: id => elements.get(id), createElement: () => element() } };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'mint.js'), 'utf8'), sandbox, { filename: 'mint.js' });
  return { el: id => elements.get(id), pending, counters, session };
}
async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
async function prepare(h) { await settle(); h.el('connect-wallet').click(); await settle(); h.el('prepare-mint').click(); await settle(); }
(async () => {
  assert.equal(bundle.gate.deploymentEnabled, false);
  assert.equal(T.validateDeployment(configuration), '0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac');
  const success = harness(undefined, 26); await settle();
  assert.equal(success.el('release-status').textContent, 'Sepolia deployment configured');
  assert.equal(success.el('connect-wallet').disabled, false);
  assert.equal(success.el('prepare-mint').disabled, true);
  assert.equal(success.el('confirm-mint').disabled, true);
  assert.equal(success.counters.connections, 0);
  await prepare(success);
  assert.equal(success.counters.sends, 0, 'Review must never send');
  assert.equal(success.counters.signers, 0, 'Review must not acquire a wallet signer');
  assert.equal(success.counters.estimates, 1);
  assert.equal(success.el('confirm-mint').disabled, false);
  assert.equal(success.el('mint-review').hidden, false);
  success.el('confirm-mint').click(); await settle();
  assert.equal(success.counters.simulations, 2, 'Simulate before review and before wallet request');
  assert.equal(success.counters.verifications, 2, 'Attest the contract before review and again before wallet request');
  assert.equal(success.counters.sends, 1);
  assert.equal(success.pending[0].data.hash, txHash);
  assert.match(success.el('mint-result').children[0].textContent, /Test print #1 was minted/);
  assert.match(success.el('mint-status').textContent, /Confirmed on Sepolia/);

  const rejected = harness('reject'); await prepare(rejected); rejected.el('confirm-mint').click(); await settle();
  assert.match(rejected.el('mint-status').textContent, /wallet request was declined/);
  assert.equal(rejected.pending.length, 0);

  for (const fault of ['runtime', 'artwork', 'duplicate', 'simulation', 'estimate', 'read-outage', 'read-rate-limit', 'account-during-review']) {
    const h = harness(fault); await prepare(h);
    assert.equal(h.el('confirm-mint').disabled, true, fault);
    assert.equal(h.el('mint-review').hidden, true, fault);
    assert.equal(h.counters.sends, 0, fault);
    assert.ok(h.el('mint-status').textContent, fault);
    if (fault === 'read-rate-limit') assert.match(h.el('mint-status').textContent, /rate limiting/);
  }
  for (const fault of ['runtime-after-review', 'minted-after-review']) {
    const h = harness(fault); await prepare(h); h.el('confirm-mint').click(); await settle();
    assert.equal(h.counters.sends, 0, fault); assert.equal(h.counters.signers, 0, fault);
    assert.equal(h.pending.length, 0);
  }
  const changed = harness(); await prepare(changed);
  changed.session.revision++; changed.session.account = '0x2222222222222222222222222222222222222222'; changed.session.changed(changed.session);
  assert.equal(changed.el('confirm-mint').disabled, true); assert.equal(changed.el('mint-review').hidden, true);
  for (const fault of ['unconfigured', 'wrong-chain']) {
    const h = harness(fault); await prepare(h);
    assert.equal(h.el('prepare-mint').disabled, true, fault);
    assert.equal(h.el('confirm-mint').disabled, true, fault); assert.equal(h.counters.sends, 0);
  }
  const pending = harness('pending'); await prepare(pending); pending.el('confirm-mint').click(); await settle();
  assert.equal(pending.pending[0].data.hash, txHash);
  assert.match(pending.el('mint-status').textContent, /still pending/);
  console.log('PASS: public-RPC attestations, explicit sender in simulation/estimate, no wallet reads or signer during review, variant 26 receipt, rejected signature, source/runtime/artwork/eligibility guards, read outage/429, stale account, wrong chain, revalidation before signing, and pending receipt recovery. No real transaction submitted.');
})().catch(error => { console.error(error); process.exitCode = 1; });
