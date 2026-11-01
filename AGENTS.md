# Wheelprints review boundary

Read README.md, IMD_JOB_BRIEF.md and preservation/README.md first. This repository prepares an existing live project for review; it is not authorization to publish, buy work, deploy or mint.

- Preserve the exact files listed in preservation/manifest.json. Run `node scripts/verify-preservation.cjs` before and after work. Do not edit or regenerate the baseline to excuse a change.
- Existing art exports, source records, renderer, seeds, commitments, Solidity files, compiler settings/artifacts, dependencies, frontend files and hosting configuration are frozen for the proposed IMD review.
- Existing Sepolia contract: `0xB6d7f55b80283AbFdCcC95C22764c2EAB2aD23Ac`, chain 11155111. Fixed artwork root and production site: `https://wheelprints-sepolia.pages.dev/`.
- New deployment remains disabled; existing test minting remains enabled. Do not alter either configuration, the artifact, host origin or contract address.
- For the proposed IMD job, additions are limited to `imd-review/` and `tests/review/`. Review and test existing behavior; describe fixes for later owner review instead of changing application code. Run builds in a disposable copy.
- Do not publish or rehost the website, connect GitHub to Cloudflare, change DNS, deploy contracts, mint, transfer, request wallet signatures, buy additional work, or use account credentials. Read-only public chain and HTTP checks are allowed.
- Do not claim IMD originally authored Wheelprints, Genesis approved it, strict PNG reproduction passed, or a mock wallet proves real wallet compatibility.
- Current instructions take precedence over the historical documents in docs/history and the preserved deployment walkthroughs in dist. Follow any later explicit owner instruction that changes scope.
