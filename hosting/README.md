# Existing Cloudflare deployment — unchanged

The live project is **wheelprints-sepolia**, at https://wheelprints-sepolia.pages.dev/. It uses Cloudflare Pages Direct Upload. The current mint page is `/testnet/` and uses the already deployed Sepolia contract `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`.

This GitHub preparation requires **no Cloudflare upload or configuration change**. Do not connect the repository to automatic builds, run a deploy command, replace the Pages project, change DNS, or use an IMD mirror as the token artwork origin. Existing token metadata fixes the artwork root to this Cloudflare URL.

The files `_headers`, `404.html` and `wrangler.jsonc` are unchanged historical configuration. The Wrangler assets path references generated `deliverables/cloudflare-static`; that folder is intentionally excluded from GitHub. No Wrangler command is needed for this task.

`scripts/package-cloudflare.py` remains available as a historical local packaging tool. It creates files but does not upload them. It is not needed for the proposed review and its developer archive does not include every new GitHub-preparation document. Use the GitHub preparation ZIP for this handoff.

`preservation/cloudflare-upload-manifest.json` records all files in the previously uploaded Rabby-fix package and its archive hash. The source `dist/` is preserved separately; the packager historically adjusted HTML metadata and packaging notes. Do not claim `dist/` is an exact mirror of every packaged HTML byte.

Earlier upload and first-mint instructions are retained in `docs/history/HOSTING_README.md` solely as history. The source was subsequently published on Blockscout and the first mints succeeded.
