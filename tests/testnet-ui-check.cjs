'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('ethers');
const T = require('../dist/testnet/shared.js');

const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }

(async () => {
  await check('All 27 selector combinations and URL round trips match', () => {
    const ids = new Set();
    for (let r = 0; r < 3; r++) for (let f = 0; f < 3; f++) for (let p = 0; p < 3; p++) {
      const id = T.variantId(r, f, p); ids.add(id);
      const parsed = T.selection(T.compositionQuery(id));
      assert.deepEqual(parsed, { record: r, form: f, palette: p });
    }
    assert.equal(ids.size, 27);
    assert.deepEqual(T.selection('?record=bad&form=bad&palette=bad'), { record: 0, form: 0, palette: 0 });
    assert.throws(() => T.variantId(3, 0, 0));
    assert.throws(() => T.variantId(0, 0.5, 0));
  });
  await check('Undeployed configuration stays closed; wrong network and unsafe URLs are rejected', () => {
    assert.equal(T.validateDeployment({ schemaVersion: 1, chainId: 11155111, status: 'not-deployed', contractAddress: null }), null);
    const ready = { schemaVersion: 1, chainId: 11155111, status: 'deployed', contractAddress: '0x1111111111111111111111111111111111111111', transactionHash: '0x' + 'ab'.repeat(32), artworkBaseURL: 'https://example.com/wheelprints/' };
    assert.equal(T.validateDeployment(ready), ready.contractAddress);
    assert.throws(() => T.validateDeployment({ ...ready, chainId: 1 }));
    assert.throws(() => T.validateDeployment({ ...ready, status: 'not-deployed' }));
    assert.throws(() => T.validateDeployment({ ...ready, transactionHash: '' }));
    for (const url of ['http://example.com/', 'https://user:secret@example.com/', 'https://example.com/?key=secret', 'https://example.com/#x', 'https://example.com/no-slash']) assert.throws(() => T.validBaseURL(url));
    assert.equal(T.validBaseURL('https://example.com/'), 'https://example.com/');
  });
  await check('Runtime attestation rejects absent or modified code', () => {
    assert.equal(T.matchRuntime('0x60016002', { deployedBytecode: '0x60016002', immutableReferences: {} }), true);
    assert.throws(() => T.matchRuntime('0x', { deployedBytecode: '0x60016002' }));
    assert.throws(() => T.matchRuntime('0x60016003', { deployedBytecode: '0x60016002' }));
    assert.equal(T.matchRuntime('0x600160ff', { deployedBytecode: '0x60016000', immutableReferences: { field: [{ start: 3, length: 1 }] } }), true);
    assert.throws(() => T.matchRuntime('0x600260ff', { deployedBytecode: '0x60016000', immutableReferences: { field: [{ start: 3, length: 1 }] } }));
  });
  await check('Wallet permissions are requested only by explicit connect; stale account or network blocks send preparation', async () => {
    let chain = '0x1', accounts = [], permissionRequests = 0;
    const listeners = {};
    const injected = {
      on(name, callback) { listeners[name] = callback; },
      async request({ method, params }) {
        if (method === 'eth_accounts') return accounts;
        if (method === 'eth_chainId') return chain;
        if (method === 'eth_requestAccounts') { permissionRequests++; accounts = ['0x1111111111111111111111111111111111111111']; return accounts; }
        if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; return null; }
        throw new Error('Unexpected wallet request: ' + method);
      }
    };
    const session = T.createSession(injected);
    assert.equal(permissionRequests, 0);
    await session.refresh(); assert.equal(permissionRequests, 0);
    await assert.rejects(session.assertCurrent(), /Connect/);
    await session.connect(); assert.equal(permissionRequests, 1);
    await assert.rejects(session.assertCurrent(), /Sepolia/);
    await session.switchNetwork();
    const saved = await session.assertCurrent();
    assert.equal(saved.chainId, 11155111);
    accounts = ['0x2222222222222222222222222222222222222222'];
    await assert.rejects(session.assertCurrent(saved), /changed/);
    const second = session.snapshot(); chain = '0x1';
    await assert.rejects(session.assertCurrent(second), /Sepolia/);
    listeners.disconnect(); assert.equal(session.account, null);
    assert.equal(permissionRequests, 1);
  });
  await check('Artwork hash mismatch blocks mint preparation', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, arrayBuffer: async () => Buffer.from('correct SVG') });
    try {
      const variant = { svgPath: 'exports/print.svg', artworkSHA256: sha256(Buffer.from('correct SVG')) };
      assert.equal(await T.verifyArtwork({ base: 'https://example.com/' }, variant), 'https://example.com/exports/print.svg');
      await assert.rejects(T.verifyArtwork({ base: 'https://example.com/' }, { ...variant, artworkSHA256: '0x' + '00'.repeat(32) }), /do not match/);
    } finally { global.fetch = originalFetch; }
  });
  await check('Nested RPC rate limits are distinguished from genuine reverts without exposing request details', () => {
    const error = { code: 'CALL_EXCEPTION', shortMessage: 'missing revert data', info: { error: { message: 'HTTP request failed. Status: 429. URL: https://example.invalid/private-key' } } };
    assert.match(T.errorMessage(error), /rate limiting/);
    assert.doesNotMatch(T.errorMessage(error), /private-key|example.invalid/);
    assert.match(T.errorMessage({ code: 'CALL_EXCEPTION', reason: 'AlreadyMinted' }), /already minted/);
    assert.equal(T.errorMessage({ shortMessage: 'execution reverted' }), 'execution reverted');
    assert.match(T.errorMessage({ code: 'ACTION_REJECTED' }), /declined/);
  });
  const commitmentsFile = path.join(__dirname, '../dist/testnet/commitments.json');
  assert.ok(fs.existsSync(commitmentsFile), 'Build contract artifacts before running frontend checks.');
  const commitments = JSON.parse(fs.readFileSync(commitmentsFile));
  await check('Generated contract commitments match every released SVG and the existing renderer', () => {
    T.validateCommitments(commitments);
    for (const variant of commitments.variants) {
      const bytes = fs.readFileSync(path.join(__dirname, '../dist', variant.svgPath));
      assert.equal(sha256(bytes), T.hexHash(variant.artworkSHA256));
    }
    assert.equal(sha256(fs.readFileSync(path.join(__dirname, '../dist/art-engine.js'))), T.hexHash(commitments.rendererSourceSHA256));
    const swapped = structuredClone(commitments); [swapped.variants[0], swapped.variants[1]] = [swapped.variants[1], swapped.variants[0]];
    assert.throws(() => T.validateCommitments(swapped), /ordering/);
  });
  await check('Controls begin disabled; verified mint configuration is installed and new deployment is closed', () => {
    const mint = fs.readFileSync(path.join(__dirname, '../dist/testnet/index.html'), 'utf8');
    const deploy = fs.readFileSync(path.join(__dirname, '../dist/testnet/deploy.html'), 'utf8');
    assert.match(mint, /id="prepare-mint"[^>]*disabled/);
    assert.match(mint, /id="confirm-mint"[^>]*disabled/);
    assert.match(deploy, /id="confirm-deploy"[^>]*disabled/);
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/testnet/deployment.json')));
    const verified = JSON.parse(fs.readFileSync(path.join(__dirname, '../handoff-evidence/deployed-contract-verification.json')));
    assert.equal(verified.result, 'passed');
    assert.deepEqual(config, verified.configuration);
    assert.equal(T.validateDeployment(config), '0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac');
    const release = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/testnet/release-status.json')));
    assert.equal(release.deploymentEnabled, false);
    assert.equal(release.status, 'sepolia-test-mint-ready');
    assert.equal(release.deployedContractAddress, config.contractAddress);
    assert.equal(release.deploymentTransactionHash, config.transactionHash);
    const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/testnet/constructor-simulation.json')));
    assert.equal(evidence.result, 'passed');
    assert.equal(evidence.stateOverridesUsed, false);
    assert.equal(evidence.blockOverridesUsed, false);
    assert.equal(evidence.validation.validation, true);
    assert.equal(evidence.hostedArtworkVerified, true);
    assert.equal(evidence.artworkBaseURL, release.reviewedArtworkBaseURL);
    assert.equal(evidence.artifactSHA256, release.simulatedArtifactSHA256);
    assert.equal(evidence.artifactSHA256, sha256(fs.readFileSync(path.join(__dirname, '../dist/testnet/contract-artifact.json'))).slice(2));
    assert.equal(config.runtimeCodeHash, verified.runtimeCodeHash);
  });
  console.log(JSON.stringify({ result: 'passed', checks, count: checks.length }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
