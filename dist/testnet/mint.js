(function () {
  'use strict';
  var T = window.WheelprintsTestnet, $ = function (id) { return document.getElementById(id); };
  var bundle, config, contractAddress, session, review, busy = false, verified;
  function status(message, error) { $('mint-status').textContent = message; $('mint-status').classList.toggle('error', !!error); }
  function selectedId() { return T.variantId(Number($('mint-record').value), Number($('mint-form').value), Number($('mint-palette').value)); }
  function updateButtons() {
    var ready = !!(session && session.account && session.chainId === T.CHAIN_ID);
    $('wallet-status').textContent = T.walletLabel(session);
    $('connect-wallet').disabled = busy || !contractAddress;
    $('connect-wallet').textContent = session && session.account ? 'Refresh wallet' : 'Connect wallet';
    $('switch-network').hidden = !(session && session.account && session.chainId !== T.CHAIN_ID);
    $('switch-network').disabled = busy;
    $('prepare-mint').disabled = busy || !contractAddress || !ready;
    $('confirm-mint').disabled = busy || !review || !ready;
    ['mint-record', 'mint-form', 'mint-palette'].forEach(function (id) { $(id).disabled = busy || !bundle; });
  }
  function invalidate() { review = null; verified = null; $('mint-review').hidden = true; updateButtons(); }
  function changedWallet(s) { session = s; if (review && review.wallet.revision !== s.revision) { invalidate(); status('Wallet changed. Review the selected print again.'); } updateButtons(); }
  function getSession() { if (!session) session = T.createSession(window.ethereum, changedWallet); return session; }
  async function run(task) { if (busy) return; busy = true; updateButtons(); try { await task(); } catch (error) { status(T.errorMessage(error), true); } finally { busy = false; updateButtons(); } }
  function renderSelection(push) {
    if (!bundle) return;
    invalidate();
    var id = selectedId(), v = bundle.commitments.variants[id];
    $('selected-title').textContent = v.title;
    $('selected-caption').textContent = v.title + ' · ' + v.style + ' / ' + v.palette;
    var imageURL = new URL(v.svgPath, bundle.base); imageURL.searchParams.set('v', T.hexHash(v.artworkSHA256).slice(2));
    $('mint-image').src = imageURL.href;
    $('mint-image').alt = v.title + ', ' + v.style + ' form in the ' + v.palette + ' palette';
    $('studio-link').href = new URL('../?' + T.compositionQuery(id) + '#studio', document.baseURI).href;
    if (push) { var url = new URL(location.href); url.search = T.compositionQuery(id); history.replaceState(null, '', url); }
    status('');
  }
  async function prepare() {
    review = null; $('mint-review').hidden = true;
    var s = getSession(), snapshot = await s.assertCurrent(), id = selectedId(), v = bundle.commitments.variants[id];
    status('Checking the contract, source snapshots, and this artwork…');
    // Keep the bulk attestations off the wallet RPC (Rabby's shared endpoint can
    // rate-limit these reads). The wallet still controls account, chain and send.
    var provider = await T.readProvider();
    verified = await T.verifyContract(provider, contractAddress, bundle, config.artworkBaseURL);
    if (config.runtimeCodeHash) T.assert(T.same(verified.runtimeCodeHash, config.runtimeCodeHash), 'The configured runtime fingerprint differs from the live contract.');
    await T.verifyArtwork(bundle, v, verified.artworkBaseURL);
    T.assert(!(await verified.contract.minted(snapshot.account, id)), 'This wallet has already minted this composition in the rehearsal.');
    await s.assertCurrent(snapshot);
    var contract = verified.contract;
    await contract.mint.staticCall(id, { from: snapshot.account });
    var tx = await contract.mint.populateTransaction(id);
    tx.chainId = T.CHAIN_ID; tx.value = 0n; tx.from = snapshot.account;
    var gas = await T.gasEstimate(provider, provider, tx);
    await s.assertCurrent(snapshot);
    T.assert(id === selectedId(), 'The selected print changed. Review it again.');
    review = { wallet: snapshot, variantId: id, tx: tx, baseURL: verified.artworkBaseURL };
    T.fillDetails($('mint-review-fields'), [['Print', v.title + ' · ' + v.style + ' / ' + v.palette], ['Network', 'Ethereum Sepolia'], ['Mint price', '0 ETH'], ['Network gas', gas.text], ['Recipient', snapshot.account], ['Contract', contractAddress]]);
    $('mint-review').hidden = false;
    status('Checks passed. Review the details, then confirm in your wallet.');
  }
  async function confirm() {
    var saved = review;
    T.assert(saved, 'Review the mint first.');
    var s = getSession();
    await s.assertCurrent(saved.wallet);
    T.assert(saved.variantId === selectedId(), 'The selected print changed. Review it again.');
    var provider = await T.readProvider();
    var current = await T.verifyContract(provider, contractAddress, bundle, saved.baseURL);
    if (config.runtimeCodeHash) T.assert(T.same(current.runtimeCodeHash, config.runtimeCodeHash), 'The configured runtime fingerprint differs from the live contract.');
    await T.verifyArtwork(bundle, bundle.commitments.variants[saved.variantId], current.artworkBaseURL);
    await s.assertCurrent(saved.wallet);
    await current.contract.mint.staticCall(saved.variantId, { from: saved.wallet.account });
    var signer = await s.getSigner();
    await s.assertCurrent(saved.wallet);
    status('Review the Sepolia mint transaction in your wallet.');
    var tx = await signer.sendTransaction(saved.tx);
    T.savePending('mint', { hash: tx.hash, contractAddress: contractAddress, account: saved.wallet.account, variantId: saved.variantId });
    review = null; $('mint-review').hidden = true;
    var result = $('mint-result'); result.replaceChildren(); result.hidden = false;
    var note = document.createElement('p'); note.textContent = 'Transaction submitted. Waiting for a confirmed receipt.'; result.appendChild(note);
    T.addLink(result, 'View transaction ↗', T.EXPLORER + '/tx/' + tx.hash);
    status('Waiting for Sepolia confirmation. Keep this transaction link if you close the page.');
    var receipt;
    try { var confirmationProvider = await T.readProvider(); receipt = await confirmationProvider.waitForTransaction(tx.hash, 1, 90000); }
    catch (error) { status('The transaction was submitted, but its confirmation could not be read. Keep the transaction link and check its outcome before retrying. ' + T.errorMessage(error), true); return; }
    if (!receipt) { status('Confirmation is still pending. Check the transaction link before trying another mint.'); return; }
    T.assert(Number(receipt.status) === 1, 'The transaction was included but reverted. No test token was minted by this transaction.');
    var iface = new (T.eth().Interface)(bundle.artifact.abi), tokenId = null;
    receipt.logs.forEach(function (log) {
      if (!T.same(log.address, contractAddress)) return;
      try { var parsed = iface.parseLog(log); if (parsed && parsed.name === 'Transfer' && parsed.args.from === T.eth().ZeroAddress && T.same(parsed.args.to, saved.wallet.account)) tokenId = parsed.args.tokenId; } catch (_) {}
    });
    T.assert(tokenId !== null, 'The receipt succeeded but its mint event was not recognized. Check the transaction before retrying.');
    note.textContent = 'Test print #' + tokenId + ' was minted to ' + saved.wallet.account + '.';
    T.addLink(result, 'View test token ↗', T.EXPLORER + '/token/' + contractAddress + '?a=' + tokenId);
    status('Confirmed on Sepolia. Your chosen artwork now has a test token.');
  }
  $('connect-wallet').addEventListener('click', function () { run(async function () { await getSession().connect(); invalidate(); status(session.chainId === T.CHAIN_ID ? 'Wallet connected to Sepolia. You can review a test mint.' : 'Wallet connected. Switch to Sepolia to continue.'); }); });
  $('switch-network').addEventListener('click', function () { run(async function () { await getSession().switchNetwork(); invalidate(); status('Network checked. Review the test mint when your wallet is on Sepolia.'); }); });
  $('prepare-mint').addEventListener('click', function () { run(prepare); });
  $('confirm-mint').addEventListener('click', function () { run(confirm); });
  ['mint-record', 'mint-form', 'mint-palette'].forEach(function (id) { $(id).addEventListener('change', function () { renderSelection(true); }); });
  (async function () {
    try {
      T.assert(window.ethers, 'The local wallet library could not load. Reload the page.');
      var loaded = await Promise.all([T.loadRelease(), T.fetchJSON(new URL('deployment.json', document.baseURI).href)]);
      bundle = loaded[0]; config = loaded[1]; contractAddress = T.validateDeployment(config);
      var choice = T.selection(location.search); $('mint-record').value = choice.record; $('mint-form').value = choice.form; $('mint-palette').value = choice.palette;
      renderSelection(false);
      if (contractAddress) {
        $('release-status').textContent = 'Sepolia deployment configured';
        $('release-detail').textContent = 'Connect your wallet to check the deployed contract and review a test mint. The contract and artwork are verified again before signing.';
        $('contract-link').href = T.EXPLORER + '/address/' + contractAddress; $('contract-link').hidden = false;
        var prior = T.pending('mint');
        if (prior && T.same(prior.contractAddress, contractAddress) && /^0x[0-9a-fA-F]{64}$/.test(prior.hash)) {
          var result = $('mint-result'); result.hidden = false;
          var p = document.createElement('p'); p.textContent = 'A previous transaction was submitted from this browser. Check its outcome before minting the same composition again.'; result.appendChild(p);
          T.addLink(result, 'Check previous transaction ↗', T.EXPLORER + '/tx/' + prior.hash);
        }
      } else {
        $('release-status').textContent = 'Test mint not open yet';
        $('release-detail').textContent = 'The artwork is ready to explore. A Sepolia contract has not been configured for this website yet. The owner can complete Release setup before inviting testers.';
      }
      updateButtons();
    } catch (error) { $('release-status').textContent = 'Release check needs attention'; $('release-detail').textContent = T.errorMessage(error); contractAddress = null; updateButtons(); }
  })();
})();
