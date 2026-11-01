(function () {
  'use strict';
  var T = window.WheelprintsTestnet, $ = function (id) { return document.getElementById(id); };
  var bundle, session, review, busy = false, configBlobURL;
  var baseURL = new URL('../', document.baseURI).href;
  var releaseHost = location.protocol === 'https:' && !location.hostname.endsWith('.chatgpt.site');
  $('base-url').value = baseURL;
  function say(id, text, error) { $(id).textContent = text; $(id).classList.toggle('error', !!error); }
  function updateButtons() {
    var ready = !!(session && session.account && session.chainId === T.CHAIN_ID);
    $('wallet-status').textContent = T.walletLabel(session);
    $('connect-wallet').disabled = busy || !bundle || !releaseHost;
    $('connect-wallet').textContent = session && session.account ? 'Refresh wallet' : 'Connect wallet';
    $('switch-network').hidden = !(session && session.account && session.chainId !== T.CHAIN_ID);
    $('switch-network').disabled = busy;
    $('prepare-deploy').disabled = busy || !bundle || !bundle.gate.deploymentEnabled || !ready || !releaseHost;
    $('recover-deploy').disabled = busy || !bundle || !ready || !releaseHost;
    $('confirm-deploy').disabled = busy || !review || !ready || !bundle || !bundle.gate.deploymentEnabled || !$('accept-testnet').checked;
  }
  function invalidate() { review = null; $('deployment-review').hidden = true; $('accept-testnet').checked = false; updateButtons(); }
  function changedWallet(s) { session = s; if (review && review.wallet.revision !== s.revision) { invalidate(); say('setup-status', 'Wallet changed. Check the release and estimate again.'); } updateButtons(); }
  function getSession() { if (!session) session = T.createSession(window.ethereum, changedWallet); return session; }
  async function run(task, errorId) { if (busy) return; busy = true; updateButtons(); try { await task(); } catch (error) { say(errorId || 'setup-status', T.errorMessage(error), true); } finally { busy = false; updateButtons(); } }
  function enforceReleaseHost() {
    T.validBaseURL(baseURL);
    T.assert(!location.hostname.endsWith('.chatgpt.site'), 'Deploy this contract from your intended public Cloudflare website. The private review Site must not become the permanent artwork URL.');
  }
  async function checkAssets() {
    var c = bundle.commitments;
    T.assert(T.same(await T.fileHash(new URL('art-engine.js', baseURL).href), T.hexHash(c.rendererSourceSHA256)), 'The hosted renderer does not match the release fingerprint.');
    // Limit concurrent SVG downloads; checks cover exact hosted bytes, not just a manifest.
    for (var start = 0; start < c.variants.length; start += 3) {
      await Promise.all(c.variants.slice(start, start + 3).map(function (v) { return T.verifyArtwork(bundle, v, baseURL); }));
      say('setup-status', 'Checking artwork files: ' + Math.min(start + 3, 27) + ' / 27 matched.');
    }
  }
  async function prepare() {
    invalidate(); T.assert(bundle.gate.deploymentEnabled, bundle.gate.reason || 'Deployment is disabled pending release checks.'); enforceReleaseHost();
    var s = getSession(), wallet = await s.assertCurrent(), provider = s.getProvider();
    say('setup-status', 'Checking the observed Sepolia source and hosted release files…');
    var sourceCheck = await T.verifySource(provider, bundle.commitments);
    await checkAssets();
    await s.assertCurrent(wallet);
    var signer = await s.getSigner();
    var factory = new (T.eth().ContractFactory)(bundle.artifact.abi, bundle.artifact.bytecode, signer);
    var tx = await factory.getDeployTransaction(baseURL); tx.chainId = T.CHAIN_ID; tx.value = 0n;
    var gas = await T.gasEstimate(provider, signer, tx);
    var reader = await T.readProvider();
    var validation = await T.validateConstructor(reader, bundle.artifact, tx, wallet.account, gas.units);
    tx.gasLimit = validation.gasLimit;
    await s.assertCurrent(wallet);
    review = { wallet: wallet, tx: tx, baseURL: baseURL, sourceCheck: sourceCheck };
    T.fillDetails($('deployment-fields'), [['Network', 'Ethereum Sepolia · 11155111'], ['Deployer', wallet.account], ['Artwork site', baseURL], ['Collection', 'Wheelprints Sepolia rehearsal · 27 reusable art variants'], ['Mint policy', '0 mint price · one of each variant per wallet'], ['Source Core', bundle.commitments.sourceCore], ['Source check', 'Block ' + sourceCheck.blockNumber], ['Network gas', gas.text], ['Reviewed gas limit', validation.gasLimit.toString()], ['Transaction validation', 'Passed at Sepolia block ' + BigInt(validation.blockNumber).toString()], ['Storage', 'Onchain snapshots, fingerprints and JSON metadata; hosted SVG images']]);
    $('deployment-review').hidden = false;
    say('setup-status', 'Release checks passed and the constructor simulation succeeded. Review the deployment below.');
    say('deploy-status', 'The contract is not deployed yet.');
  }
  async function completedReceipt(receipt, provider, requestedHash) {
    T.assert(receipt && Number(receipt.status) === 1 && receipt.contractAddress, 'This transaction has no successful contract-creation receipt. Do not retry before checking its outcome.');
    T.assert(Number((await provider.getNetwork()).chainId) === T.CHAIN_ID, 'Recover this transaction on Sepolia.');
    var transaction = await provider.getTransaction(requestedHash);
    T.assert(transaction && !transaction.to && Number(transaction.chainId) === T.CHAIN_ID && transaction.value === 0n, 'This is not the expected zero-value Sepolia contract creation.');
    var factory = new (T.eth().ContractFactory)(bundle.artifact.abi, bundle.artifact.bytecode);
    var expected = await factory.getDeployTransaction(baseURL);
    T.assert(T.same(transaction.data, expected.data), 'The deployment transaction does not match this build and artwork URL.');
    var verified = await T.verifyContract(provider, receipt.contractAddress, bundle, baseURL);
    var config = {
      schemaVersion: 1, chainId: T.CHAIN_ID, status: 'deployed', contractAddress: verified.address,
      transactionHash: receipt.hash || requestedHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
      deployer: transaction.from, artworkBaseURL: verified.artworkBaseURL, runtimeCodeHash: verified.runtimeCodeHash,
      rendererSourceSHA256: T.hexHash(bundle.commitments.rendererSourceSHA256), rendererVersion: bundle.commitments.rendererVersion,
      sourceCore: bundle.commitments.sourceCore, verifiedAt: new Date().toISOString(),
      notice: 'Sepolia rehearsal only. JSON metadata and artwork fingerprints are onchain; SVG images are hosted. No mainnet token or reward is promised.'
    };
    var text = JSON.stringify(config, null, 2) + '\n';
    if (configBlobURL) URL.revokeObjectURL(configBlobURL);
    configBlobURL = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var links = $('deployment-links'); links.replaceChildren();
    T.addLink(links, 'Download deployment.json ↓', configBlobURL, 'deployment.json');
    T.addLink(links, 'View contract ↗', T.EXPLORER + '/address/' + verified.address);
    T.addLink(links, 'View deployment transaction ↗', T.EXPLORER + '/tx/' + requestedHash);
    $('deployment-json').value = text;
    $('deployment-confirmation').textContent = 'Confirmed on Sepolia: ' + verified.address + '. Runtime code, all 27 variants, and all three source snapshots match this release.';
    $('deployment-result').hidden = false;
    T.savePending('deployment', { hash: requestedHash, contractAddress: verified.address, baseURL: baseURL, confirmed: true });
    $('recovery-hash').value = requestedHash;
    say('deploy-status', 'Deployment confirmed. Save the configuration below and upload it with the website.');
    return config;
  }
  async function confirm() {
    var saved = review; T.assert(saved && $('accept-testnet').checked, 'Review and acknowledge the test deployment first.');
    T.assert(bundle.gate.deploymentEnabled, bundle.gate.reason || 'Deployment is disabled pending release checks.');
    enforceReleaseHost();
    var s = getSession(); await s.assertCurrent(saved.wallet);
    var provider = s.getProvider();
    await T.verifySource(provider, bundle.commitments);
    await s.assertCurrent(saved.wallet);
    var signer = await s.getSigner();
    var freshEstimate = await signer.estimateGas(saved.tx);
    await T.validateConstructor(await T.readProvider(), bundle.artifact, saved.tx, saved.wallet.account, freshEstimate, saved.tx.gasLimit);
    await s.assertCurrent(saved.wallet);
    say('deploy-status', 'Review the Sepolia contract-creation transaction in your wallet.');
    var tx = await signer.sendTransaction(saved.tx);
    T.savePending('deployment', { hash: tx.hash, baseURL: baseURL, confirmed: false });
    $('recovery-hash').value = tx.hash;
    review = null; $('accept-testnet').checked = false;
    say('deploy-status', 'Submitted ' + tx.hash + '. Waiting for a successful Sepolia receipt. Keep this hash if you close the page.');
    var receipt, confirmationProvider;
    try { confirmationProvider = await T.readProvider(); receipt = await confirmationProvider.waitForTransaction(tx.hash, 1, 90000); }
    catch (error) { say('deploy-status', 'The deployment was submitted as ' + tx.hash + ', but confirmation could not be read. Use Check deployment receipt before deploying again. ' + T.errorMessage(error), true); return; }
    if (!receipt) { say('deploy-status', 'Confirmation is still pending. Use Check deployment receipt with the saved hash; do not deploy another copy yet.'); return; }
    await completedReceipt(receipt, confirmationProvider, tx.hash);
  }
  async function recover() {
    enforceReleaseHost();
    var hash = $('recovery-hash').value.trim();
    T.assert(/^0x[0-9a-fA-F]{64}$/.test(hash), 'Enter a complete Sepolia transaction hash.');
    var s = getSession(); await s.assertCurrent();
    var provider = await T.readProvider(), receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) { say('recovery-status', 'No receipt is available yet. The transaction may still be pending or this may be the wrong hash. Check the wallet before sending another deployment.'); return; }
    await completedReceipt(receipt, provider, hash);
    say('recovery-status', 'The deployment is confirmed and its configuration is ready above.');
  }
  $('connect-wallet').addEventListener('click', function () { run(async function () { await getSession().connect(); invalidate(); say('setup-status', session.chainId === T.CHAIN_ID ? 'Wallet connected to Sepolia. Check the release and estimate next.' : 'Wallet connected. Switch to Sepolia to continue.'); }); });
  $('switch-network').addEventListener('click', function () { run(async function () { await getSession().switchNetwork(); invalidate(); say('setup-status', 'Network checked. Continue when the wallet shows Sepolia.'); }); });
  $('prepare-deploy').addEventListener('click', function () { run(prepare); });
  $('accept-testnet').addEventListener('change', updateButtons);
  $('confirm-deploy').addEventListener('click', function () { run(confirm, 'deploy-status'); });
  $('recover-deploy').addEventListener('click', function () { run(recover, 'recovery-status'); });
  (async function () {
    try {
      T.assert(window.ethers, 'The local wallet library could not load.');
      bundle = await T.loadRelease();
      say('setup-status', 'Release artifacts loaded. No contract has been deployed by loading this page.');
      var saved = T.pending('deployment');
      if (saved && saved.baseURL === baseURL && /^0x[0-9a-fA-F]{64}$/.test(saved.hash)) {
        $('recovery-hash').value = saved.hash;
        say('recovery-status', 'A deployment transaction was saved from this browser. Check its receipt before deploying again.');
      }
      if (!bundle.gate.deploymentEnabled) say('setup-status', 'Deployment paused: ' + bundle.gate.reason);
      else if (location.protocol !== 'https:' || location.hostname.endsWith('.chatgpt.site')) say('setup-status', 'This is a review preview. Upload the bundle to its intended public HTTPS host before deploying a contract with a permanent artwork URL.');
      updateButtons();
    } catch (error) { say('setup-status', T.errorMessage(error), true); bundle = null; updateButtons(); }
  })();
})();
