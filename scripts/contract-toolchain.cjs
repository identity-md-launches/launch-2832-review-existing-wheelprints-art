'use strict';
const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');
const project = path.resolve(__dirname, '..');
const settings = {
  // Favor deployment size: Sepolia charges state gas per byte.
  optimizer: { enabled: true, runs: 1 }, viaIR: true, evmVersion: 'cancun',
  metadata: { bytecodeHash: 'ipfs', useLiteralContent: true },
  outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates', 'metadata', 'storageLayout'], '': ['ast'] } }
};
function compile(entryFiles) {
  const sources = {};
  function collect(name) {
    if (sources[name]) return;
    const location = name.startsWith('@openzeppelin/') ? path.join(project, 'node_modules', name) : path.join(project, name);
    if (!name.startsWith('@openzeppelin/') && !name.startsWith('contracts/')) throw new Error('Unsupported compiler import: ' + name);
    const content = fs.readFileSync(location, 'utf8');
    sources[name] = { content };
    for (const item of content.matchAll(/import\s+(?:[^;]*?\sfrom\s+)?["']([^"']+)["']\s*;/g)) {
      const imported = item[1].startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(name), item[1])) : item[1];
      collect(imported);
    }
  }
  entryFiles.forEach(collect);
  const input = { language: 'Solidity', sources, settings };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(item => item.severity === 'error');
  if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join('\n'));
  return { input, output, warnings: (output.errors || []).filter(item => item.severity !== 'error'), compilerVersion: solc.version() };
}
module.exports = { compile, settings, project };
