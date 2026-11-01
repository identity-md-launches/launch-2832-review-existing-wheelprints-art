'use strict';
const assert = require('node:assert/strict');
const T = require('../dist/testnet/shared.js');
const artifact = { bytecode: '0x6001', deployedBytecode: '0x6002' };
const tx = { data: '0x60010000', value: 0n };
const sender = '0x1111111111111111111111111111111111111111';
async function run(fault) {
  let simulated = false, reads = 0;
  const provider = { async send(method, params) {
    if (method === 'eth_chainId') return fault === 'chain' ? '0x1' : '0xaa36a7';
    if (method === 'eth_getBlockByNumber') {
      reads++;
      return { number: '0xb7ac58', hash: fault === 'reorg' && reads > 1 ? '0xother' : '0xblock', timestamp: fault === 'fork' ? '0x0' : '0x6ae67de8', blockAccessListHash: '0xbal', slotNumber: '0x1', gasLimit: '0xbebc200' };
    }
    if (method === 'eth_getTransactionCount') return '0x0';
    if (method === 'eth_gasPrice') return '0x3b9aca00';
    assert.equal(method, 'eth_simulateV1', 'No signing or broadcast method permitted');
    simulated = true;
    assert.equal(params[0].validation, true);
    assert.equal(params[0].blockStateCalls.length, 1);
    assert.equal(params[0].blockStateCalls[0].stateOverrides, undefined, 'Production must use the real account balance');
    assert.equal(params[0].blockStateCalls[0].calls[0].data, tx.data);
    if (fault === 'unsupported') throw Error('Unsupported eth_simulateV1');
    return [{ calls: [{ status: fault === 'revert' ? '0x0' : '0x1', returnData: fault === 'runtime' ? '0xdead' : artifact.deployedBytecode, gasUsed: fault === 'usage' ? '0xfffffff' : '0x12c0000' }] }];
  } };
  const estimate = fault === 'budget' ? 30000000n : 19841860n;
  const result = await T.validateConstructor(provider, artifact, tx, sender, estimate, fault === 'stale-review' ? 19000000n : undefined);
  assert.equal(simulated, true);
  assert.equal(result.gasLimit, 21826046n);
  return result;
}
(async () => {
  await run();
  for (const fault of ['chain','fork','reorg','unsupported','revert','runtime','usage','budget','stale-review']) await assert.rejects(run(fault));
  console.log('PASS: transaction-validating constructor preflight; 9 fail-closed cases; no signing/broadcast; no production balance override.');
})().catch(e => { console.error(e); process.exitCode = 1; });
