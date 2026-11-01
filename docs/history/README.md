# Wheelprints 0.3 — art studio and Sepolia rehearsal

The existing Sepolia contract source is now **published and fully verified (exact match)** on Blockscout: https://eth-sepolia.blockscout.com/address/0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac?tab=contract. All 21 sources, compiler settings, constructor URL and deployed bytecode match the preserved release. The small invited trial is ready; no redeployment or Cloudflare update is needed. Earlier publication recommendations below are historical.

Two live Sepolia mints are now verified: #1 Surge / Bloom / Midnight and #2 Drift / Current / Ember, both owned by the intended wallet. The current site is ready for a small invited mint trial, with new deployment disabled. See `handoff-evidence/tester-readiness.json` and `second-mint-verification.json`. Transfer testing is optional and deferred by user preference; public explorer source verification is recommended before wider sharing.

First test mint verified: token **#1**, **Surge / Bloom / Midnight**, is owned by the intended wallet. Transaction: `0xd40480fdcbaaf507f300ebbd4dad7271f8ec3f38c788aec9be9d7e0fbf1fc2e1`. Onchain metadata and the hosted SVG match the preserved commitments. The Rabby fix is live and new contract deployment is disabled. See `handoff-evidence/first-mint-verification.json`; earlier package notes below are historical.

An independent generative-art project by Ian Demers using three archived Squeekchain records on Sepolia. Their recorded values were corroborated against public Sepolia events and historical Core views on October 31, 2026. This release adds a prepared Sepolia ERC721 rehearsal and a portable Cloudflare package. The current configuration includes the verified Sepolia contract; no mainnet launch is included.

The current package also fixes a confirmed Rabby RPC rate limit during mint preparation: full validation and sender-specific simulation/estimate use the existing public Sepolia read provider. Rabby still signs only after explicit confirmation. Upload `Wheelprints_Cloudflare_Rabby_Fix.zip`; see `hosting/README.md`.

## Current release status

The Sepolia contract is deployed at `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac` and independently verified against the release bytecode, all variants, snapshots and hosted artwork. The updated static package installs that verified configuration to enable test minting and closes further deployment. Upload it to the existing wheelprints-sepolia Pages project; follow `hosting/README.md` for the first-mint walkthrough.

The first unsigned Drift / Orbit / Mineral mint simulation passed at 383,260 estimated gas with supply remaining zero. No token has been minted by this preparation. The original artwork, renderer, Solidity source and compiler artifact are unchanged. Historical checks and limitations are in `CODEX_HANDOFF.md`.

## Run

The static app lives in `dist/`. Serve that directory with a static web server; the original studio can also open directly from `dist/index.html`. Artwork browsing and exports need no wallet or API key. Recorded inputs are bundled in `dist/data/periods.js` and `periods.json`. The testnet pages load same-origin JSON artifacts and a bundled ethers library; use an HTTPS host and an injected Ethereum wallet for deployment or minting.

## Current scope

Three source intervals, three generative forms, three palettes, deterministic SVG rendering, construction playback and scrubbing, SVG and PNG exports with persistent save/open links, matching JSON source records, copyable composition links, keyboard gallery navigation, source transaction links and an FAQ.

`testnet/` provides a free Sepolia test mint using the verified deployment configuration. `testnet/deploy.html` prepares and simulates a contract creation for the user's wallet. It checks the observed source implementation and hosted artwork, waits for a successful receipt, verifies the resulting runtime/snapshots/27 artwork commitments, then produces `deployment.json`. The current configuration contains the verified contract address and deployment receipt. No transaction is sent by this repository's build or tests.

The rehearsal has 27 reusable artwork variants and one mint per wallet per variant. It has no mainnet supply or pricing policy. Its onchain JSON metadata points to the existing hosted SVGs. Snapshots, seeds and artwork fingerprints are preserved in the contract; a fully onchain art renderer is still future work. The original exported SVG metadata records its pre-mint creation state, while token metadata describes the later rehearsal mint.

All 27 combinations have prebuilt 2400px PNGs, 1600px SVGs and matching JSON source records in `dist/exports/`. The app selects these ordinary same-origin files through `dist/data/exports.js`; versioned file URLs preserve the exact artifact identity. A browser export fallback remains available when the manifest does not match the current inputs.

The replay draws a deterministic composition over time. It does not reconstruct the hamster's trajectory or the timing of individual wheel passages.

## Evidence

See dist/data/SOURCE_NOTES.txt and dist/data/chain-verification.json. The samples preserve the official API response attribution, round boundaries, cumulative totals and source transaction identity. Public-provider checks matched all three records against event logs and historical Core reads, including interval block counts. These checks establish recorded-value consistency, not sensor truth, official support or contract security. The published developer reference and current API still have different deployment identities; confirm the canonical record and matching interface before adding transactions.

## Rendering

dist/art-engine.js exposes Wheelprints.render, seed, describe, setProgress and version. The same source inputs and artistic choices reproduce the same SVG with the same renderer version. The UI adds full source provenance to downloadable SVG metadata. All artwork is original code-generated SVG, not copied Squeek artwork.

## Regenerate release exports

Use Node.js >=20.9.0 and Sharp 0.35.5 (tested with Node 24.22.1). The builder uses the installed `sharp` package, with a hosted-runtime fallback through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`.

```sh
node scripts/build-exports.cjs
node tests/exports-check.cjs
node tests/app-check.cjs
```

Rebuild after changing the source snapshot or export kit, and deploy `dist/data/exports.js` together with `dist/exports/`. Bump the export-kit version when changing record semantics. PNG checks use the available system fonts; SVG geometry and source identity are the portable artifact.

## Proposed next phase

Upload to a separate Cloudflare test project, run the wallet deployment, publish its verified configuration, and rehearse minting, transfers and metadata. See [hosting/README.md](hosting/README.md) for the complete handoff. Confirm canonical Squeekchain support before further integration. A fully onchain renderer, mainnet terms and Genesis recognition remain separate milestones.

## Contract and release checks

The toolchain versions are pinned in `package-lock.json`. Install them with `npm ci`, then run:

```sh
npm run build:contracts
npm run test:contracts
node tests/testnet-ui-check.cjs
npm run test:app
```

The contract test runner uses a local EVM and exact-shape mocks. Live Sepolia source checks use read-only calls. Neither signs a transaction on a public network. Tests are implementation validation for a rehearsal, not an independent security audit or official Squeekchain approval.

See the Cloudflare guide for packaging commands and the separately authorized wallet deployment. Keep the final HTTPS artwork location stable: its base URL is fixed when the test contract is created.
