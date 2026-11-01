# Wheelprints

Independent generative artwork by Ian Demers, made from three archived Squeekchain records. The studio offers 27 compositions: three records, three forms and three palettes. Each composition has an original SVG, PNG and JSON export.

- **Live studio:** https://wheelprints-sepolia.pages.dev/
- **Sepolia mint:** https://wheelprints-sepolia.pages.dev/testnet/
- **Verified contract:** [0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac](https://eth-sepolia.blockscout.com/address/0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac?tab=contract)

## Current checkpoint

Prepared October 31, 2026 for source review and a possible IMD continuation. This repository is a local preparation; it has not been published to GitHub or submitted to IMD. No job has been purchased.

The existing Sepolia contract is deployed, its source is fully verified on Blockscout, and the Cloudflare site already enables test minting. Further deployment is disabled. The mint is free apart from Sepolia gas, with one mint per wallet per variant. These are reusable compositions, not a 27-token edition. Token metadata is onchain; image files are hosted at the constructor-fixed Cloudflare URL. Artwork uses archived records, not a live wheel feed or a reconstruction of the hamster's trajectory.

The scope of this preparation is documentation, packaging and verification. **Preserve every existing artwork byte, renderer, seed, snapshot, commitment, contract source, compiler artifact, deployment configuration and live website file.** See [preservation/README.md](preservation/README.md) and [AGENTS.md](AGENTS.md). The fixed artwork origin must remain available for existing tokens.

## Run locally

The checked-in static application is in `dist/`; it is part of the source of this project and is intentionally tracked. There is no separate frontend bundler. Use a local static server for JSON and script loading:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8080/` for the studio or `/testnet/` for the mint interface. Browsing art needs no wallet. Local tests must use isolated wallet fixtures; signing or sending transactions is outside this review scope.

## Dependencies and checks

Node 24.19.0 was used for this preparation. Dependency versions are pinned in `package-lock.json`; `.nvmrc` records the tested Node version. Python 3 is used by the optional static server and historical packaging script.

```sh
npm ci --ignore-scripts
node scripts/verify-preservation.cjs
node tests/testnet-ui-check.cjs
npm run test:app
npm run test:mint-flow
npm run test:deployment-rejection
npm run test:deployment-gas
npm run test:exports:portable
npm run test:contracts
node scripts/verify-preservation.cjs
```

Contract tests use an in-process local EVM with fresh random test accounts. They do not sign or broadcast to a public chain. They regenerate `contracts/test-results.json`, a test report, so run them in a disposable checkout if you want a clean working tree. That generated report is not a protected contract source file.

For compiler reproduction, run `npm run build:contracts` in a disposable copy, then run the preservation check. This must reproduce the archived artifact, generated commitments and vendor bundle exactly. Do not run `build:exports` for this review: the existing artwork is authoritative.

The portable export check verifies all 81 archived files, hashes, source mappings, SVG output and dimensions. Strict PNG re-render comparison (`npm run test:exports`) previously failed on this Mac; the original raster/font environment has not been reproduced. Do not regenerate artwork to hide that difference. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for this preparation's results.

## Repository map

| Path | Purpose |
| --- | --- |
| `dist/` | Preserved application, all 81 artwork files, source data and deployed-contract configuration |
| `contracts/` | Solidity sources, exact generated commitments, local mocks and historical test report |
| `scripts/`, `tests/` | Existing build tools, local checks and the added preservation check |
| `hosting/` | Preserved Cloudflare configuration and current hosting boundary |
| `handoff-evidence/` | Dated source, deployment, mint and publication evidence |
| `preservation/` | SHA-256 baseline for protected files and the previously uploaded Cloudflare package |
| `docs/history/` | Original handoff documents and manifests, retained as historical evidence |
| `IMD_JOB_BRIEF.md` | Proposed review/test job; no submission or payment authorization |

Historical notes contain earlier blocked, pre-deployment and pre-mint states. The same is true of the preserved `dist/README_TESTNET_LAUNCH.txt`. They do not supersede this README, the deployed configuration or the current scope. The historical `PACKAGE_MANIFEST.json` is not a manifest of this new repository.

## IMD and GitHub

Read [docs/GITHUB_PREPARATION.md](docs/GITHUB_PREPARATION.md) before publishing and [IMD_JOB_BRIEF.md](IMD_JOB_BRIEF.md) before commissioning work. IMD import needs an actual public GitHub repository and an exact commit; both remain unset until publication is separately authorized. Genesis eligibility for an imported project and retaining its Cloudflare destination remains unconfirmed.

No GitHub Actions deployment, Cloudflare Git integration, automatic upload or signing workflow is configured. This repository does not replace the current Cloudflare Direct Upload project.

## Rights and limits

Existing Solidity MIT identifiers and third-party notices are preserved. No new repository-wide or artwork license is granted by this preparation; see [RIGHTS.md](RIGHTS.md).

This is an independent Sepolia trial. Source verification and passing tests are not an independent security audit, official Squeekchain endorsement, or a mainnet launch. Real mobile wallet coverage remains to be established; public transfer testing was deferred. The contract has no administrative pause switch.
