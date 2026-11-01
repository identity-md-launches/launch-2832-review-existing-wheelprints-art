'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BrowserProvider, Contract, ContractFactory, Interface, ZeroAddress, keccak256 } = require('ethers');
const { compile, project } = require('../scripts/contract-toolchain.cjs');
const artifact = JSON.parse(fs.readFileSync(path.join(project, 'dist/testnet/contract-artifact.json'), 'utf8'));
const commitments = JSON.parse(fs.readFileSync(path.join(project, 'dist/testnet/commitments.json'), 'utf8'));
const baseURL = 'https://wheelprints.example/';
const os = require('node:os');
const localRuntime = fs.mkdtempSync(path.join(os.tmpdir(), 'wheelprints-evm-'));
process.env.XDG_CONFIG_HOME = path.join(localRuntime, 'config');
process.env.XDG_CACHE_HOME = path.join(localRuntime, 'cache');
process.env.XDG_DATA_HOME = path.join(localRuntime, 'data');
process.env.DO_NOT_TRACK = '1';
// env-paths ignores XDG_CONFIG_HOME on macOS. Keep this test process's
// Hardhat configuration/cache entirely inside its temporary directory.
const envPathsModule = require.resolve('env-paths');
require(envPathsModule);
require.cache[envPathsModule].exports = () => Object.fromEntries(
  ['config', 'cache', 'data', 'log', 'temp'].map(name => [name, path.join(localRuntime, name)])
);
const hardhat = require('hardhat');
const raw = hardhat.network.provider;
const provider = new BrowserProvider(raw, 'any', { cacheTimeout: -1, pollingInterval: 20 });
const iface = new Interface(artifact.abi);
const checks = [];
function mark(name) { checks.push(name); }
function revertData(error) {
  const value = error.data || error.info?.error?.data || error.error?.data;
  return typeof value === 'string' ? value : value?.data;
}
async function rejected(action, name) {
  let caught;
  try { const result = await action(); if (result && typeof result.wait === 'function') await result.wait(); }
  catch (error) { caught = error; }
  assert.ok(caught, 'Expected rejection: ' + (name || 'revert'));
  if (name) {
    let parsed;
    try { parsed = iface.parseError(revertData(caught)); } catch (_) {}
    assert.equal(parsed?.name || caught.revert?.name, name, 'Unexpected revert: ' + caught.shortMessage);
  }
}
async function main() {
  const alice = await provider.getSigner(0), bob = await provider.getSigner(1), carol = await provider.getSigner(2);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, alice);
  if (process.argv.includes('--wrong-chain')) {
    assert.equal(Number((await provider.getNetwork()).chainId), 1);
    await rejected(() => factory.deploy(baseURL), 'WrongChain');
    const at = '0x0000000000000000000000000000000000001000';
    await raw.send('hardhat_setCode', [at, artifact.deployedBytecode]);
    const injected = new Contract(at, artifact.abi, alice);
    await rejected(() => injected.mint(0), 'WrongChain');
    console.log('PASS: local chain-ID 1 rejects both deployment and mint. No external network used.');
    return;
  }
  assert.equal(Number((await provider.getNetwork()).chainId), 11155111);
  assert.ok(artifact.deployedBytecodeBytes <= 24576); assert.ok(artifact.bytecodeBytes + 288 < 49152);
  const compiled = compile(['contracts/test/MockSqueekCore.sol', 'contracts/test/MintReceivers.sol']);
  const mockArtifact = compiled.output.contracts['contracts/test/MockSqueekCore.sol'].MockSqueekCore;
  await rejected(() => factory.deploy(baseURL), 'SourceUnavailable');
  mark('Constructor rejects missing Core code');
  await raw.send('hardhat_setCode', [commitments.sourceCore, '0x' + mockArtifact.evm.deployedBytecode.object]);
  const mock = new Contract(commitments.sourceCore, mockArtifact.abi, alice);
  for (const invalid of ['', 'http://wheelprints.example/', 'https://wheelprints.example', 'https:///bad/', 'https://a.example/?x=1/', 'https://a.example/#x/', 'https://u:p@a.example/', 'https://a.example/"/', 'https://a.example/\\/', 'https://a.example/\n/', 'https://' + 'a'.repeat(195) + '/']) {
    await rejected(() => factory.deploy(invalid), 'InvalidBaseURL');
  }
  mark('Constructor rejects malformed or unsafe HTTPS base URL inputs');
  for (let fault = 1; fault <= 23; fault++) {
    await (await mock.setFault(fault)).wait();
    const error = fault <= 4 ? 'SourceConfigurationMismatch' : fault <= 7 ? 'SourceImplementationMismatch' : [8, 9, 23].includes(fault) ? 'SourceRoundIncomplete' : fault === 21 ? null : 'SourceSnapshotMismatch';
    await rejected(() => factory.deploy(baseURL), error);
  }
  mark('Constructor rejects all 23 configuration, implementation, completeness, endpoint, difficulty, checkpoint and block-count faults');
  await (await mock.setFault(0)).wait();
  await rejected(() => factory.deploy(baseURL, { value: 1n }));
  const deploymentRequest = await factory.getDeployTransaction(baseURL);
  const deployEstimate = await alice.estimateGas(deploymentRequest);
  const token = await factory.deploy(baseURL);
  await token.waitForDeployment();
  const deploymentReceipt = await token.deploymentTransaction().wait();
  const address = await token.getAddress();
  assert.equal(await provider.getCode(address), artifact.deployedBytecode);
  assert.equal(await token.totalSupply(), 0n);
  assert.equal(await token.name(), 'Wheelprints Sepolia Rehearsal');
  assert.equal(await token.symbol(), 'WPR-TEST');
  assert.equal(await token.artworkBaseURL(), baseURL);
  assert.equal(await token.CHAIN_ID(), 11155111n);
  assert.equal((await token.SOURCE_CORE()).toLowerCase(), commitments.sourceCore.toLowerCase());
  assert.equal(await token.rendererSourceHash(), commitments.rendererSourceSHA256);
  assert.equal(await token.rendererVersion(), commitments.rendererVersion);
  mark('Exact production runtime deploys within EVM limits and exposes pinned identity');
  for (const interfaceId of ['0x01ffc9a7', '0x80ac58cd', '0x5b5e139f']) assert.equal(await token.supportsInterface(interfaceId), true);
  assert.equal(await token.supportsInterface('0xffffffff'), false);
  const functionNames = artifact.abi.filter(entry => entry.type === 'function').map(entry => entry.name);
  for (const absent of ['owner', 'mintTo', 'ownerMint', 'setBaseURI', 'setTokenURI', 'setRenderer', 'upgradeTo', 'withdraw', 'transferOwnership']) assert.ok(!functionNames.includes(absent));
  mark('ERC721/metadata interfaces, no owner/admin mint or metadata/upgrade controls');
  await rejected(() => token.tokenURI(0), 'ERC721NonexistentToken');
  await rejected(() => token.tokenVariant(1), 'ERC721NonexistentToken');
  await rejected(() => token.snapshotInfo(3), 'InvalidSourceIndex');
  await rejected(() => token.variantInfo(27), 'InvalidVariant');
  await rejected(() => token.mint(27), 'InvalidVariant');
  await rejected(() => token.mint(0, { value: 1n }));
  await rejected(() => alice.sendTransaction({ to: address, value: 1n }));
  assert.equal(await provider.getBalance(address), 0n);
  mark('Invalid variants/tokens and native payments reject');

  const aliceAddress = await alice.getAddress(), bobAddress = await bob.getAddress(), carolAddress = await carol.getAddress();
  const mintGas = [];
  const first = await (await token.mint(0)).wait(); mintGas.push(first.gasUsed);
  assert.equal(await token.ownerOf(1), aliceAddress); assert.equal(await token.tokenVariant(1), 0n);
  assert.equal(await token.minted(aliceAddress, 0), true);
  await rejected(() => token.mint(0), 'AlreadyMinted');
  await (await token.transferFrom(aliceAddress, bobAddress, 1)).wait();
  assert.equal(await token.ownerOf(1), bobAddress);
  await rejected(() => token.mint(0), 'AlreadyMinted');
  const bobToken = token.connect(bob);
  await (await bobToken.mint(0)).wait();
  assert.equal(await token.ownerOf(2), bobAddress);
  assert.equal(await token.minted(bobAddress, 0), true);
  await (await bobToken.approve(carolAddress, 1)).wait();
  await (await token.connect(carol).transferFrom(bobAddress, carolAddress, 1)).wait();
  await rejected(() => token.transferFrom(bobAddress, aliceAddress, 2), 'ERC721InsufficientApproval');
  assert.equal(await token.ownerOf(1), carolAddress);
  mark('Mint recipient is caller; IDs start at 1; duplicates reject; transfers/approvals preserve original mint entitlement');

  const tokenByVariant = new Map([[0, 1n]]);
  for (let variant = 1; variant < 27; variant++) {
    const before = await token.totalSupply();
    const receipt = await (await token.mint(variant)).wait(); mintGas.push(receipt.gasUsed);
    tokenByVariant.set(variant, before + 1n);
  }
  assert.equal(await token.totalSupply(), 28n);
  for (const variant of commitments.variants) {
    const info = await token.variantInfo(variant.variantId);
    assert.equal(Number(info.sourceIndex), variant.sourceIndex); assert.equal(info.filename, path.basename(variant.svgPath));
    assert.equal(info.style, variant.style); assert.equal(info.palette, variant.palette);
    assert.equal(Number(info.visualSeed), variant.seed); assert.equal(info.svgSha256, variant.artworkSHA256);
    const tokenId = tokenByVariant.get(variant.variantId);
    const uri = await token.tokenURI(tokenId);
    assert.ok(uri.startsWith('data:application/json;base64,'));
    const oldRuntime = fs.readFileSync(path.join(__dirname, 'fixtures/runtime-v0.3.0.hex'), 'utf8').trim();
    await raw.send('hardhat_setCode', [address, oldRuntime]);
    assert.equal(await token.tokenURI(tokenId), uri, 'Compiler tuning must preserve exact tokenURI bytes');
    await raw.send('hardhat_setCode', [address, artifact.deployedBytecode]);
    const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
    assert.equal(json.image, baseURL + variant.svgPath);
    assert.equal(json.variant_id, variant.variantId); assert.equal(json.artwork_sha256, variant.artworkSHA256);
    assert.equal(json.renderer_source_sha256, commitments.rendererSourceSHA256); assert.equal(json.renderer_version, commitments.rendererVersion);
    assert.equal(json.source_stream_id, commitments.streamId); assert.equal(json.source_chain_id, 11155111);
    assert.equal(json.attributes.find(item => item.trait_type === 'Visual seed').value, '0x' + variant.seedHex);
  }
  mark('All 27 mints, getter commitments, base64 JSON URIs, hosted paths, original seeds and hashes match the release');

  for (const receiverName of ['ReentryReceiver', 'RejectingReceiver', 'NonReceiver']) {
    const receiverArtifact = compiled.output.contracts['contracts/test/MintReceivers.sol'][receiverName];
    const receiver = await new ContractFactory(receiverArtifact.abi, '0x' + receiverArtifact.evm.bytecode.object, alice).deploy();
    await receiver.waitForDeployment();
    const receiverAddress = await receiver.getAddress(), before = await token.totalSupply();
    if (receiverName === 'ReentryReceiver') {
      await (await receiver.mintFrom(address, 5)).wait();
      assert.equal(await receiver.entitlementSetDuringCallback(), true);
      assert.equal(await receiver.sameVariantBlocked(), true); assert.equal(await receiver.otherVariantBlocked(), true);
      assert.equal(await token.minted(receiverAddress, 5), true); assert.equal(await token.minted(receiverAddress, 6), false);
      assert.equal(await token.ownerOf(before + 1n), receiverAddress);
      assert.equal(await token.totalSupply(), before + 1n);
    } else {
      await rejected(() => receiver.mintFrom(address, 0));
      assert.equal(await token.minted(receiverAddress, 0), false); assert.equal(await token.totalSupply(), before);
    }
  }
  mark('ERC721Receiver callbacks see effects; same/different-variant reentry rejects; rejecting/non-receivers roll back IDs and entitlement');
  const preservedURI = await token.tokenURI(1);
  await (await mock.setFault(21)).wait();
  assert.equal(await token.tokenURI(1), preservedURI);
  for (let i = 0; i < 3; i++) {
    const actual = await token.snapshotInfo(i), expected = commitments.sourceSnapshots[i];
    for (const [field, value] of Object.entries(expected)) assert.equal(String(actual[field]).toLowerCase(), String(value).toLowerCase());
  }
  mark('Pinned snapshots and tokenURI survive later source read failure without live Core dependency');

  const shared = require('../dist/testnet/shared.js');
  shared.validateCommitments(commitments);
  await shared.verifyContract(provider, address, { artifact, commitments }, baseURL);
  const bad = structuredClone(commitments); bad.variants[7].artworkSHA256 = '0x' + '11'.repeat(32);
  await assert.rejects(() => shared.verifyContract(provider, address, { artifact, commitments: bad }, baseURL), /commitment mismatch/);
  mark('Actual frontend shared.verifyContract accepts deployed production code/all 27 variants/3 snapshots and rejects a changed commitment');
  const wrongChain = spawnSync(process.execPath, [__filename, '--wrong-chain'], {
    cwd: project, env: { ...process.env, WHEELPRINTS_TEST_CHAIN_ID: '1' }, encoding: 'utf8', timeout: 60000
  });
  assert.equal(wrongChain.status, 0, wrongChain.stdout + wrongChain.stderr);
  mark('Local wrong-chain process rejects deployment and mint');
  const tokenURIGas = await token.tokenURI.estimateGas(1);
  const report = {
    scope: 'Local in-process Hardhat EVM; no external deployment or transaction broadcast.',
    result: 'passed', checks, compiler: artifact.compiler.version,
    dependencies: { ...artifact.dependencies, hardhat: require('hardhat/package.json').version },
    localChainId: 11155111, hardfork: 'cancun', runtimeBytes: artifact.deployedBytecodeBytes, initcodeBytes: artifact.bytecodeBytes,
    runtimeKeccak256: keccak256(await provider.getCode(address)),
    gas: { deploymentEstimate: deployEstimate.toString(), deploymentUsed: deploymentReceipt.gasUsed.toString(),
      firstMintUsed: mintGas[0].toString(), minMintUsed: mintGas.reduce((a,b)=>a<b?a:b).toString(), maxMintUsed: mintGas.reduce((a,b)=>a>b?a:b).toString(), tokenURIReadEstimate: tokenURIGas.toString() },
    testOnlyNotes: 'Fault-injecting Core and ERC721Receiver fixtures are never included in the production artifact. Ephemeral local signing keys stay in memory and are not saved.',
    publicNetworkSimulation: 'Separate read-only constructor eth_call preflight; no deployment is claimed here.'
  };
  fs.writeFileSync(path.join(project, 'contracts/test-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: ' + checks.length + ' grouped contract/EVM checks, including 23 source fault cases, 27 minted variants, receiver reentry/rollback, and real frontend verification.');
  console.log(JSON.stringify(report.gas));
  console.log('Runtime ' + report.runtimeBytes + ' bytes; initcode ' + report.initcodeBytes + ' bytes. No transaction broadcast outside local EVM.');
}
main().then(() => provider.destroy()).catch(error => { console.error(error); provider.destroy(); process.exitCode = 1; });
