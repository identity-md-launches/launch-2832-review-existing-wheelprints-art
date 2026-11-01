'use strict';
// IMD review: OPTIONAL read-only public check (needs network). Reuses the shipped
// T.readProvider/T.verifyContract/T.verifyArtwork. Only eth_chainId/eth_getCode/eth_call
// and HTTPS GETs are made; no wallet, no signer, no transaction.
// Run from the repository root: node tests/review/live-readonly-check.cjs
const assert = require('node:assert/strict'), path = require('node:path');
const T = require('../../dist/testnet/shared.js');
const dir = path.resolve(__dirname, '../../dist/testnet');
const json = n => require(path.join(dir, n));
(async () => {
  const config = json('deployment.json');
  const bundle = { artifact: json('contract-artifact.json'), commitments: json('commitments.json') };
  const provider = await T.readProvider();
  const verified = await T.verifyContract(provider, config.contractAddress, bundle, config.artworkBaseURL);
  assert.equal(verified.runtimeCodeHash, config.runtimeCodeHash);
  assert.equal(verified.artworkBaseURL, 'https://wheelprints-sepolia.pages.dev/');
  for (const v of bundle.commitments.variants) await T.verifyArtwork(bundle, v, verified.artworkBaseURL);
  const block = await provider.getBlockNumber();
  console.log(JSON.stringify({ result: 'passed', block, contract: verified.address, runtimeCodeHash: verified.runtimeCodeHash, artworkBaseURL: verified.artworkBaseURL, hostedSvgsVerified: 27, transactions: 0 }));
  provider.destroy();
})().catch(e => { console.error(T.errorMessage(e)); process.exitCode = 1; });
