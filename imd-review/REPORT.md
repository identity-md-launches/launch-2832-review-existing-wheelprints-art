# Wheelprints wallet-flow review and compatibility report

This is a review-and-test contribution. It is **not** a security audit and does not establish universal wallet compatibility. No application, contract, hosting or artwork file was changed.

## Scope and environment

- Input: https://github.com/p20w355/wheelprints at pinned commit `7c82c2ebe32d238feacd4896e9f56f599c1ac04f` (checked-out `HEAD` matched it exactly).
- Machine: Linux x86_64, Node v24.21.0 (README records 24.19.0), npm 11.19.0. `npm ci --ignore-scripts`; lockfile unchanged.
- Date: 2026-11-01 (UTC).
- Protected manifest `preservation/manifest.json` SHA-256 `74a3654b8f9c0a030fd2a1e5112d418e92b86a9f4562b0fd8afd89c151351585`; verifier `scripts/verify-preservation.cjs` SHA-256 `a75f33b4b28b927fb00d95a2af542570f4a8e6a9e336ad77c3b377dd0c08a24e`. Both are unchanged from the pinned commit.
- Files written: only `imd-review/**` and `tests/review/**`.

## Checks performed in this job

| Command | Outcome |
| --- | --- |
| `node scripts/verify-preservation.cjs` (before) | PASS: 144 protected files, 81 exports, deployment and closed gate preserved |
| `node tests/testnet-ui-check.cjs` | PASS (8 checks) |
| `npm run test:app` | PASS |
| `npm run test:mint-flow` | PASS |
| `npm run test:deployment-rejection` | PASS |
| `npm run test:deployment-gas` | PASS |
| `npm run test:exports:portable` | PASS. Archived PNG bytes were checked by hash only. No raster pixel comparison. |
| `npm run test:contracts` (disposable copy in `/tmp`) | PASS (12 grouped checks, in-process local EVM) |
| `npm run build:contracts` (same disposable copy) | Compiled with solc 0.8.38. Afterwards, preservation PASS and `git status` clean in the copy, so the artifact, commitments and vendor bundle reproduced byte-for-byte |
| `node tests/review/wallet-flow-review.cjs` (new) | PASS (21 checks) |
| `node tests/review/live-readonly-check.cjs` (new, read-only network) | PASS at Sepolia block 12041936. Runtime hash `0xd4272dcf…1cbc` matches `deployment.json`, artwork root is `https://wheelprints-sepolia.pages.dev/`, and all 27 hosted SVGs match their committed hashes |
| `node scripts/verify-preservation.cjs` (after) | PASS (same result) |

I did **not** run `npm run test:exports` (strict PNG re-render). The owner already reports a raster/font environment mismatch for that check. The portable result above is hash verification, not strict pixel reproduction.

## Browser and viewport coverage

| Target | Status |
| --- | --- |
| Chromium (Playwright 1.64.1, Chrome Headless Shell 156.0.8078.4) | **Failed to launch**: `libnspr4.so` is missing on this machine. No other engine was installed. |
| Studio and mint at 390px and 1440px | **Untested** in this job. No screenshots were produced (see `screenshots/README.md`). |
| Firefox, WebKit/Safari | Untested |
| Real wallets (Rabby, MetaMask, Coinbase, etc.) and real mobile devices | **Untested**. This needs an owner-led test. |

Viewport emulation would not have proven mobile wallet compatibility in any case.

## Historical evidence (not re-performed here)

- The owner reports completed real mints from Rabby in Brave.
- The owner reports that an earlier HTTP 429 from Rabby's shared RPC surfaced as "missing revert data". The deployed frontend now does bulk reads and sender-specific simulation through the public read provider (`T.readProvider`) and revalidates before signing. The existing `tests/mint-flow-check.cjs` already covers the 429 during review, no wallet RPC reads, and revalidation.
- `handoff-evidence/` and `docs/history/` are taken as the owner's records. I did not re-verify them beyond what the existing tests assert.

## New tests (`tests/review/`)

Run them from the repository root after `npm ci --ignore-scripts`. They use only existing dependencies.

```sh
node tests/review/wallet-flow-review.cjs      # offline, local fixtures only
node tests/review/live-readonly-check.cjs     # optional, read-only public RPC + HTTPS GET
```

`wallet-flow-review.cjs` runs the shipped `dist/testnet/mint.js` in a VM, just as `tests/mint-flow-check.cjs` does. The difference is that it uses the **real** `createSession` from `shared.js` against a local EIP-1193 fixture wallet. The existing test mocks the session object. The new file adds coverage for:

- **No injected wallet:** the error message appears and the controls stay closed.
- **Multiple providers:** characterises the current behaviour, where only `window.ethereum` is used (F1).
- **Connection rejection:** EIP-1193 code 4001 shows "declined" and no signer is acquired.
- **Wrong chain:** with the real session, preparing a mint stays disabled and the switch-network button is shown.
- **Changes after review:**
  - Real `chainChanged`, `accountsChanged` and `disconnect` events each invalidate the review.
  - A change with no event is caught by revalidation before signing.
- **RPC 429 during pre-sign revalidation:** covers both a read-provider failure and a simulation failure. Either way no signer is acquired, nothing is sent, nothing is saved as pending, and the message reports rate limiting.
- **429 on the `minted()` eligibility read:** fails closed. A duplicate also blocks before simulation.
- **Pending recovery on reload:**
  - A hash for this contract shows the "check previous" link.
  - A hash for another contract, a malformed hash or a script-like value is ignored.
  - The real `savePending`/`pending` round-trip works, and corrupt storage is tolerated.
- **Invalid contract or artwork evidence:**
  - The real `verifyContract` rejects a wrong network, empty code, one changed byte of code and a bad address, all before any contract call.
  - The real `verifyArtwork` rejects HTTP 404, HTTP 429 and a one-byte change in content.
  - `validateDeployment` rejects an `http:` origin, a bad tx hash and mainnet.

**Mock-only coverage:** every "send" in these tests is a counted call on an in-memory object. No wallet signature was requested, and no transaction was created, signed or broadcast. The tests prove the page logic against fixtures, not against any real wallet.

## Findings

None of these is a fund-loss issue. All are proposals for owner review. No fix was applied.

**F1 — Low/Medium: no EIP-6963 multi-wallet discovery.**
- Location: `dist/testnet/mint.js:20` (`T.createSession(window.ethereum, …)`) and `dist/testnet/shared.js` `createSession`.
- Problem: with several extensions installed (for example Rabby and MetaMask), the page talks to whichever one won `window.ethereum`. The user cannot choose.
- Reproduce: see the "Multiple providers" check in `tests/review/wallet-flow-review.cjs`, or install two wallets in one browser profile.
- Suggested fix: listen for `eip6963:announceProvider` and dispatch `eip6963:requestProvider`. Offer a picker, and fall back to `window.ethereum`. Keep all reads on the public read provider.

**F2 — Low: a rejected wallet connection leaves no retry hint beyond the generic message.**
- Location: `mint.js` connect handler, through `T.errorMessage`.
- Problem: the message says "No new transaction was confirmed by this page." That is correct but phrased for a transaction rather than a connection.
- Reproduce: the "Connection rejection" check.
- Suggested fix: give a distinct message for a declined `eth_requestAccounts`. This is cosmetic only.

**F3 — Low: the pending-transaction notice is advisory.**
- Location: `mint.js:105-110` (reload notice) and `mint.js:79` (pending in-page).
- Problem: after "Confirmation is still pending" or a reload, the user can review and submit the same variant again. `minted()` reads false until the first transaction is mined. The contract enforces one mint per wallet per variant, so a second transaction would revert onchain and cost Sepolia gas only.
- Two smaller points:
  - The saved record includes `account` and `variantId`, but the notice does not use them.
  - The saved record is never cleared after confirmation.
- Reproduce: the "Pending notice is advisory only" check, or let `waitForTransaction` return `null` as in the existing `tests/mint-flow-check.cjs` `pending` fault.
- Suggested fix:
  - In `prepare()`, when a saved hash matches the account, variant and contract, read its receipt through the read provider before allowing review.
  - Clear the record on a confirmed receipt.

**F4 — Info: `CHAIN_ID` is passed to `JsonRpcProvider` together with a single public endpoint.**
- Location: `shared.js` `readProvider`, which uses `ethereum-sepolia-rpc.publicnode.com`.
- Problem: this is the safeguard that fixed the Rabby 429, and I recommend keeping it. However, a 429 or outage on that one public endpoint now blocks review entirely. That fails closed, which the tests confirm, but it is a single point of availability.
- Suggested fix: optionally add a second public read endpoint (`FallbackProvider` with quorum 1, or retry with backoff). Do not move reads back to the wallet RPC.

Things I checked that hold: the existing fail-closed revalidation before signing, the explicit `from` in simulation and estimate, no wallet RPC reads during review, the runtime and artwork attestations, and the closed deployment gate. I found no reason to change any of them.

## Remaining owner-led checks

1. Real mints on mobile with MetaMask Mobile, Rabby Mobile and Coinbase Wallet in their in-app browsers, and with WalletConnect if it is added later.
2. A desktop profile with two wallet extensions installed (F1).
3. Visual review of the studio and mint pages at about 390px and 1440px in Chromium, Firefox and Safari. This job could not launch a browser.
4. Pending-then-reload behaviour with a real slow transaction (F3).
5. A strict PNG raster check (`npm run test:exports`) in the original font/raster environment.
