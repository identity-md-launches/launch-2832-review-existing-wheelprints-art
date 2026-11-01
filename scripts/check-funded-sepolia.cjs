'use strict';
// Read-only funded-account preflight. No signer, private key or broadcast methods.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { createHash } = require('node:crypto');
const { ContractFactory, JsonRpcProvider, getAddress, formatEther, keccak256 } = require('ethers');
const T = require('../dist/testnet/shared.js');
const root = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
const report = {
  schemaVersion: 1, checkedAt: new Date().toISOString(), result: 'in-progress',
  purpose: 'Unsigned, read-only constructor validation using the actual funded account and final hosted artwork URL.',
  stateOverridesUsed: false, blockOverridesUsed: false, signed: false, broadcast: false,
  hostedFiles: [], rpcEvidence: [],
  limitations: ['Point-in-time public RPC validation; fees, balance and chain state can change.',
    'eth_simulateV1 does not check signatures or contract-sender validity; sender code is checked separately.',
    'Wallet signing, transaction inclusion, deployment receipt recovery and real minting remain untested.']
};
const output = path.join(root, 'handoff-evidence/funded-sepolia-preflight.json');
let provider;
async function hostedFile(relative) {
  const url = new URL(relative, report.artworkBaseURL).href;
  const { stdout } = await execFile('curl', ['--fail', '--silent', '--show-error', '--max-time', '30', url],
    { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 35000 });
  const local = fs.readFileSync(path.join(root, 'dist', relative));
  const entry = { path: relative, bytes: stdout.length, sha256: sha(stdout), matchesRelease: sha(stdout) === sha(local) };
  report.hostedFiles.push(entry);
  assert.ok(entry.matchesRelease, 'Hosted release mismatch: ' + relative);
  return stdout;
}
async function main() {
  assert.ok(process.env.WHEELPRINTS_FROM_ADDRESS, 'Set WHEELPRINTS_FROM_ADDRESS to your public Sepolia wallet address.');
  assert.ok(process.env.WHEELPRINTS_ARTWORK_URL, 'Set WHEELPRINTS_ARTWORK_URL to the final HTTPS artwork root ending /.');
  report.sender = getAddress(process.env.WHEELPRINTS_FROM_ADDRESS);
  report.artworkBaseURL = T.validBaseURL(process.env.WHEELPRINTS_ARTWORK_URL);
  report.provider = process.env.WHEELPRINTS_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  assert.equal(new URL(report.provider).protocol, 'https:', 'Use an HTTPS Sepolia RPC.');
  const [artifactBytes, commitmentBytes, gateBytes, deploymentBytes] = await Promise.all([
    'testnet/contract-artifact.json', 'testnet/commitments.json', 'testnet/release-status.json', 'testnet/deployment.json'
  ].map(hostedFile));
  const artifact = JSON.parse(artifactBytes), commitments = T.validateCommitments(JSON.parse(commitmentBytes));
  const gate = JSON.parse(gateBytes), deployment = JSON.parse(deploymentBytes);
  assert.equal(gate.deploymentEnabled, false, 'This pre-enablement check expects deployment to remain disabled.');
  assert.equal(T.validateDeployment(deployment), null, 'This pre-enablement check expects no deployed contract.');
  report.releaseGate = { deploymentEnabled: gate.deploymentEnabled, contractStatus: deployment.status, contractAddress: deployment.contractAddress };
  report.artifactSHA256 = sha(artifactBytes);
  report.runtimeKeccak256 = keccak256(artifact.deployedBytecode);
  report.runtimeBytes = (artifact.deployedBytecode.length - 2) / 2;
  assert.equal(report.artifactSHA256, gate.simulatedArtifactSHA256, 'The gated artifact differs from the reviewed artifact.');
  for (const file of ['testnet/shared.js', 'testnet/deploy.js', 'testnet/mint.js']) await hostedFile(file);
  const renderer = await hostedFile('art-engine.js');
  assert.equal('0x' + sha(renderer), T.hexHash(commitments.rendererSourceSHA256), 'Renderer commitment mismatch.');
  // Fetch all committed SVGs in bounded batches, comparing both local bytes and onchain commitments.
  for (let i = 0; i < commitments.variants.length; i += 4) {
    await Promise.all(commitments.variants.slice(i, i + 4).map(async variant => {
      const bytes = await hostedFile(variant.svgPath);
      assert.equal('0x' + sha(bytes), T.hexHash(variant.artworkSHA256), 'SVG commitment mismatch: ' + variant.variantId);
    }));
  }
  report.hostedArtworkVerified = true;
  provider = new JsonRpcProvider(report.provider, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  const send = provider.send.bind(provider);
  const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode',
    'eth_getStorageAt', 'eth_call', 'eth_estimateGas', 'eth_getTransactionCount', 'eth_getBalance',
    'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_simulateV1']);
  provider.send = async (method, params) => {
    assert.ok(allowed.has(method), 'Read-only RPC method required: ' + method);
    if (method === 'eth_simulateV1') {
      assert.equal(params[0].validation, true);
      assert.equal(params[0].blockStateCalls.length, 1);
      for (const block of params[0].blockStateCalls) {
        assert.equal(block.stateOverrides, undefined, 'Funded validation must use real state.');
        assert.equal(block.blockOverrides, undefined, 'Funded validation must use real block parameters.');
        assert.equal(block.calls.length, 1);
        assert.equal(getAddress(block.calls[0].from), report.sender);
        assert.equal(block.calls[0].to, undefined, 'Expected contract creation.');
        assert.equal(BigInt(block.calls[0].value), 0n);
      }
    }
    try {
      const result = await send(method, params);
      report.rpcEvidence.push({ method, params, result });
      return result;
    } catch (error) {
      report.rpcEvidence.push({ method, params, error: error.shortMessage || error.message });
      throw error;
    }
  };
  assert.equal(BigInt(await provider.send('eth_chainId', [])), 11155111n);
  assert.equal(await provider.send('eth_getCode', [report.sender, 'latest']), '0x', 'This wallet needs a separate review of its account code.');
  report.sourceCheck = await T.verifySource(provider, commitments);
  const tx = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(report.artworkBaseURL);
  report.creationDataKeccak256 = keccak256(tx.data);
  report.creationDataBytes = (tx.data.length - 2) / 2;
  const estimate = BigInt(await provider.send('eth_estimateGas', [{ from: report.sender, data: tx.data, value: '0x0' }, 'latest']));
  report.estimatedTotalGas = estimate;
  report.validation = await T.validateConstructor(provider, artifact, tx, report.sender, estimate);
  const at = report.validation.blockNumber;
  const [balanceHex, nonceHex, pendingNonceHex, code, fee] = await Promise.all([
    provider.send('eth_getBalance', [report.sender, at]),
    provider.send('eth_getTransactionCount', [report.sender, at]),
    provider.send('eth_getTransactionCount', [report.sender, 'pending']),
    provider.send('eth_getCode', [report.sender, at]), provider.getFeeData()
  ]);
  assert.equal(code, '0x');
  assert.equal(BigInt(nonceHex), BigInt(pendingNonceHex), 'The account has a newer/pending transaction. Recheck after it settles.');
  const simulation = report.rpcEvidence.find(entry => entry.method === 'eth_simulateV1');
  const call = simulation.params[0].blockStateCalls[0].calls[0];
  assert.equal(BigInt(call.nonce), BigInt(nonceHex));
  const balance = BigInt(balanceHex), gasPrice = BigInt(call.gasPrice), maxFee = fee.maxFeePerGas || fee.gasPrice;
  assert.ok(maxFee && maxFee > 0n, 'Current fee estimate unavailable.');
  const reserve = report.validation.gasLimit * maxFee;
  report.wallet = { address: report.sender, balanceWei: balance, balanceSepoliaETH: formatEther(balance),
    confirmedNonce: BigInt(nonceHex), pendingNonce: BigInt(pendingNonceHex), accountCode: code };
  report.fees = { simulationGasPriceWei: gasPrice, maxFeePerGasWei: maxFee,
    maxPriorityFeePerGasWei: fee.maxPriorityFeePerGas,
    estimatedCostSepoliaETH: formatEther(estimate * gasPrice),
    simulationGasLimitCostSepoliaETH: formatEther(report.validation.gasLimit * gasPrice),
    feeCapReserveSepoliaETH: formatEther(reserve), balanceCoversFeeCapReserve: balance >= reserve };
  assert.ok(balance >= reserve, 'Current balance does not cover reviewed gas limit at the current suggested fee cap.');
  const finalBlock = await provider.send('eth_getBlockByNumber', [at, false]);
  assert.equal(finalBlock.hash, report.validation.blockHash, 'Pinned block changed during validation.');
  // Confirm the public gates still match after the chain check.
  await hostedFile('testnet/release-status.json');
  await hostedFile('testnet/deployment.json');
  report.result = 'passed';
}
main().catch(error => {
  report.result = 'failed';
  report.error = error.shortMessage || error.message;
  process.exitCode = 1;
}).finally(() => {
  if (provider) provider.destroy();
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(output, stringify(report));
  const { rpcEvidence, hostedFiles, ...summary } = report;
  console.log(stringify({ ...summary, hostedFilesChecked: hostedFiles.length, evidence: output }));
});
