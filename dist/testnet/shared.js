(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WheelprintsTestnet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var CHAIN_ID = 11155111;
  var CHAIN_HEX = '0xaa36a7';
  var EXPLORER = 'https://sepolia.etherscan.io';
  var STYLES = ['orbit', 'current', 'bloom'];
  var PALETTES = ['mineral', 'ember', 'midnight'];
  var RECORDS = ['round-539', 'round-517', 'round-499'];
  function eth() { return root.ethers || (typeof require === 'function' ? require('ethers') : null); }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function lower(value) { return String(value).toLowerCase(); }
  function same(a, b) { return lower(a) === lower(b); }
  function hexHash(value) { var s = String(value); return s.startsWith('0x') ? s.toLowerCase() : '0x' + s.toLowerCase(); }
  function address(value) { return eth().getAddress(value); }
  function variantId(recordIndex, styleIndex, paletteIndex) {
    [recordIndex, styleIndex, paletteIndex].forEach(function (n) { assert(Number.isInteger(n) && n >= 0 && n < 3, 'Choose a supported record, form and palette.'); });
    return recordIndex * 9 + styleIndex * 3 + paletteIndex;
  }
  function selection(search) {
    var params = new URLSearchParams(search);
    function find(list, name) { return Math.max(0, list.indexOf(params.get(name))); }
    return { record: find(RECORDS, 'record'), form: find(STYLES, 'form'), palette: find(PALETTES, 'palette') };
  }
  function compositionQuery(id) {
    assert(Number.isInteger(id) && id >= 0 && id < 27, 'Unsupported print.');
    return new URLSearchParams({ record: RECORDS[Math.floor(id / 9)], form: STYLES[Math.floor(id % 9 / 3)], palette: PALETTES[id % 3] }).toString();
  }
  function validBaseURL(value) {
    var url;
    try { url = new URL(value); } catch (_) { throw new Error('The artwork location must be a complete HTTPS URL.'); }
    assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, 'Use a public HTTPS artwork directory without credentials, a query, or a fragment.');
    assert(url.pathname.endsWith('/'), 'The artwork site URL must end with /.');
    assert(url.href === value, 'Use the normalized artwork directory shown on this page.');
    return url.href;
  }
  async function fetchFile(url, binary) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      assert(response.ok, 'Could not load ' + new URL(url, root.location && root.location.href).pathname + ' (HTTP ' + response.status + ').');
      return binary ? new Uint8Array(await response.arrayBuffer()) : await response.json();
    } finally { clearTimeout(timer); }
  }
  async function fileHash(url) { return eth().sha256(await fetchFile(url, true)); }
  function errorMessage(error) {
    var code = error && (error.code || error.info && error.info.error && error.info.error.code);
    if (code === 4001 || code === 'ACTION_REJECTED') return 'The wallet request was declined. No new transaction was confirmed by this page.';
    if (code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs Sepolia test ETH for network gas.';
    if (code === 'TIMEOUT') return 'The confirmation is taking longer than expected. Keep the transaction hash and check its receipt before retrying.';
    var message = error && (error.reason || error.shortMessage || error.message) || 'The request could not be completed.';
    // Ethers may label an RPC transport failure "missing revert data". Inspect
    // the nested message only to classify it; never display request bodies/keys.
    var details = [message, error && error.message, error && error.error && error.error.message, error && error.info && error.info.error && error.info.error.message].join(' ');
    if (/\b429\b|rate[ -]?limit|too many requests/i.test(details)) return 'The network service is rate limiting requests. Wait a moment, then review the mint again. If a transaction was submitted, check its link before retrying.';
    if (/AlreadyMinted|already minted/i.test(message)) return 'This wallet has already minted this composition in the rehearsal.';
    if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return 'A required file or network response could not be reached. The transaction remains disabled.';
    return String(message).slice(0, 420);
  }
  function validateDeployment(config) {
    assert(config && config.schemaVersion === 1, 'The deployment configuration has an unsupported format.');
    assert(Number(config.chainId) === CHAIN_ID, 'This release only accepts a Sepolia deployment.');
    if (!config.contractAddress) {
      assert(config.status === 'not-deployed', 'The deployment configuration is incomplete.');
      return null;
    }
    assert(config.status === 'deployed', 'The deployment has not been marked as confirmed.');
    assert(/^0x[0-9a-fA-F]{64}$/.test(config.transactionHash || ''), 'The deployment transaction hash is missing or invalid.');
    validBaseURL(config.artworkBaseURL);
    return address(config.contractAddress);
  }
  function matchRuntime(actual, artifact) {
    var expected = artifact.deployedBytecode;
    if (expected && typeof expected === 'object') expected = expected.object;
    assert(typeof expected === 'string' && expected.length > 2, 'The release artifact has no runtime bytecode.');
    expected = expected.replace(/^0x/, '').toLowerCase();
    actual = String(actual).replace(/^0x/, '').toLowerCase();
    assert(actual.length === expected.length && actual.length > 0, 'The configured address does not contain this release’s contract code.');
    var refs = artifact.immutableReferences || {};
    var spans = Object.values(refs).flat();
    spans.forEach(function (ref) {
      var from = ref.start * 2, to = from + ref.length * 2;
      assert(Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to <= expected.length, 'Invalid immutable references in the release artifact.');
      actual = actual.slice(0, from) + '0'.repeat(to - from) + actual.slice(to);
      expected = expected.slice(0, from) + '0'.repeat(to - from) + expected.slice(to);
    });
    assert(actual === expected, 'The configured contract code differs from this tested release.');
    return true;
  }
  function validateCommitments(c) {
    assert(c && Number(c.chainId) === CHAIN_ID && Array.isArray(c.variants) && c.variants.length === 27, 'The release commitments are incomplete or use the wrong network.');
    address(c.sourceCore);
    assert(/^0x[0-9a-fA-F]{64}$/.test(c.streamId), 'Invalid source stream identity.');
    assert(/^0x[0-9a-f]{64}$/.test(hexHash(c.rendererSourceSHA256)), 'Invalid renderer fingerprint.');
    assert(Array.isArray(c.sourceSnapshots) && c.sourceSnapshots.length === 3, 'The three source snapshots are required.');
    c.variants.forEach(function (v, i) {
      var sourceIndex = Math.floor(i / 9), style = STYLES[Math.floor(i % 9 / 3)], palette = PALETTES[i % 3];
      assert(v.variantId === i && v.sourceIndex === sourceIndex && v.recordId === RECORDS[sourceIndex] && v.style === style && v.palette === palette, 'The print ordering differs from this release.');
      assert(/^exports\/Wheelprints_(Drift|Pulse|Surge)_(orbit|current|bloom)_(mineral|ember|midnight)\.svg$/.test(v.svgPath), 'Invalid SVG path in the release.');
      assert(v.pngPath === v.svgPath.replace(/\.svg$/, '.png'), 'The print image paths do not match.');
      assert(/^0x[0-9a-f]{64}$/.test(hexHash(v.artworkSHA256)), 'Invalid artwork fingerprint.');
      assert(Number.isInteger(Number(v.seed)) && Number(v.seed) >= 0 && Number(v.seed) <= 4294967295, 'Invalid visual seed.');
    });
    return c;
  }
  async function loadRelease(base) {
    var at = base || document.baseURI;
    var result = await Promise.all([fetchFile(new URL('contract-artifact.json', at).href, false), fetchFile(new URL('commitments.json', at).href, false), fetchFile(new URL('release-status.json', at).href, false)]);
    assert(result[0] && Array.isArray(result[0].abi) && typeof result[0].bytecode === 'string', 'The compiler artifact is unavailable.');
    validateCommitments(result[1]);
    assert(result[2] && result[2].schemaVersion === 1 && typeof result[2].deploymentEnabled === 'boolean', 'The release readiness record is missing or invalid.');
    return { artifact: result[0], commitments: result[1], gate: result[2], base: new URL('../', at).href };
  }
  async function verifyContract(provider, contractAddress, bundle, expectedBaseURL) {
    var network = await provider.getNetwork();
    assert(Number(network.chainId) === CHAIN_ID, 'The contract must be checked on Sepolia.');
    var normalized = address(contractAddress), c = bundle.commitments;
    var code = await provider.getCode(normalized);
    matchRuntime(code, bundle.artifact);
    var contract = new (eth().Contract)(normalized, bundle.artifact.abi, provider);
    var identity = await Promise.all([contract.CHAIN_ID(), contract.SOURCE_CORE(), contract.streamId(), contract.rendererSourceHash(), contract.rendererVersion(), contract.artworkBaseURL()]);
    assert(Number(identity[0]) === CHAIN_ID && same(identity[1], c.sourceCore) && same(identity[2], c.streamId), 'The contract source identity differs from this release.');
    assert(same(identity[3], hexHash(c.rendererSourceSHA256)) && identity[4] === c.rendererVersion, 'The contract renderer differs from this release.');
    validBaseURL(identity[5]);
    if (expectedBaseURL) assert(identity[5] === expectedBaseURL, 'The contract artwork location differs from the deployment configuration.');
    var variants = await Promise.all(c.variants.map(function (v) { return contract.variantInfo(v.variantId); }));
    variants.forEach(function (actual, i) {
      var expected = c.variants[i];
      assert(Number(actual.sourceIndex) === expected.sourceIndex && actual.filename === expected.svgPath.split('/').pop() && actual.style === expected.style && actual.palette === expected.palette && Number(actual.visualSeed) === Number(expected.seed) && same(actual.svgSha256, hexHash(expected.artworkSHA256)), 'Contract artwork commitment mismatch for variant ' + i + '.');
    });
    var snapshots = await Promise.all([contract.snapshotInfo(0), contract.snapshotInfo(1), contract.snapshotInfo(2)]);
    var fields = ['roundId', 'startTimestamp', 'endTimestamp', 'work', 'completedBlocks', 'cumulativeWorkBefore', 'cumulativeWorkAfter', 'cumulativeBlockUnitsBefore', 'cumulativeBlockUnitsAfter', 'difficultyBefore', 'difficultyAfter', 'dataHash'];
    snapshots.forEach(function (actual, i) {
      var expected = c.sourceSnapshots[i];
      fields.forEach(function (field) { assert(expected[field] !== undefined && same(actual[field], expected[field]), 'Contract source snapshot mismatch at study ' + i + ', ' + field + '.'); });
    });
    return { contract: contract, address: normalized, artworkBaseURL: identity[5], runtimeCodeHash: eth().keccak256(code) };
  }
  async function verifyArtwork(bundle, variant, baseURL) {
    var url = new URL(variant.svgPath, baseURL || bundle.base).href;
    assert(same(await fileHash(url), hexHash(variant.artworkSHA256)), 'The hosted SVG bytes do not match the fingerprint saved for this print. Minting is blocked.');
    return url;
  }
  async function verifySource(provider, commitments) {
    var blockNumber = await provider.getBlockNumber();
    var slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    var implementation = '0x284747c4664af2203e7a90a2ee76f22b6b5e6889';
    var checks = await Promise.all([provider.getStorage(commitments.sourceCore, slot, blockNumber), provider.getCode(commitments.sourceCore, blockNumber), provider.getCode(implementation, blockNumber)]);
    assert(same('0x' + checks[0].slice(-40), implementation), 'The observed Core implementation changed. Review the integration before deploying.');
    assert(same(eth().keccak256(checks[1]), '0xeeb464727c2e09e309498a29e09c432fe9f0b6b4177f040ee2b517af64a32c36'), 'The observed Core proxy code changed. Deployment is blocked.');
    assert(same(eth().keccak256(checks[2]), '0xd8f2fb3c7dcf63e6dc0378ce5f85ceea52a876ae1f0cd66ac8631c3103371f8a'), 'The observed Core implementation code changed. Deployment is blocked.');
    return { blockNumber: blockNumber, implementation: address(implementation) };
  }
  function createSession(injected, onChange) {
    assert(injected && typeof injected.request === 'function', 'Open this HTTPS page in a browser with an injected Ethereum wallet, such as MetaMask.');
    var s = { injected: injected, account: null, chainId: null, revision: 0, provider: null };
    async function refresh() {
      var result = await Promise.all([injected.request({ method: 'eth_accounts' }), injected.request({ method: 'eth_chainId' })]);
      var nextAccount = result[0][0] ? address(result[0][0]) : null;
      var nextChain = Number(BigInt(result[1]));
      if (nextAccount !== s.account || nextChain !== s.chainId) { s.revision++; s.provider = null; }
      s.account = nextAccount; s.chainId = nextChain;
      if (onChange) onChange(s);
      return s;
    }
    s.refresh = refresh;
    s.connect = async function () { await injected.request({ method: 'eth_requestAccounts' }); return refresh(); };
    s.switchNetwork = async function () {
      try { await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); }
      catch (error) {
        var code = error.code || error.data && error.data.originalError && error.data.originalError.code;
        if (code !== 4902) throw error;
        await injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'Ethereum Sepolia', nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'], blockExplorerUrls: [EXPLORER] }] });
      }
      return refresh();
    };
    s.snapshot = function () { return { account: s.account, chainId: s.chainId, revision: s.revision }; };
    s.assertCurrent = async function (snapshot) {
      await refresh();
      assert(s.account, 'Connect your wallet first.');
      assert(s.chainId === CHAIN_ID, 'Switch your wallet to Sepolia before continuing.');
      if (snapshot) assert(snapshot.account === s.account && snapshot.chainId === s.chainId && snapshot.revision === s.revision, 'Your wallet account or network changed. Review this transaction again.');
      return s.snapshot();
    };
    s.getProvider = function () { if (!s.provider) s.provider = new (eth().BrowserProvider)(injected, 'any'); return s.provider; };
    s.getSigner = async function () { await s.assertCurrent(); return s.getProvider().getSigner(s.account); };
    if (typeof injected.on === 'function') {
      var changed = function () { s.revision++; s.provider = null; refresh().catch(function () { s.account = null; s.chainId = null; if (onChange) onChange(s); }); };
      injected.on('accountsChanged', changed); injected.on('chainChanged', changed);
      injected.on('disconnect', function () { s.revision++; s.account = null; s.chainId = null; s.provider = null; if (onChange) onChange(s); });
    }
    return s;
  }
  function walletLabel(session) { return session && session.account ? session.account + ' · ' + (session.chainId === CHAIN_ID ? 'Sepolia' : 'Network ' + session.chainId) : 'Wallet disconnected'; }
  async function readProvider() {
    var provider = new (eth().JsonRpcProvider)('https://ethereum-sepolia-rpc.publicnode.com', CHAIN_ID);
    assert(Number((await provider.getNetwork()).chainId) === CHAIN_ID, 'The confirmation provider is not on Sepolia. Keep the transaction hash and check its receipt.');
    return provider;
  }
  function fillDetails(element, rows) {
    element.replaceChildren();
    rows.forEach(function (row) { var div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = row[0]; dd.textContent = row[1]; div.append(dt, dd); element.append(div); });
  }
  function addLink(element, label, url, download) {
    var a = document.createElement('a'); a.textContent = label; a.href = url;
    if (download) a.download = download; else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    element.appendChild(a); return a;
  }
  async function gasEstimate(provider, signer, tx) {
    var result = await Promise.all([signer.estimateGas(tx), provider.getFeeData()]);
    var price = result[1].maxFeePerGas || result[1].gasPrice;
    return { units: result[0], text: price ? eth().formatEther(result[0] * price) + ' Sepolia ETH (estimate)' : result[0].toString() + ' gas units' };
  }
  // EIP-8037 on Sepolia: the EIP-7825 cap applies to execution gas only.
  // Require transaction validation; an oversized eth_call is insufficient.
  async function validateConstructor(provider, artifact, tx, from, estimate, reviewedLimit) {
    assert(BigInt(await provider.send('eth_chainId', [])) === BigInt(CHAIN_ID), 'Constructor validation requires Sepolia.');
    assert(!tx.to && BigInt(tx.value || 0) === 0n && String(tx.data).startsWith(artifact.bytecode), 'Expected a zero-value creation for this artifact.');
    estimate = BigInt(estimate);
    assert(estimate > 0n, 'Invalid deployment estimate.');
    var gasLimit = reviewedLimit == null ? (estimate * 110n + 99n) / 100n : BigInt(reviewedLimit);
    // Project cost budget, distinct from the protocol execution cap.
    assert(gasLimit >= estimate && gasLimit <= 30000000n, 'Deployment exceeds the reviewed 30 million total-gas budget. Recheck the release.');
    var block = await provider.send('eth_getBlockByNumber', ['latest', false]);
    assert(block && BigInt(block.timestamp) >= 1791294816n && block.blockAccessListHash && block.slotNumber, 'Cannot confirm the expected Sepolia fork.');
    assert(gasLimit <= BigInt(block.gasLimit), 'Deployment exceeds the current block budget.');
    var sender = address(from), hex = eth().toQuantity;
    var nonce = await provider.send('eth_getTransactionCount', [sender, block.number]);
    var gasPrice = await provider.send('eth_gasPrice', []);
    var call = { from: sender, data: tx.data, value: '0x0', gas: hex(gasLimit), nonce: nonce, gasPrice: gasPrice };
    var result = await provider.send('eth_simulateV1', [{ blockStateCalls: [{ calls: [call] }], validation: true, traceTransfers: false }, block.number]);
    var outcome = result && result.length === 1 && result[0].calls && result[0].calls.length === 1 && result[0].calls[0];
    assert(outcome && outcome.status === '0x1', 'Transaction-validating constructor simulation failed. Deployment remains disabled.');
    assert(same(outcome.returnData, artifact.deployedBytecode), 'Constructor simulation returned a different runtime.');
    assert(BigInt(outcome.gasUsed) > 0n && BigInt(outcome.gasUsed) <= gasLimit, 'Invalid simulated deployment gas usage.');
    var pinned = await provider.send('eth_getBlockByNumber', [block.number, false]);
    assert(pinned && same(pinned.hash, block.hash), 'Sepolia changed during validation. Check the release again.');
    return { gasLimit: gasLimit, gasUsed: BigInt(outcome.gasUsed), blockNumber: block.number, blockHash: block.hash, validation: true };
  }
  function savePending(key, data) { try { root.localStorage.setItem('wheelprints:sepolia:' + key, JSON.stringify(data)); } catch (_) {} }
  function pending(key) { try { return JSON.parse(root.localStorage.getItem('wheelprints:sepolia:' + key) || 'null'); } catch (_) { return null; } }
  return Object.freeze({ CHAIN_ID: CHAIN_ID, CHAIN_HEX: CHAIN_HEX, EXPLORER: EXPLORER, STYLES: STYLES, PALETTES: PALETTES, RECORDS: RECORDS, eth: eth, assert: assert, same: same, hexHash: hexHash, address: address, variantId: variantId, selection: selection, compositionQuery: compositionQuery, validBaseURL: validBaseURL, fetchJSON: function (url) { return fetchFile(url, false); }, fileHash: fileHash, errorMessage: errorMessage, validateDeployment: validateDeployment, validateCommitments: validateCommitments, loadRelease: loadRelease, verifyContract: verifyContract, verifyArtwork: verifyArtwork, verifySource: verifySource, matchRuntime: matchRuntime, createSession: createSession, walletLabel: walletLabel, readProvider: readProvider, fillDetails: fillDetails, addLink: addLink, gasEstimate: gasEstimate, validateConstructor: validateConstructor, savePending: savePending, pending: pending });
});
