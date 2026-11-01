# GitHub preparation — local only

Suggested repository name: **wheelprints**. No GitHub owner/account has been selected. No remote repository, public URL or final commit has been created by this preparation.

The local folder is ready to review. A source ZIP is supplied separately; it contains the same project files without `.git`, dependency installations, machine caches, credentials or duplicate release ZIPs. All 81 artwork files are included as ordinary Git files. Keep `dist/` tracked. No Git LFS pointers or runtime asset downloads are required.

## Before a future publication

1. Review the README, job brief, RIGHTS.md and included dated evidence. Public contract addresses, transaction hashes and source URLs are intentionally included. There are no wallet keys, signing credentials or Cloudflare tokens in the prepared files.
2. Choose the GitHub account and confirm public visibility. Public visibility is needed for the documented IMD repository import. No new artwork or repository-wide license has been selected on the owner's behalf.
3. Publish the reviewed folder as its own repository, including dotfiles, the lockfile and all artwork. Do not publish the parent outputs directory, install dependencies into Git, or upload the source ZIP to Cloudflare.
4. Do not connect GitHub to Cloudflare or enable deployment actions. The current Pages project remains on its existing Direct Upload workflow.
5. Record the actual GitHub URL and accepted full commit SHA in the separate submission notes. They are currently unset in IMD_JOB_BRIEF.md. Avoid placeholder URLs in a paid request.
6. Resolve Genesis eligibility and its destination-URL behavior, then inspect IMD's no-payment import/preflight before authorizing any paid job. Publishing to GitHub does not itself satisfy Genesis attribution.

For this preparation, Git may be initialized locally on `main` so the complete file list can be reviewed. Staging files is local and is not publishing. No remote, push, GitHub Actions run, website upload or wallet action is part of this task.

## Verification

Run `node scripts/verify-preservation.cjs` before and after publication or extraction. This verifies original bytes independently of any Git line-ending settings; `.gitattributes` also disables line-ending conversion for this preserved snapshot.

The manifest authenticates file equality to the supplied baseline, not authorship. Pin and retain the accepted Git commit and archive SHA-256 before giving the repository to another worker. Do not accept changes to the baseline/verifier as evidence of preservation.
