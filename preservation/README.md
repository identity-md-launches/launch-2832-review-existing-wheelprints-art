# Protected baseline

`manifest.json` records the exact original bytes of all files in `dist/`, all Solidity sources, original scripts and tests, the package/lockfile, Hardhat configuration and Cloudflare configuration. It also protects the prior Cloudflare upload manifest. No protected file may be changed for the proposed review job.

Run:

```sh
node scripts/verify-preservation.cjs
```

It fails on missing files, symlinks, unexpected files under the original application directories, hash differences, or changed deployment identity/gates. It never updates the manifest. New isolated review tests are permitted only under `tests/review/`; reports belong under `imd-review/`. `contracts/test-results.json` is an existing generated test report and is not a contract source.

Hash checks detect changes against this baseline. They do not authenticate their own origin: after publishing, pin the owner's accepted Git commit, and compare the baseline and verifier to that commit as well. An edited manifest/verifier is not an acceptable way to pass.

`cloudflare-upload-manifest.json` was read from the previously uploaded release ZIP, without running the packager or uploading anything. It is evidence of the known uploaded package, not a new claim that every current HTTP response was re-fetched during this preparation.
