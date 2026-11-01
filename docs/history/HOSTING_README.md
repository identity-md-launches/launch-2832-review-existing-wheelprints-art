# Wheelprints — Rabby mint check fix

## Current release

This package enables website test minting against the verified Wheelprints Sepolia contract:

- Contract: `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`
- Deployment: `0x2c2726d1219306d40b32d534ed2f764292cc0e4536eb61426ffd158c8e124901`
- Chain: Ethereum Sepolia, `11155111`
- Permanent artwork root: https://wheelprints-sepolia.pages.dev/
- Mint price: zero; Sepolia ETH is required for gas.

The deployed creation bytes, runtime, all 27 variants and three full source snapshots have been independently checked. Receipt recovery passed. The existing art, renderer, source snapshots and commitments remain byte-identical. No new contract is required: `deploymentEnabled` is false to close the deployment controls, while the installed verified `deployment.json` enables the mint page. These are separate controls.

The current live site has test minting enabled, but Rabby’s shared Thirdweb RPC returned HTTP 429 while reading source snapshots. The resulting ethers error was “missing revert data.” This replacement package runs the same full attestations, sender-specific mint simulation and estimate through the existing public Sepolia read provider. It repeats contract and artwork validation before the wallet request. Rabby still controls account, network and transaction approval. Network failures remain blocking, and nested rate limits now have a clear message. No gas allowance is increased.

The fix is prepared locally; uploading it remains a user step. Preparing and testing it does not publish the site or mint a token.

## Upload the website update

1. Open Cloudflare **Workers & Pages → wheelprints-sepolia**.
2. Choose **Create a new deployment → Production**.
3. Click **file** and select **Wheelprints_Cloudflare_Rabby_Fix.zip** from this chat's outputs folder. The ZIP is already saved on the Mac; do not double-click it. Alternatively, choose **folder** and select **Wheelprints_Rabby_Fix_Upload_111_Files** itself.
4. The upload has 111 files, with `index.html`, `assets`, `exports` and `testnet` at the root. Do not upload the developer archive, the source project, or a parent folder containing other outputs.
5. Click **Save and deploy** and wait for success. This updates the website; the contract is already deployed.
6. Open https://wheelprints-sepolia.pages.dev/testnet/ in Brave. The page should say **Sepolia deployment configured** and offer an enabled **Connect wallet** button. Its contract link must point to the address above. Use this stable URL rather than a hash-specific deployment URL.

Cloudflare Direct Upload supports ZIPs or a folder, and existing projects can receive production updates through Create a new deployment: https://developers.cloudflare.com/pages/get-started/direct-upload/

## Mint the first test token

1. Open the stable **/testnet/** mint page, connect the intended wallet, and select Sepolia. This is the mint page, not **/testnet/deploy**.
2. You can keep **Surge / Bloom / Midnight** selected (variant 26), the composition used to diagnose this failure. The unsigned public-RPC check passed and estimated **492,477 gas**. Obtain a fresh estimate; the actual token ID and fee depend on chain state when the transaction executes.
3. Click **Review test mint**. The page rechecks the deployed code, source snapshots, all variant commitments, selected hosted SVG, wallet eligibility, and simulated mint. Preparing a review must not send a transaction.
4. Confirm the selected print, recipient, Sepolia network, verified contract address, zero mint price, and fresh network fee.
5. Click **Confirm in wallet** once. In the wallet, confirm that the destination is the existing contract above, the call is a mint (not a contract deployment), the network is Sepolia, and the transfer value is zero apart from the network fee. Review the wallet's own fee and gas limit before approving. This is the actual mint, so approve when those details match.
6. Save the transaction hash and wait. Success should show **Test print #1 was minted** (or the actual assigned ID) and **Confirmed on Sepolia. Your chosen artwork now has a test token.**
7. Send the transaction hash and token ID back for independent owner, variant, tokenURI, image and receipt checks. Stop after one successful mint for this first test.

If the wallet or page reports an error, preserve the exact text. If a transaction hash exists, check that transaction before retrying. The page preserves a pending transaction link across reloads. A wallet rejection should show a declined-request message without a new submitted hash.

## Verification and limits

Each wallet may mint each of the 27 variants once. Transfers do not reset the original minter's eligibility. This is a reusable-variant rehearsal, not a 27-token edition. Metadata is onchain; SVG images remain hosted at the fixed origin. The contract has no pause switch. Website configuration controls the interface, while direct contract mint calls remain possible.

The deployment wallet submitted a gas limit of 29,860,112 despite a page review of 21,897,416. Actual gas used was 19,748,837, matching simulation. The source of the override was not established. Inspect the wallet's final fee and gas limit during minting; do not reuse the deployment gas figures for a mint.

The existing artwork files are preserved. Portable export checks validate all 81 files, hashes, dimensions and provenance. Strict PNG pixel re-render equality remains unverified in the original raster/font environment. Explorer source-code publication, actual mint ownership/metadata checks, and transfer testing remain separate work. No mainnet activity, reward or official Squeekchain endorsement is implied.

## Developer checks and packaging

Use the existing pinned dependencies. For this frontend fix, run:

```sh
node tests/testnet-ui-check.cjs
npm run test:mint-flow
npm run test:deployment-rejection
npm run test:deployment-gas
npm run test:exports:portable
python3 scripts/package-cloudflare.py --site-url https://wheelprints-sepolia.pages.dev
```

The packager creates `deliverables/Wheelprints_Cloudflare_Static.zip` and a developer handoff archive. The separately named **Wheelprints_Cloudflare_Rabby_Fix.zip** is the same static release for this checkpoint. Only the static ZIP or its clean upload folder belongs in Cloudflare. The developer handoff contains source, tests and evidence for continuation; do not upload it as a website.

No compiler or artwork rebuild is needed for this frontend-only release. Read CODEX_HANDOFF.md for the complete historical evidence and preservation requirements.
