'use strict';
// In-process local EVM only. No HTTP networks or real signing keys are configured.
const { Wallet } = require('ethers');
module.exports = {
  networks: {
    hardhat: {
      chainId: Number(process.env.WHEELPRINTS_TEST_CHAIN_ID || 11155111),
      hardfork: 'cancun', initialDate: '2026-11-01T00:00:00.000Z',
      blockGasLimit: 30000000, allowUnlimitedContractSize: false,
      accounts: Array.from({ length: 6 }, () => ({ privateKey: Wallet.createRandom().privateKey, balance: '1000000000000000000000' }))
    }
  }
};
