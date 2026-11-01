# Wheelprints — Codex handoff

## Current checkpoint — Blockscout source published and fully verified

At the user's explicit request, the exact archived standard JSON compiler input was submitted through Blockscout's Solidity Standard JSON form. Publication succeeded on **October 31, 2026 at 7:37:51 PM America/Denver**. The page now states **Contract source code verified (exact match)** for `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`.

Verified source: https://eth-sepolia.blockscout.com/address/0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac?tab=contract

Settings: Solidity **v0.8.38+commit.1835d247**, optimizer enabled with **1** run, `viaIR: true`, `evmVersion: cancun`, metadata `bytecodeHash: ipfs` and `useLiteralContent: true`, existing **MIT** license. All **21** published source files exactly match the archived compiler input. A fresh local compilation reproduced the original creation/runtime bytes, ABI and compiler metadata before submission; live Sepolia deployment bytes and constructor artwork URL also matched. After publication, the explorer API confirmed `is_verified: true`, `is_fully_verified: true`, `is_partially_verified: false`. Published ABI, creation code with constructor arguments, runtime and all code-generation settings match. Blockscout normalizes outputSelection to all outputs and adds an empty libraries object; this does not change the exact bytecode match.

Evidence: `handoff-evidence/blockscout-source-preparation.json`, `blockscout-source-publication.json`, and `blockscout-published-source.json`. The parent outputs directory contains the reusable input/settings bundle and `wheelprints-source-verified.png`. No source, renderer, artwork, commitment, contract configuration or website file was altered. No deployment, wallet transaction or Cloudflare upload was performed or needed. New deployment remains disabled.

The source-publication recommendation is complete. The tester brief and readiness assessment are updated. Small invited Sepolia testing can proceed; use the first few testers for independent wallet/browser coverage. Transfers remain optional and untested by the user's choice. No invitation has been sent. Earlier references to unpublished source below are historical.


## Current checkpoint — second mint verified; small tester trial ready

The user asked to verify the second mint and assess readiness before inviting testers. Token **2**, **Drift / Current / Ember** (variant **4**), was minted in transaction `0xe55596df86b60d290b46680dd56fd1a77bf3d6c799e34f842a194a22e3d06153`, block **12037708**, October 31, 2026 at **7:27:48 PM America/Denver**. The receipt succeeded, with 16 confirmations at the check. Current owner is `0x218736c626a2c846Ae465D39cDC40E8B8218427C`; total supply and that wallet's balance are both two. Gas used 379,503, signed limit 590,088, zero mint value. Both tokens remain owned by that wallet.

Read-only public Sepolia verification passed for exact runtime, all 27 variants, three complete snapshots, current token owner/variant, decoded tokenURI and all traits, event seed/hash, hosted SVG bytes, and live release files. Duplicate mint simulation from the same wallet returned AlreadyMinted. Blockscout's token #2 viewer renders the correct SVG and owner. See `handoff-evidence/second-mint-verification.json` and `tester-readiness.json`.

The user chose to skip transfers for this mint-focused Sepolia trial. Keep transfer testing marked optional and untested; it is not a gate for the small invited trial. Do not automatically transfer or mint again. No further deployment or upload is needed for the current trial; deploymentEnabled remains false.

Assessment: no known blocking issue for a small invited trial. Recommend publishing verified source before wider sharing: Blockscout still shows Verify & publish, while Etherscan status could not be checked past its automated-browser interstitial. Start with a few independent tester accounts and another wallet/browser, since both verified mints used the same wallet. Provide clear Sepolia/gas/composition instructions and a Blockscout viewer link for Rabby users. A ready-to-copy tester brief is saved in the parent outputs directory. No invitations were sent and no source publication was attempted in this turn.

The Blockscout MCP session expired and cannot be reused; do not reinitialize it to evade its session limit. This verification used read-only public Sepolia RPC and the public explorer UI. Earlier checkpoints below are historical.


## Current checkpoint — first Sepolia mint verified

On October 31, 2026 at 7:18:12 PM America/Denver, the user minted token **1**, **Surge / Bloom / Midnight** (variant **26**) in transaction `0xd40480fdcbaaf507f300ebbd4dad7271f8ec3f38c788aec9be9d7e0fbf1fc2e1`, block **12037661**. Successful zero-value call to the existing contract, ERC721 mint event to `0x218736c626a2c846Ae465D39cDC40E8B8218427C`, and current `ownerOf(1)` / `tokenVariant(1)` were independently verified via Blockscout. The explorer reported four confirmations at the initial check. Gas used was **477,423**, signed gas limit **738,716**, and fee **12,412,998 wei**. The signed limit is approximately 1.5 times the prior estimate; this observation does not establish where the wallet set it.

The onchain base64 JSON metadata, seven traits, source/renderer identity, image URL and artwork hash all match the preserved release. The image serves the exact committed SVG and renders at 1600 × 1600 in a clean browser. Eleven live release files (including mint/shared/deploy scripts, configuration, pages, commitments, artifact, renderer and selected SVG) match the Rabby-fix ZIP byte for byte. The user has uploaded the fix; new contract deployment remains disabled. No additional upload or redeployment is required for this completed mint.

Evidence: `handoff-evidence/first-mint-blockscout.json`, `first-mint-contract-reads.json`, and `first-mint-verification.json`. The optional `minted(wallet,26)` read hit a separate Blockscout RPC HTTP 429; it was not retried or treated as a mint failure. Current ownership and metadata were read successfully. No transaction was signed or submitted by the verification work.

Remaining rehearsal work: a user-approved transfer between Sepolia wallets and verification of ownership after transfer; explorer source-code publication remains separate. Do not automatically transfer or mint again. Prior package files remain intact as historical checkpoints.


## Current checkpoint — Rabby RPC rate-limit fix

The user uploaded the mint-enabled package and encountered “missing revert data” with Rabby in Brave, on Surge / Bloom / Midnight (variant 26). Read-only DevTools inspection identified HTTP 429 from `https://11155111.rpc.thirdweb.com/` during `snapshotInfo(0)` in `verifyContract`, before any mint request. This is a transport rate limit, not a decoded contract revert. See `handoff-evidence/rabby-rpc-rate-limit.json` and `rabby-rpc-fix-verification.json`.

`dist/testnet/mint.js` now uses the existing chain-checked public Sepolia read provider for runtime/source/variant/snapshot attestations, eligibility, mint simulation and gas estimate. Simulation and estimate explicitly include the connected wallet as sender. Contract attestation and artwork are rechecked before signing. Account/network revision guards remain required, and Rabby remains the transaction signer. No hardcoded gas limit or increased allowance is introduced. `shared.js` distinguishes nested HTTP 429/rate-limit errors from generic missing-revert-data text without exposing RPC request details. Genuine reverts and unavailable reads still block the mint.

Regression tests cover the public-read separation, explicit sender, no signer/send during review, repeated attestation before signing, rate limits/outage, mint rejection, stale wallet, altered runtime, and actual receipt handling using doubles. Live unsigned verification uses the production read-provider helper, exact runtime/commitments, hosted selected SVG/renderer, and sender-specific simulation/estimate. No transaction is submitted by these checks. All artwork, renderer, contract sources/artifacts, snapshots, commitments and verified deployment configuration are preserved; new deployment remains disabled.

Use **Wheelprints_Cloudflare_Rabby_Fix.zip** or the clean **Wheelprints_Rabby_Fix_Upload_111_Files** folder for the next production update. The fix has not yet been uploaded or exercised with Rabby on the public site. After upload, the user should review and approve one Sepolia test mint, then provide its hash for independent ownership/metadata checks. Earlier checkpoints below describe prior packages.


## Current package — verified contract installed for first test mint

The user explicitly requested the Cloudflare update enabling test minting. `dist/testnet/deployment.json` is an exact copy of the independently verified configuration for `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`. The release gate now has `deploymentEnabled: false`, status `sepolia-test-mint-ready`, to prevent another deployment. Mint availability is controlled by the deployment configuration, not that deployment gate. The setup page now directs users to Test prints; its receipt recovery remains available.

The package has not been uploaded by Codex. The first unsigned mint check (Drift / Orbit / Mineral, variant 0) passed: estimate 383,260 gas, return token ID 1, supply 0 before and after, actual account balance, no state overrides, no signature/broadcast. See `handoff-evidence/first-mint-preflight.json`. The actual first token ID depends on chain state at execution.

`tests/mint-flow-check.cjs` exercises the production mint controller's loaded configuration, explicit connection/review/send boundaries, success event, signature rejection, runtime/artwork/duplicate failures, changed account, wrong chain, unconfigured fallback and pending receipt link with isolated doubles. Existing frontend and closed-deployment regression checks still run. The verified configuration is now intentionally public as part of this authorized release.

Use the new `Wheelprints_Cloudflare_Test_Mint.zip` or `Wheelprints_Test_Mint_Upload_111_Files` folder, never the older deployment-preparation package. Follow `hosting/README.md`; ask for the mint transaction hash after one successful mint and verify owner/variant/tokenURI/artwork. The previous deployment gas-limit discrepancy remains recorded; inspect final wallet fees. No contract, renderer, art or commitment changes were made.

Earlier entries below are historical, including references to minting being closed.


## Confirmed Sepolia deployment — October 31, 2026

The user signed the authorized deployment. Contract: `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`. Transaction: `0x2c2726d1219306d40b32d534ed2f764292cc0e4536eb61426ffd158c8e124901`. Successful receipt in block 12037558, hash `0xeb650aeed6feb79b223a172beba170df0b937fb6fd76f277b13b89187c9018a8`; 14 confirmations at the independent check. Blockscout also reports successful creation. This is deployed-byte verification, not published explorer source verification.

Independent read-only checks passed for exact creation data/final artwork URL, exact deployed runtime, all 27 variant records and SVG hashes, all three full source snapshots, source/renderer identity, ERC721 interfaces, and current hosted renderer/artwork. Total supply was zero. The live setup page also reports successful receipt recovery, with matching regenerated configuration.

Actual gas used was 19,748,837, exactly matching simulation. The signed transaction used gas limit 29,860,112 instead of the reviewed 21,897,416; the cause of that difference is not established. Actual usage remained inside the reviewed limit and the submitted limit remained below the 30 million project budget. Record this discrepancy before further wallet testing.

Website minting remains closed: the public and local `dist/testnet/deployment.json` remain not-deployed with null address/hash. The separately saved `outputs/wheelprints-verified-deployment.json` is for review and is not in the upload folder. No new Cloudflare package has been uploaded. Do not deploy another copy. The public setup instructions still describe the completed rejection check; update these and close the deployment gate when preparing the next release.

Full evidence: `handoff-evidence/deployed-contract-verification.json` and `blockscout-deployment-receipt.json`. The verification report and recovered configuration are available outside the source folder in this chat's outputs. Real minting, transfer and explorer source publication remain outstanding. The contract has no pause switch; the current mint restriction is in the website configuration.


## Current release update — deployment preparation and first rejection check

The user explicitly requested an updated Cloudflare package enabling preparation while keeping minting closed. `dist/testnet/release-status.json` now has `deploymentEnabled: true` and `status: ready-for-wallet-rejection-check`. The setup page visibly instructs the user to reject the first confirmation; approving would submit a real Sepolia deployment. The local package has not been uploaded by Codex. `deployment.json` remains not-deployed with null contract address/hash. Do not treat this request as authorization to sign or broadcast.

The site is live at https://wheelprints-sepolia.pages.dev/. The user reported all seven initial wallet checks passed. Real funded-account validation at block 12037405 passed without state or block overrides; estimated gas 19,906,741, simulated gas used 19,748,837, validated limit 21,897,416. The public constructor summary now describes this final-URL check. Full evidence and the user-reported wallet checks are in `handoff-evidence/funded-sepolia-preflight.json` and `wallet-checks-user-report.json`. Wallet signing, rejection of a real wallet request, transaction inclusion, recovery, minting and transfer remain unverified onchain.

`tests/deployment-rejection-check.cjs` exercises the production controllers with a rejecting wallet stub, including acknowledgement gating, revalidation, no saved transaction after rejection, the closed-gate fallback, and mint controls remaining disabled. This is a local controller test, not a substitute for the user's wallet rejection check. The original artwork, renderer, source/commitments and compiler artifact have not changed.

Upload the complete static package to the existing wheelprints-sepolia Pages project as a production update. Follow `hosting/README.md` and stop after rejecting the first wallet confirmation. The earlier checkpoint below records the historical disabled state.


## Earlier Codex checkpoint — October 31, 2026

The gas issue is diagnosed and the constructor passes **transaction-validating Sepolia simulation**. **Deployment remains disabled** pending final-host and signed-wallet checks. No Cloudflare upload or public transaction was performed.

The original 19,841,860 estimate was reproducible. Each historical `roundPage` read estimated only about 54,700 gas. Sepolia activated Glamsterdam on October 6, 2026; EIP-8037 separately meters state creation and applies the EIP-7825 16,777,216 cap to **execution gas**, not total transaction gas. The old comparison of total deployment gas against that cap was incorrect for this fork. Bytecode deposit alone at the specified 1,530 gas per byte explains most of the estimate; the exact read path and all source assertions are preserved.

The Solidity source is byte-identical. Optimizer runs changed from 200 to 1, reducing runtime from 11,282 to 11,132 bytes and initcode from 17,184 to 16,837 bytes. The live total estimate fell to **19,607,316** (234,544 less, about 1.18%). The local mint costs rose by about 122 gas; this is a deployment-size tradeoff. All 27 tokenURI strings match the prior runtime byte for byte.

`shared.validateConstructor` now requires `eth_simulateV1` with `validation: true`, exact returned runtime, current Sepolia/fork checks, a pinned parent block and reorg check. It fails closed if simulation is unsupported or fails. The UI revalidates immediately before requesting the wallet signature and uses the reviewed gas limit. The 30,000,000 total-gas ceiling is an explicit project cost budget, not the network execution cap. This is not a change to the release gate: it remains false.

### Verification

- Pinned dependency installation and contract build passed (Node 24.19.0, solc 0.8.38).
- All 12 contract groups passed, including 23 source faults, all 27 variants, receiver reentry/rollback, wrong-chain rejection, and frontend runtime/snapshot verification.
- Dependency installation reported 21 audit findings in the full toolchain; production-only `npm audit --omit=dev` reports zero. Development-tool findings were not remediated; pinned versions remain intact.
- All 7 existing frontend groups and the studio suite passed. The added deployment-gas suite covers successful transaction validation and 9 fail-closed cases.
- All 81 export files, renderer, export kit, source data, generated commitments and Solidity source match the input handoff byte for byte (89 preserved files).
- The default strict PNG raster comparison **fails on this Mac**. The original PNG hashes and dimensions pass. Host fonts/rasterization are a likely cause, but the original rendering environment was not reproduced. `npm run test:exports:portable` separately verifies all bytes, provenance, mappings and dimensions; it explicitly skips pixel re-render comparison. Default strict testing is unchanged. Do not regenerate the art to make this environment match.
- Local browser preview confirmed the paused deployment message, disabled deployment and mint controls, and the Surge/bloom/midnight selector-to-studio link. This was a loopback preview, not final-host or signed-wallet testing.
- Live source proxy/implementation hashes and EIP-1967 slot matched. Optimized transaction-validating simulation passed at parent block **12037223**, hash `0x3827668a0507dea22f224ab99855b37befd9dbcbaf36ccb13c80ea56fe4c0f0c`; simulated gas used **19,451,770**, reviewed total limit **21,568,048**. The exact compiled runtime was returned. Only the synthetic sender balance was overridden; no source storage or code was overridden.
- Simulation is unsigned and omits signature/contract-sender checks. It is not a receipt, wallet compatibility test or guarantee of inclusion. The example.com base URL is a placeholder, not verified hosting.

Evidence: `handoff-evidence/current-sepolia-preflight.json`, `preservation-check.json`, original gas profile/validation records, and `contracts/test-results.json`. Public current evidence is `dist/testnet/constructor-simulation.json`. Original handoff evidence remains available.

### Continue from here

Run `npm ci --ignore-scripts`, `npm run build:contracts`, `npm run test:contracts`, `node tests/testnet-ui-check.cjs`, `npm run test:deployment-gas`, `npm run test:app`, and `npm run test:exports:portable`. Run `npm run test:exports` in the original raster/font environment before claiming strict raster reproducibility. `npm run check:sepolia` repeats read-only live validation; it never enables deployment. Set `WHEELPRINTS_ARTWORK_URL` to the final HTTPS root (ending `/`) once assigned; hosted-byte validation is a separate check.

Choose the separate Cloudflare project and stable origin, package with `python3 scripts/package-cloudflare.py --site-url <actual-origin>`, verify the hosted renderer and 27 SVGs, and complete wallet rejection/network/account/recovery checks. Only then deliberately review the release gate. User signing, real deployment/mint/transfer and explorer verification remain outstanding. No mainnet activity is authorized.

Protocol references: [Sepolia Glamsterdam schedule](https://blog.ethereum.org/2026/09/17/glamsterdam-testnet-announcement), [EIP-8037 gas accounting](https://eips.ethereum.org/EIPS/eip-8037), [Geth transaction-validating simulation](https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-eth).

---

## Original handoff checkpoint (historical)

The sections below record the incoming handoff. Their gas-cap diagnosis and compiler/gas figures are superseded by the current checkpoint above.

## Start here

Continue this existing project toward a **Cloudflare-hosted Sepolia rehearsal**. Do not restart the artwork or replace the working studio. Ian Demers asked to move the work into Codex while the testnet preparation was in progress.

Read this file, `README.md`, `hosting/README.md`, the contract sources, and the recorded verification results before changing code. The project contains real implementation, compiled artifacts and original generated artwork; it is not just a proposal.

## User intent and decisions

- Project: **Wheelprints**, an independent generative-art contribution using Squeektoshi/Squeekchain recorded activity. Pillhead responded positively to the original concept.
- Ian wants a serious, working project that can be shown to the Squeekchain community.
- His latest launch preference is **testnet first**.
- He intends to host it where his **1337 Genome** project is hosted. Retrieved earlier context identifies **Cloudflare Workers/Pages**, with Genome at `https://genome1337.xyz/app/`. The exact existing account/project configuration was not inspected in this task.
- Prepare a **separate** Cloudflare project, suggested name `wheelprints-sepolia`. No Cloudflare project, domain or credentials have been supplied or created here. Preserve the existing Genome application.
- A free test mint uses Sepolia ETH for gas. There is no mainnet launch authorization, price, supply, allocation, reward promise or official Squeekchain endorsement.
- The user signs wallet transactions. Do not request private keys or recovery phrases in chat or put them in files.

## Current state

The source has advanced to **0.3.0**: the working art studio plus prepared mint/deployment pages and a Sepolia-only ERC721. **No public-network contract was deployed and no transaction was broadcast during this work.** The default `dist/testnet/deployment.json` has `status: "not-deployed"` and `contractAddress: null`.

The earlier 0.2 art beta was deployed privately at `https://wheelprints-by-ian.p20w355.chatgpt.site`. Do not assume that URL displays this 0.3 handoff. The portable package deliberately excludes the ChatGPT Site identity and repository credentials. Cloudflare is the user's intended release host.

## What is already built

### Art studio

- Three archived Sepolia periods: Drift (round 539), Pulse (517), Surge (499).
- Three forms: orbit, current, bloom. Three palettes: mineral, ember, midnight.
- 27 reproducible compositions, construction playback/scrubbing, SVG/PNG exports, source JSON, shareable composition links and keyboard navigation.
- 81 prebuilt export files in `dist/exports/`: one SVG, PNG and JSON per combination.
- Renderer remains `wp-svg-0.1.0`; export kit remains `wp-export-0.2.1`. Existing artwork geometry and visual seeds were preserved.
- SVG fingerprints are significant. Changing the renderer/export metadata or regenerated SVG bytes changes commitments and requires a new compiled rehearsal release.

### Sepolia contract

`contracts/WheelprintsSepolia.sol` uses pinned OpenZeppelin ERC721 and ReentrancyGuard. Constructor: **one string argument**, the final HTTPS site root/path ending in `/`. Image URLs append `exports/<filename>.svg`.

- Constructor and mint are restricted to chain ID **11155111**.
- Mint is nonpayable and has zero mint price; gas still applies.
- 27 **reusable art variants**, not a 27-token edition. Each wallet can mint each variant once. Different wallets can own tokens representing the same variant.
- Token IDs start at 1. Mint entitlement is tracked by original minter and variant, independently of later transfers.
- Constructor reads the observed Core configuration and exact three historical round pages, validates complete snapshots against generated expectations, then stores the snapshots.
- No source reads are needed after deployment. No administrator, owner mint, metadata setter, proxy or mainnet mode is implemented.
- Source snapshots, visual seeds, renderer source hash, and exact SVG SHA-256 commitments are fixed in the contract.
- `tokenURI` returns JSON onchain. **Images remain web-hosted. This is not a fully onchain art renderer.** A fully onchain renderer is a future milestone.
- The original SVG exports retain their historical pre-mint metadata. New token metadata describes the later Sepolia rehearsal accurately.

The generated artifact includes ABI, creation/runtime bytecode, compiler settings, standard JSON input, storage layout, dependency versions and hashes for verification/reproduction.

### Wallet interface

- `dist/testnet/index.html`: mint page; disabled until a real deployment is configured.
- `dist/testnet/deploy.html`: owner deployment console. Upload to the final public HTTPS host first.
- `shared.js`: chain/account revision guards, runtime matching, all 27 variant checks, all three snapshot checks, exact hosted SVG hashing, observed Core proxy/implementation preflight.
- `mint.js`: explicit connect, review, simulation, gas estimate, explicit wallet confirmation, receipt handling and token event display.
- `deploy.js`: validates all 27 hosted SVGs and renderer source, checks the actual EIP-1967 implementation slot and runtime hashes, simulates constructor, requests a user-signed deployment, verifies the receipt/runtime/snapshots/variants, then downloads configuration.
- Deployment recovery accepts a transaction hash and reconstructs configuration only after matching the creation bytecode, constructor argument, runtime and stored values.
- Confirmation/recovery reads use a Sepolia JSON-RPC provider independent of later wallet network changes.
- No account permission request or transaction is triggered by page load.
- The deployment console stays disabled on the private review host or HTTP preview. This avoids permanently pinning a private/temporary image URL.

## Source identity and evidence

Observed source Core: `0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44`.

Observed implementation: `0x284747c4664af2203e7a90a2ee76f22b6b5e6889`, version 3.

Stream: `0x52e443e4e0d236ff0c07f4cdc518c594a3d680d20abb1481510efbed0ec73633`.

Genesis timestamp `1793022600`, round duration `600` seconds, block units per completed block `1000000000`.

| Study | Round | Work | Completed blocks |
| --- | --- | --- | --- |
| Drift | 539 | 199 | 17 |
| Pulse | 517 | 336 | 27 |
| Surge | 499 | 615 | 51 |

Completed blocks use **floor(end cumulative units / 1e9) minus floor(start cumulative units / 1e9)**. Do not replace this with floor(interval units / 1e9).

`dist/data/chain-verification.json` preserves earlier receipt/event and historical-value corroboration. `dist/testnet/source-check.json` preserves the fresh interface, source, EIP-1967 slot, runtime hash and CORS checks. These establish bounded recorded-value consistency and observed code identity, not sensor truth, contract security, or team approval.

The published official manifest still identifies an older Core (`0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`) than the observed API/chain deployment. Canonical support remains unconfirmed. The explorer reports the current implementation partly verified, not fully verified.

## Verification checkpoint

- Original exports: all 27 mappings, SVG/source identity, hashes and PNG pixel comparisons passed in the prior release work.
- Current contract compilation passed with Solidity 0.8.38, optimizer 200, viaIR, EVM target Cancun. Initial compiled sizes: 17,184-byte creation code and 11,282-byte runtime; use the artifact's recorded values after any rebuild.
- `node tests/testnet-ui-check.cjs`: seven groups passed, including all 27 selector mappings, disabled default configuration, wrong-chain/URL rejection, runtime mismatch, explicit wallet permission behavior, changed account/network rejection, and SVG hash mismatch.
- `node tests/app-check.cjs`: existing studio/export/navigation tests passed after adding the testnet link.
- Browser preview: testnet page rendered, all three selectors updated the exact composition link, mint controls stayed disabled with no deployment, and the selected Surge/bloom/midnight print opened correctly in the existing studio. Desktop layout inspected. No physical-device or signed-wallet browser test was performed.
- Native browser save completion remains unconfirmed in this cloud browser. Direct artwork URLs and prepared file bytes were checked; test real device saving before inviting users.
- Local EVM contract checks and the actual read-only Sepolia constructor simulation were being finalized at the handoff request. See the final checkpoint below and bundled test report for their actual results; do not infer a live deployment from a successful simulation.

### Final checkpoint — deployment is blocked

**Local EVM suite: passed all 12 groups.** See `contracts/test-results.json`. It covers 23 source/configuration/implementation/completeness fault cases, all 27 mints, native-payment and duplicate rejection, transfer/approval behavior, receiver rejection rollback, same/different-variant reentrancy, snapshot independence after source failure, wrong-chain constructor/mint rejection, and the actual frontend verifier against the deployed production runtime. With the local mocked Core, deployment used 3,028,932 gas and mints used 104,009–123,921 gas. These local costs do not represent the real Core's historical-read cost.

**Actual Sepolia read-only constructor simulation: runtime matches, deployment gas unresolved.** At block 12037145 (`0x85599205d62f655134fe73f106ab8293bec68f01bcd2172101bebce6b072e1a2`), the exact constructor returned the expected 11,282-byte runtime using a 30,000,000-gas simulation allowance. A 10,000,000 allowance failed. The public provider estimated **19,841,860 gas**, above the **16,777,216** per-transaction cap specified by EIP-7825. A successful oversized `eth_call` is not proof of a deployable transaction. Resolve this before deployment; do not increase the transaction allowance and assume it will be accepted.

`dist/testnet/release-status.json` deliberately sets `deploymentEnabled: false`. The deployment interface honors this gate and also rejects estimates above 16,777,216. Do not simply flip the gate. Optimize the actual source-read path or redesign bounded initialization while preserving the source assertions, then rerun local and real-source checks and verify the current network cap.

Full source and simulation evidence is included in `handoff-evidence/`; a public simulation copy is under `dist/testnet/constructor-simulation.json`. The simulated artifact SHA-256 is `c0c5b720792cd857e58d837de968471ce788a75bf65759736016f3dca9bdb085`, runtime Keccak-256 `0x00a4ba8b3c85b74f669baec898113357df0da37ee57bc28c50eefecf6dd20d83`. No contract was deployed or wallet transaction signed.

## Run and build

Use Node.js compatible with the pinned toolchain (tested Node 24.22.1) and Python 3 for packaging.

```sh
npm ci
npm run build:contracts
npm run test:contracts
node tests/testnet-ui-check.cjs
npm run test:app
```

Only rebuild art exports intentionally; preserve the current commitment bytes during the rehearsal. `npm run test:exports` verifies them. Dependency versions are pinned in `package-lock.json`.

```sh
python3 scripts/package-cloudflare.py
```

This creates the static upload ZIP and developer ZIP under ignored `deliverables/`, plus a sanitized directory for Workers. See `hosting/README.md` for Pages upload, Workers configuration, and final-origin metadata.

## Next actions for Codex

1. Inspect the exact checkpoint and rerun the appropriate checks locally. **First resolve the 19,841,860-gas real-source constructor estimate** before treating the release as deployable. Do not redesign the art or weaken the archived-value checks.
2. Complete the remaining browser checks on the actual intended Cloudflare host, especially wallet changes, rejected signatures, failed/pending transactions, mobile layout, native file saving and deployment recovery.
3. Upload a separate Cloudflare project in the user's account through the normal authorized workflow. Do not overwrite Genome or guess a domain. Capture its actual HTTPS URL.
4. Repackage with the actual origin for canonical/social metadata. Choose the image host that will remain available before creating the contract.
5. Have Ian review and sign the Sepolia deployment from `/testnet/deploy.html`. Keep the successful receipt, contract address and verified downloaded `deployment.json`.
6. Install that configuration and reupload the complete site. Perform a real Sepolia mint, duplicate-mint rejection, transfer, token ownership/metadata/image checks and explorer source verification.
7. Invite testers only after these checks pass. Do not announce a mainnet collection or official Genesis recognition.

## Official recognition is separate

The current Code/Genesis flow pauses direct submissions and ties IMD attribution to the wallet paying a project's first IMD job. This independently built project has no confirmed eligible IMD job. Ask Pillhead for the supported route before commissioning IMD work; do not assume launching the site establishes eligibility.

## References

- Squeekchain: https://squeekchain.com/
- Developer reference: https://docs.squeekchain.com/developers/
- Published manifest: https://docs.squeekchain.com/assets/deployments/sepolia.json
- Genesis Code process: https://squeekchain.com/genesis/code
- Observed settlement API: https://api.squeekchain.com/v1/settlements?range=24h
- Cloudflare Pages upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/binding/
- OpenZeppelin ERC721: https://docs.openzeppelin.com/contracts/5.x/erc721
- Transaction gas cap specification: https://eips.ethereum.org/EIPS/eip-7825

No private keys, account secrets, Cloudflare credentials or source-repository write tokens belong in this handoff.
