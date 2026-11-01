# Wheelprints — wallet compatibility review and isolated regression tests

**DRAFT ONLY. Do not submit, pay, publish or execute this job from this document alone.**

## Owner setup before any paid job

- Confirm with the Squeekchain team that importing an existing project for this genuine review/test contribution qualifies for Genesis Code. Confirm whether its listing can retain the existing Cloudflare URL. Neither is guaranteed by this brief.
- Public GitHub repository: **NOT PUBLISHED — replace with the actual repository URL**.
- Accepted base commit: **NOT SET — replace with the full 40-character SHA after publication**.
- Requesting/paying wallet: `0x218736c626a2c846Ae465D39cDC40E8B8218427C`, which must remain verified on the owner's Genesis profile.
- Import the existing repository at that exact commit. This is the first IMD job for this work, not a continuation of an invented IMD parent job. Preserve accurate attribution: Wheelprints predates IMD involvement.
- Request a single website/code review and test job with source/report delivery only. No site hosting, contract launch, scheduled work, paid child jobs or automatic follow-up purchase. Review the platform's free preflight and actual quote before any payment. Do not choose a contract/token launch to satisfy the submission form.

## Copyable job objective

Review the existing Wheelprints art studio and Sepolia mint interface from the supplied public GitHub repository and pinned commit. Add useful, isolated wallet-flow regression tests and deliver a reproducible compatibility report. Wheelprints is already built, hosted and deployed. This job contributes review and tests; it must preserve the existing product and its attribution.

Live studio: https://wheelprints-sepolia.pages.dev/

Mint page: https://wheelprints-sepolia.pages.dev/testnet/

Ethereum Sepolia chain ID: 11155111.

Existing contract: `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`.

Verified source: https://eth-sepolia.blockscout.com/address/0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac?tab=contract

The app renders 27 compositions from three archived Squeekchain records. All 81 SVG/PNG/JSON exports, original renderer, visual seeds, recorded inputs, snapshots and commitments are fixed. The contract is deployed with its existing compiler artifacts and permanent HTTPS artwork root. Test minting is currently enabled; further contract deployment is disabled. Preserve both settings.

Read README.md, AGENTS.md and preservation/README.md first. Verify the protected baseline before and after work. Existing files under dist/, contracts/, hosting/, scripts/ and tests/, as well as package.json, package-lock.json and hardhat.config.cjs, are frozen except for the existing generated contracts/test-results.json report in a disposable test checkout. Do not regenerate art, rebuild the release in place, upgrade dependencies, edit the manifest/verifier, change Solidity or replace deployment files. Any compiler reproduction must occur in a disposable copy and reproduce the existing artifact exactly.

Write only new files under `imd-review/` and `tests/review/`. Do not patch application code. Record proposed fixes with locations and reproduction steps for later owner review. Keep the existing Cloudflare site, project, DNS, hosting settings and contract untouched. Do not rehost the site on IMD/IPFS or change the artwork origin.

Perform the existing local checks from the README. Review the rendered studio and mint page at approximately 390px and 1440px widths. Exercise available browser engines and record exact versions. Add isolated tests for concrete missing coverage, particularly wallet discovery/multiple providers, connection rejection, wrong chain, account or chain changes after review, RPC rate limits, duplicate eligibility, pending transaction recovery, and invalid contract/artwork evidence. Reuse the existing tests and public-read separation instead of duplicating their implementation. Never weaken a validation to make a test pass.

Use local fixtures for wallet interaction and mocked transaction responses. The review phase must not request a wallet signature or send a transaction. Read-only public HTTP/RPC checks against the existing contract are permitted. Do not connect to the owner's wallet, use private browser profiles, credentials or paid APIs, mint or transfer tokens, deploy anything, or start additional jobs. Clearly distinguish a simulated send in an isolated test harness from a real onchain transaction.

Rabby in Brave has already completed real mints. An earlier HTTP 429 from Rabby's shared RPC during verification caused “missing revert data”; the deployed frontend now performs bulk reads and sender-specific simulations through a public Sepolia read provider, and revalidates before signing. Protect those safeguards. Desktop viewport emulation is not proof of mobile wallet compatibility; unavailable devices/wallets must be marked untested. Real mobile signing remains an owner-led later test.

## Deliverables

1. `imd-review/REPORT.md`: environment, scope, exact commands and outcomes, browser/viewport coverage, findings with severity and reproduction steps, suggested fixes, and remaining owner-led wallet checks. Separate historical evidence from checks performed in this job.
2. `imd-review/results.json`: machine-readable check outcomes, protected-manifest hash, before/after preservation results, exact pinned input commit, and explicit false values for public transaction broadcast, website publication, contract deployment and paid child jobs.
3. `imd-review/screenshots/`: only relevant studio/mint screenshots, free of private wallet details. Label fixtures and viewport emulation accurately.
4. New tests under `tests/review/`, where they address meaningful missing coverage, with exact run instructions. Use the existing dependencies or document an optional external test runner without changing the lockfile.
5. `imd-review/ATTRIBUTION.md`: identify the original imported project and this job's actual review/test contribution, plus the genuine IMD job URL and source-delivery link assigned by the platform. Do not claim IMD originated the artwork or deployed the contract, or that Genesis eligibility/approval has been established.

## Acceptance

- The original 81 exports and every protected baseline file are byte-identical; check against the owner's pinned commit as well as the manifest.
- The contract, fixed artwork origin, deployment gate and mint configuration are unchanged.
- Existing tests pass or failures are reported with evidence. The known strict PNG raster environment mismatch is disclosed; portable hash verification is not described as strict pixel reproduction.
- Review findings are reproducible, and mock-only coverage is clearly distinguished from real wallet/device tests. Do not report a security audit or universal wallet compatibility.
- The delivered Git diff adds only the allowed report/test files. A bug report is a valid result; unapproved production fixes are not.
- No public-chain write, wallet signature, website upload, Cloudflare/DNS change, IMD hosting, or additional paid job occurs.

## References and unresolved platform choices

IMD documents public-repository import and pinned commits at https://imd.fun/docs/#from-your-repository and paid requests at https://imd.fun/docs/#how-paying-works. Its documented price when researched on October 31, 2026 was 0.5 IMD per request on Ethereum mainnet; the live quote governs any later purchase. This is not Sepolia test ETH.

Genesis Code's public rules require the first job's payer to be a verified profile wallet, and team approval is separate: https://squeekchain.com/genesis/code. A review/test job may or may not satisfy its current “built with IMD” requirement. Resolve that before buying this job solely for submission. Do not replace it with a cosmetic or misrepresented contribution.

The existing exported media makes the repository roughly 60 MiB. Use IMD's supported repository import/preflight to check its limits; do not omit, recompress or regenerate protected artwork to force acceptance. If the requested job or delivery type is unsupported, stop before payment and report the specific limitation.
