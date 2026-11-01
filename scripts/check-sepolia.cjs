'use strict';
// Read-only. No signer, private key, sendTransaction or broadcast method.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { ContractFactory, JsonRpcProvider, ZeroAddress, keccak256 } = require('ethers');
const T = require('../dist/testnet/shared.js');
const root = path.resolve(__dirname, '..');
const artifact = require('../dist/testnet/contract-artifact.json');
const commitments = require('../dist/testnet/commitments.json');
const sha = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const rpcURL = process.env.WHEELPRINTS_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const baseURL = process.env.WHEELPRINTS_ARTWORK_URL || 'https://example.com/wheelprints/';
const rpcEvidence = [];
const provider = new JsonRpcProvider(rpcURL, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
const send = provider.send.bind(provider);
provider.send = async (method, params) => {
  assert.ok(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getStorageAt','eth_call','eth_estimateGas','eth_getTransactionCount','eth_gasPrice','eth_simulateV1'].includes(method));
  // The artificial sender is funded only in this unsigned rehearsal. Core code,
  // implementation and storage are never overridden. Production UI has no overrides.
  if (method === 'eth_simulateV1') {
    params = structuredClone(params);
    params[0].blockStateCalls[0].stateOverrides = { [ZeroAddress]: { balance: '0x3635c9adc5dea00000' } };
  }
  try { const result = await send(method, params); rpcEvidence.push({ method, params, result }); return result; }
  catch (e) { rpcEvidence.push({ method, params, error: e.shortMessage || e.message }); throw e; }
};
(async () => {
  T.validBaseURL(baseURL);
  const sourceCheck = await T.verifySource(provider, commitments);
  const tx = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(baseURL);
  const request = { from: ZeroAddress, data: tx.data, value: '0x0' };
  const estimate = BigInt(await provider.send('eth_estimateGas', [request, 'latest']));
  const validation = await T.validateConstructor(provider, artifact, tx, ZeroAddress, estimate);
  const result = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), result: 'passed', provider: rpcURL,
    purpose: 'Unsigned Sepolia constructor simulation with transaction validation; no deployment or broadcast.',
    artifactSHA256: sha(fs.readFileSync(path.join(root, 'dist/testnet/contract-artifact.json'))),
    runtimeKeccak256: keccak256(artifact.deployedBytecode), runtimeBytes: artifact.deployedBytecodeBytes,
    sourceCheck, artworkBaseURL: baseURL, hostedArtworkVerified: false,
    estimatedTotalGas: String(estimate), validation,
    limitations: ['Only the synthetic sender balance is overridden. No source override.', 'Simulation omits signature and contract-sender checks; it is not a transaction receipt.', 'Final hosted assets, funded user wallet, signing and recovery still require verification.'],
    references: ['https://eips.ethereum.org/EIPS/eip-8037','https://blog.ethereum.org/2026/09/17/glamsterdam-testnet-announcement','https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-eth'],
    rpcEvidence
  };
  fs.writeFileSync(path.join(root, 'handoff-evidence/current-sepolia-preflight.json'), JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, estimatedTotalGas: result.estimatedTotalGas, validation, runtimeBytes: result.runtimeBytes }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
})().catch(e => { console.error(e.shortMessage || e); process.exitCode = 1; }).finally(() => provider.destroy());
