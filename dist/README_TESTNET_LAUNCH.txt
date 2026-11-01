# Wheelprints Sepolia handoff and launch guide

Prepared for Ian Demers on October 31, 2026.

## Release status

This is a source handoff and a prepared Cloudflare release, not a live deployment. Start with `CODEX_HANDOFF.md` in the developer archive when continuing the project in Codex. The hosting target is a separate project named **wheelprints-sepolia**. At preparation time, the site has not been uploaded to Cloudflare and the collectible contract has not been deployed. No deployment URL or custom domain has been assigned. Use the Cloudflare account that hosts your other project, then create this separate project; the package does not configure or replace Genome.

Compilation, 12 local contract test groups, 23 fault cases, all 27 variants and 7 frontend test groups passed. The local checks cover receiver callbacks, reentry, rollback, wrong-chain behavior and the frontend verifier; contract results are in `contracts/test-results.json`. A read-only Sepolia constructor simulation returned the exact 11,282-byte compiled runtime. The final browser check showed the deployment-paused message and disabled deployment controls.

**Deployment remains blocked.** A read-only estimate returned **19,841,860 gas**, above the supplied deployment guard's **16,777,216 gas** ceiling. `testnet/release-status.json` therefore has `deploymentEnabled: false`. Codex must resolve actual-source deployment gas and its network feasibility before any wallet deployment. Recompiling alone does not clear this gate. No real wallet deployment or end-to-end public mint has been completed. Reviewed source and constructor evidence are included in the developer archive's `handoff-evidence` directory.

The initial `testnet/deployment.json` leaves the contract unset. The mint page must stay unavailable until a real Sepolia deployment is confirmed and the resulting configuration is installed.

## What this rehearsal does

Wheelprints is an independent Sepolia ERC721 rehearsal built from three archived Squeekchain records, three forms and three palettes. It has 27 art variants. Each wallet may mint each variant once; these are reusable variants, not a promise of only 27 tokens. The mint price is zero, while deployment and mint transactions use Sepolia ETH for network gas.

The constructor checks the observed Core snapshots. Source values, seeds and artwork commitments are fixed in the contract. `tokenURI` returns JSON onchain, while the images remain the exact existing SVGs served over HTTPS. The base URL is the site root ending in `/`; the contract appends `exports/` and the filename. A fully onchain art renderer is future work. Keep that origin and those files available after deployment.

This is not an official Squeekchain release or a verified claim about physical sensor truth. The project's published manifest still differs from the observed Core deployment. Genesis attribution and approval remain separate questions.

## Choose the right archive

| Archive | Use |
| --- | --- |
| `Wheelprints_Codex_Handoff.zip` | Codex handoff notes, source, contract files, build and test scripts, dependency lock, reviewed evidence, hosting configuration and this guide. Use it to continue development and repeat local checks. |
| `Wheelprints_Cloudflare_Static.zip` | Prepared static assets for a Pages dashboard upload, with contract deployment still blocked. `index.html` is at the ZIP root, alongside `testnet`, assets, exports and public source data. |

Neither archive contains credentials, a wallet key, dependency installation folders, repository history or internal research. The static package includes a real `404.html`, so a missing configuration file does not silently become the home page. Configuration caching is disabled for `testnet/deployment.json`.

## Upload with Cloudflare Pages

1. Sign in to your Cloudflare account and open **Workers & Pages**.
2. Create a new **Pages** application using **Direct Upload** or **Drag and drop**, and name it `wheelprints-sepolia`.
3. Upload `Wheelprints_Cloudflare_Static.zip`, then review the project name and deploy the site. This ZIP is already built; do not upload the developer archive.
4. Copy the exact HTTPS URL that Cloudflare displays. Open the art studio and `/testnet/` at that origin. Minting should remain disabled because no contract is configured.
5. Use that project's **Create a new deployment** action for later updates. Upload the complete updated site, not just the changed JSON file.

Cloudflare's dashboard upload accepts a ZIP or folder and currently allows up to 1,000 files, with a 25 MiB limit per asset. The packaging script checks those limits. A Direct Upload Pages project cannot later be converted to Git integration; automatic Git deployment would require a separate project. [1][2]

## Or deploy Workers static assets with the CLI

From the unpacked developer project, with Python 3 and Node.js installed:

```sh
python3 scripts/package-cloudflare.py
npx wrangler@4 login
npx wrangler@4 deploy --config hosting/wrangler.jsonc
```

The configuration serves the generated `deliverables/cloudflare-static` directory. It has no account ID, custom domain, route to Genome, server function or secret. Review the selected Cloudflare account and the `wheelprints-sepolia` target before confirming deployment. Copy the actual HTTPS origin reported by Wrangler. Static assets are supported directly through `assets.directory`; a Worker script is not required for this site. [3]

To preview the same directory locally, use:

```sh
npx wrangler@4 dev --config hosting/wrangler.jsonc
```

Local HTTP preview is for interface checks. Use the final HTTPS site for the wallet deployment flow and its immutable image base URL.

## Deploy the contract from your wallet

These are the later launch steps after the gas requirement and remaining contract tests are resolved. Until then, the website can be reviewed with minting disabled.

1. Choose the HTTPS origin you intend to retain for the images. Open `/testnet/deploy.html` on that site. Cloudflare may display the equivalent extensionless `/testnet/deploy` path. [4]
2. Connect your wallet, switch to **Sepolia, chain ID 11155111**, and use Sepolia ETH for gas. The console derives the image base URL from the current HTTPS origin.
3. Select **Check release & estimate**. The console checks the observed Core and runtime fingerprints, all 27 hosted SVG hashes and the renderer hash, then simulates the constructor and estimates gas. Review the base URL and results, acknowledge the test collection, and select **Deploy with my wallet**. Review and sign the contract-creation transaction in your wallet.
4. Wait for a successful Sepolia receipt and the console's checks of the deployed runtime, source snapshots and variants. Receipt confirmation uses the fixed Sepolia reader, independently of later wallet network changes. Download the generated `deployment.json`; preserve the transaction hash and contract address.
5. Replace `testnet/deployment.json` in the unpacked static site with that exact file. If using the developer project, replace `dist/testnet/deployment.json` and rerun the packaging script. Upload the complete updated site to the same Cloudflare project.
6. Reopen `/testnet/`. Confirm the chain, contract, source checks and image origin match before testing a mint. Use your wallet to mint a chosen variant, then inspect the receipt, token owner, metadata and image.

Do not fill the contract field with a guessed address or mark a deployment verified by hand. The downloaded configuration is the result of the confirmed wallet deployment and the console's checks. A changed account or network must require the interface to recheck its state.

If the page closes after submission, reopen the console and use **Recover a deployment** with the saved Sepolia transaction hash. **Check deployment receipt** reconstructs the configuration only after the same verification. Check that transaction's outcome before starting another deployment. The page never asks you to enter a private key or recovery phrase.

## Repeat the local contract rehearsal

The developer archive includes the dependency lock and prebuilt artwork. Node 24.22.1 was used for the completed local tests. From the archive's root:

```sh
npm ci --ignore-scripts
npm run build:contracts
npm run test:contracts
node tests/testnet-ui-check.cjs
```

These commands compile and test the rehearsal locally. They do not deploy it to Sepolia or clear the gas gate. Keep the existing committed SVGs when reproducing this build; rebuilding artwork is a separate release decision.

## Rebuild and set the final web metadata

The packager copies `dist` into a clean upload directory without changing the source website. It removes the original host's canonical and social URL metadata. Once you know the actual Cloudflare HTTPS origin, rerun it with that origin as `--site-url` to write correct absolute canonical and social image URLs:

```sh
python3 scripts/package-cloudflare.py --site-url "$WHEELPRINTS_ORIGIN"
```

Set `WHEELPRINTS_ORIGIN` to the exact HTTPS origin shown by Cloudflare before running that command. It must contain no path, query, credentials or fragment. The option changes web metadata only; it does not change an already deployed contract's image base URL.

Use the dependency lock and the project's documented build and test commands when modifying the contract or art. Regenerating committed artwork changes its hashes and requires a new contract rehearsal. The existing SVG files preserve their original pre-mint provenance; the new ERC721 metadata describes the Sepolia collectible.

## Final checks before inviting test mints

- The site opens at its real HTTPS origin in a signed-out desktop browser and on a physical phone.
- Missing, empty, wrong-chain or unverified deployment configuration leaves minting disabled.
- The deployment receipt succeeded on Sepolia; the installed configuration matches that contract and the intended image origin.
- A test mint produces the expected owner, variant and metadata. Repeating the same variant from that wallet is rejected.
- SVG, PNG, provenance JSON and the generated deployment configuration can actually be saved on your device. Automated file validation does not prove native wallet or browser saving.
- The published copy says **Sepolia rehearsal**, distinguishes hosted images from onchain metadata, and makes no official endorsement, reward, mainnet or sale promise.

## Official hosting references

Checked October 31, 2026.

1. Cloudflare Pages Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
2. Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
3. Workers static asset configuration: https://developers.cloudflare.com/workers/static-assets/binding/
4. Cloudflare Pages route and 404 behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
5. Workers static asset headers: https://developers.cloudflare.com/workers/static-assets/headers/
