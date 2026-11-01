# GitHub preparation verification

Prepared October 31, 2026 (America/Denver). Checks ran in a disposable copy, leaving the original project and prepared delivery unchanged.

## Results

| Check | Result |
| --- | --- |
| Fresh pinned dependency installation | Passed with Node 24.19.0 / npm 11.8.0; `npm ci --ignore-scripts --no-audit --no-fund`; 250 packages |
| Contract build | Passed; solc 0.8.38, optimizer 1, viaIR, Cancun; exact artifact/commitments/vendor bytes reproduced |
| Contract/EVM suite | Passed: 12 groups, including 23 injected source faults and all 27 variants |
| Frontend suite | Passed: 8 groups |
| Studio application suite | Passed |
| Mint-flow suite | Passed, including public reads, sender-specific simulation, stale wallet, rejection and RPC failures |
| Deployment-rejection suite | Passed; its historical unconfigured-mint fixture does not describe the current live mint gate |
| Deployment-gas suite | Passed: transaction-validation case and 9 fail-closed cases |
| Portable artwork suite | Passed: 27 combinations and all 81 archived export files; exact bytes, provenance and dimensions |
| Preservation baseline | Passed: 144 protected files, before and after build/tests |
| Preservation negative checks | Rejected modified artwork, missing deployment configuration, enabled deployment and an unexpected application file |
| Original project comparison | Original source files remained unchanged; all copied application, contract, script and test files matched |
| Cloudflare reference | Existing upload archive SHA-256 matched the recorded Rabby-fix release; 111 file hashes extracted without repackaging/upload |
| Publication content scan | No unresolved credential-pattern, embedded-auth-URL or local-home-path findings; one example.com rejection-test fixture reviewed |
| Git whitespace check | Seven pre-existing whitespace-only lines in protected `dist/index.html`; retained to preserve its exact bytes |

Detailed local check output is under `verification/` beside this document. The new preservation verifier was tested with temporary mutations that were restored in the disposable copy.

## What these checks do not establish

- No fresh public-chain verification, hosted-site sweep or signed wallet test was performed for this packaging-only task. Previously recorded live verification remains in handoff-evidence.
- Strict PNG re-render equality was not repeated; the earlier Mac raster/font discrepancy remains. Portable verification proves the archived PNG bytes are intact, not that arbitrary environments reproduce their pixels.
- The contract suite's gas figures are from a local mock-source EVM. They are not current Sepolia deployment estimates.
- Dependency versions remain pinned. The install emitted upstream deprecation notices. A fresh vulnerability audit was not run; earlier dependency audit evidence is historical.
- A pattern scan cannot guarantee that arbitrary content has no sensitive information. Public chain addresses, transactions and provenance are deliberately retained for review.
- Actual mobile wallet coverage and public transfer testing remain unverified. An IMD review/test job's eligibility for Genesis and Cloudflare destination handling remain unresolved.

No GitHub publication, IMD submission/payment, Cloudflare change, contract deployment, public mint or transfer occurred in this preparation. Existing per-file licenses were retained; no blanket artwork license was added.
