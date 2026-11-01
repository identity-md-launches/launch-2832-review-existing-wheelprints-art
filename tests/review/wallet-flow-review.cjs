'use strict';
// IMD review: additional isolated wallet-flow regression tests for the shipped mint page.
// Complements tests/mint-flow-check.cjs (which mocks the wallet session) by running the
// REAL T.createSession against a local EIP-1193 fixture, plus real verifyContract /
// verifyArtwork / pending-recovery code paths. No network, no signer, no public transaction.
// Any "send" below is a counted call on a local fixture object, never a broadcast.
// Run from the repository root: node tests/review/wallet-flow-review.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ethers = require('ethers'), T = require('../../dist/testnet/shared.js');
const root = path.resolve(__dirname, '../../dist/testnet');
const json = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const configuration = json('deployment.json');
const bundle = { artifact: json('contract-artifact.json'), commitments: json('commitments.json'), gate: json('release-status.json'), base: configuration.artworkBaseURL };
const A = '0x1111111111111111111111111111111111111111', B = '0x2222222222222222222222222222222222222222';
const txHash = '0x' + 'cd'.repeat(32);
const rateLimited = () => ({ code: 'CALL_EXCEPTION', shortMessage: 'missing revert data', info: { error: { message: 'HTTP request failed. Status: 429' } } });

// Local EIP-1193 wallet fixture. Records every method so tests can prove no signing method is used.
function wallet(opts = {}) {
  const w = { chain: opts.chain || '0xaa36a7', accounts: [], methods: [], listeners: {}, name: opts.name || 'fixture',
    on(name, fn) { this.listeners[name] = fn; },
    emit(name, value) { this.listeners[name]?.(value); },
    async request({ method }) {
      this.methods.push(method);
      if (method === 'eth_accounts') return this.accounts;
      if (method === 'eth_chainId') return this.chain;
      if (method === 'eth_requestAccounts') {
        if (opts.rejectConnect) throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
        this.accounts = [opts.account || A]; return this.accounts;
      }
      throw new Error('Fixture wallet: unexpected method ' + method);
    } };
  return w;
}

function harness({ injected, fault, pendingStore = null, extra = {} } = {}) {
  const elements = new Map(), saved = [], counters = { sends: 0, signers: 0, verifications: 0, simulations: 0, minted: 0, readProviders: 0 };
  function element(id = '') { return { id, value: '', textContent: '', hidden: false, disabled: false, children: [], listeners: {},
    classList: { toggle() {} }, addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { if (!this.disabled) this.listeners.click?.(); }, appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; } }; }
  for (const match of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const e = element(match[1]); e.hidden = /\bhidden\b/.test(match[0]); e.disabled = /\bdisabled\b/.test(match[0]); elements.set(e.id, e);
  }
  const signer = { async sendTransaction() { counters.sends++; return { hash: txHash }; } };
  const contract = {
    async minted(account) { counters.minted++; if (fault === 'minted-429') throw rateLimited(); return fault === 'duplicate'; },
    mint: { async staticCall(id, o) { counters.simulations++; assert.ok(o.from); if (fault === 'sim-429-after-review' && counters.simulations === 2) throw rateLimited(); return 1n; },
      async populateTransaction(id) { return { to: configuration.contractAddress, data: '0x' }; } }
  };
  const readProvider = { async estimateGas() { return 100000n; }, async getFeeData() { return { maxFeePerGas: 1n }; },
    async waitForTransaction() { return null; } };
  const mock = { ...T,
    async loadRelease() { return bundle; },
    async fetchJSON() { return configuration; },
    // Real createSession (shared.js) wrapped only to count signer acquisition.
    createSession(inj, changed) { const s = T.createSession(inj, changed); const g = s.getSigner; s.getSigner = async () => { counters.signers++; await g; return signer; }; return s; },
    async readProvider() { counters.readProviders++; if (fault === 'read-429-after-review' && counters.readProviders === 2) throw rateLimited(); return readProvider; },
    async verifyContract() { counters.verifications++; return { runtimeCodeHash: configuration.runtimeCodeHash, artworkBaseURL: configuration.artworkBaseURL, contract }; },
    async verifyArtwork() {},
    fillDetails(e, rows) { e.rows = rows; },
    pending() { return pendingStore; }, savePending(key, data) { saved.push({ key, data }); },
    addLink(e, label, href) { const link = { textContent: label, href }; e.appendChild(link); return link; },
    ...extra };
  const location = new URL(bundle.base + 'testnet/?' + T.compositionQuery(0));
  const sandbox = { WheelprintsTestnet: mock, ethers, ethereum: injected, URL, location, history: { replaceState() {} },
    document: { baseURI: location.href, getElementById: id => elements.get(id), createElement: () => element() } };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'mint.js'), 'utf8'), sandbox, { filename: 'mint.js' });
  return { el: id => elements.get(id), counters, saved };
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };
const click = async (h, id) => { h.el(id).click(); await settle(); };
const noSigning = w => assert.ok(!w.methods.some(m => /sign|sendTransaction|eth_send/i.test(m)), 'wallet fixture received a signing method: ' + w.methods);

const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
(async () => {
  await check('No injected wallet: connect reports the missing-wallet message and nothing is enabled', async () => {
    const h = harness({ injected: undefined }); await settle(); await click(h, 'connect-wallet');
    assert.match(h.el('mint-status').textContent, /injected Ethereum wallet/);
    assert.equal(h.el('prepare-mint').disabled, true); assert.equal(h.counters.sends, 0);
  });
  await check('Multiple providers: only window.ethereum is used; an EIP-6963-announced second wallet is never contacted (characterisation)', async () => {
    const primary = wallet({ name: 'winner-of-window.ethereum' }), announced = wallet({ name: 'eip6963-only' });
    const h = harness({ injected: primary, extra: { announced } }); await settle(); await click(h, 'connect-wallet');
    assert.ok(primary.methods.includes('eth_requestAccounts'));
    assert.equal(announced.methods.length, 0, 'mint.js has no EIP-6963 discovery; see finding F1');
    const src = fs.readFileSync(path.join(root, 'mint.js'), 'utf8') + fs.readFileSync(path.join(root, 'shared.js'), 'utf8');
    assert.doesNotMatch(src, /eip6963/i);
  });
  await check('Connection rejection (EIP-1193 4001) shows "declined", keeps review disabled, no signer', async () => {
    const w = wallet({ rejectConnect: true }); const h = harness({ injected: w }); await settle(); await click(h, 'connect-wallet');
    assert.match(h.el('mint-status').textContent, /declined/);
    assert.equal(h.el('prepare-mint').disabled, true); assert.equal(h.el('confirm-mint').disabled, true);
    assert.equal(h.counters.signers, 0); noSigning(w);
  });
  await check('Wrong chain via real session: prepare stays disabled and switch-network is offered', async () => {
    const w = wallet({ chain: '0x1' }); const h = harness({ injected: w }); await settle(); await click(h, 'connect-wallet');
    assert.equal(h.el('prepare-mint').disabled, true); assert.equal(h.el('switch-network').hidden, false);
    assert.match(h.el('mint-status').textContent, /Switch to Sepolia/); noSigning(w);
  });
  for (const [label, mutate] of [['chainChanged', w => { w.chain = '0x1'; w.emit('chainChanged', '0x1'); }],
    ['accountsChanged', w => { w.accounts = [B]; w.emit('accountsChanged', [B]); }],
    ['disconnect', w => w.emit('disconnect')]]) {
    await check(`Real wallet ${label} event after review invalidates the review; confirm cannot send`, async () => {
      const w = wallet(); const h = harness({ injected: w }); await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
      assert.equal(h.el('mint-review').hidden, false, 'review should be shown first');
      mutate(w); await settle();
      assert.equal(h.el('mint-review').hidden, true, label); assert.equal(h.el('confirm-mint').disabled, true, label);
      await click(h, 'confirm-mint'); assert.equal(h.counters.sends, 0); assert.equal(h.counters.signers, 0); noSigning(w);
    });
  }
  await check('Silent change (no event) between review and confirm is caught by revalidation', async () => {
    const w = wallet(); const h = harness({ injected: w }); await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
    w.accounts = [B]; // wallet that does not emit accountsChanged
    await click(h, 'confirm-mint');
    assert.equal(h.counters.sends, 0); assert.equal(h.counters.signers, 0);
    assert.match(h.el('mint-status').textContent, /changed/);
  });
  for (const fault of ['read-429-after-review', 'sim-429-after-review']) {
    await check(`RPC 429 during pre-sign revalidation (${fault}) blocks the wallet request and is reported as rate limiting`, async () => {
      const w = wallet(); const h = harness({ injected: w, fault }); await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
      assert.equal(h.el('mint-review').hidden, false); await click(h, 'confirm-mint');
      assert.equal(h.counters.sends, 0); assert.equal(h.counters.signers, 0); assert.equal(h.saved.length, 0);
      assert.match(h.el('mint-status').textContent, /rate limiting/); noSigning(w);
    });
  }
  await check('Eligibility read rate-limited (minted() 429) fails closed rather than treating the wallet as eligible', async () => {
    const h = harness({ injected: wallet(), fault: 'minted-429' }); await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
    assert.equal(h.el('mint-review').hidden, true); assert.equal(h.el('confirm-mint').disabled, true);
    assert.match(h.el('mint-status').textContent, /rate limiting/); assert.equal(h.counters.simulations, 0);
  });
  await check('Duplicate eligibility via real session: already-minted blocks before simulation', async () => {
    const h = harness({ injected: wallet(), fault: 'duplicate' }); await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
    assert.match(h.el('mint-status').textContent, /already minted/); assert.equal(h.counters.simulations, 0);
  });
  await check('Pending recovery on reload: saved hash for this contract shows a check-previous link', async () => {
    const h = harness({ injected: wallet(), pendingStore: { hash: txHash, contractAddress: configuration.contractAddress.toLowerCase(), account: A, variantId: 0 } }); await settle();
    const r = h.el('mint-result'); assert.equal(r.hidden, false);
    assert.ok(r.children.some(c => c.href === T.EXPLORER + '/tx/' + txHash));
  });
  for (const [label, store] of [['other contract', { hash: txHash, contractAddress: B }], ['malformed hash', { hash: '0x1234', contractAddress: configuration.contractAddress }],
    ['script-like hash', { hash: 'javascript:alert(1)', contractAddress: configuration.contractAddress }]]) {
    await check(`Pending recovery ignores ${label}`, async () => {
      const h = harness({ injected: wallet(), pendingStore: store }); await settle();
      assert.equal(h.el('mint-result').hidden, true, label); assert.equal(h.el('mint-result').children.length, 0);
    });
  }
  await check('Pending notice is advisory only: review of another mint is still allowed (characterisation, finding F3)', async () => {
    const h = harness({ injected: wallet(), pendingStore: { hash: txHash, contractAddress: configuration.contractAddress, account: A, variantId: 0 } });
    await settle(); await click(h, 'connect-wallet'); await click(h, 'prepare-mint');
    assert.equal(h.el('mint-review').hidden, false);
  });
  await check('Real savePending/pending round-trip through localStorage and tolerate corrupt storage', async () => {
    const store = new Map(); globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    try {
      T.savePending('mint', { hash: txHash, contractAddress: configuration.contractAddress });
      assert.equal(T.pending('mint').hash, txHash);
      store.set('wheelprints:sepolia:mint', '{not json'); assert.equal(T.pending('mint'), null);
    } finally { delete globalThis.localStorage; }
  });
  await check('Real verifyContract rejects wrong network and empty/modified code before any contract read', async () => {
    let calls = 0;
    const base = { async getNetwork() { return { chainId: 11155111n }; }, async getCode() { return '0x'; }, async call() { calls++; throw new Error('unexpected'); } };
    await assert.rejects(T.verifyContract({ ...base, async getNetwork() { return { chainId: 1n }; } }, configuration.contractAddress, bundle), /Sepolia/);
    await assert.rejects(T.verifyContract(base, configuration.contractAddress, bundle), /does not contain/);
    const d = bundle.artifact.deployedBytecode, runtime = typeof d === 'object' ? d.object : d;
    const tampered = runtime.slice(0, 4) + (runtime[4] === 'f' ? '0' : 'f') + runtime.slice(5);
    await assert.rejects(T.verifyContract({ ...base, async getCode() { return tampered; } }, configuration.contractAddress, bundle), /differs/);
    assert.equal(calls, 0);
    await assert.rejects(T.verifyContract(base, '0xnot-an-address', bundle));
  });
  await check('Real verifyArtwork: HTTP 404/429 and byte mismatch block; hash is computed over fetched bytes', async () => {
    const original = global.fetch, v = bundle.commitments.variants[0];
    const bytes = fs.readFileSync(path.join(__dirname, '../../dist', v.svgPath));
    try {
      global.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes });
      assert.equal(await T.verifyArtwork(bundle, v, configuration.artworkBaseURL), configuration.artworkBaseURL + v.svgPath);
      for (const status of [404, 429]) { global.fetch = async () => ({ ok: false, status }); await assert.rejects(T.verifyArtwork(bundle, v, configuration.artworkBaseURL), new RegExp('HTTP ' + status)); }
      global.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.concat([bytes, Buffer.from(' ')]) });
      await assert.rejects(T.verifyArtwork(bundle, v, configuration.artworkBaseURL), /do not match/);
    } finally { global.fetch = original; }
  });
  await check('Invalid deployment evidence is rejected by validateDeployment (http origin, bad hash, mainnet)', () => {
    assert.throws(() => T.validateDeployment({ ...configuration, artworkBaseURL: 'http://wheelprints-sepolia.pages.dev/' }));
    assert.throws(() => T.validateDeployment({ ...configuration, transactionHash: '0x12' }));
    assert.throws(() => T.validateDeployment({ ...configuration, chainId: 1 }));
    assert.equal(T.validateDeployment(configuration), '0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac');
  });
  console.log(JSON.stringify({ result: 'passed', count: checks.length, checks, note: 'Local fixtures only. No wallet signature requested; no transaction sent or broadcast.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
