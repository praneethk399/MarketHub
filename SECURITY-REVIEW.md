# MarketHub Security Review

**Assessment date:** 2026-10-06

**Repository:** https://github.com/praneethk399/MarketHub

**Reviewed baseline:** `main` at `b42956c`, with integration follow-up on the social-commerce working tree.

## Executive summary

The static source review found no currently actionable exploitable code-level vulnerabilities in the reviewed scope, including the integrated social routes and services. During integration, a privacy-scope defect in a reading-completion badge was found and fixed: friends-only completion is now shown only to accepted friends, and only alongside verified-purchase reviews. The initial full dependency audit found two HIGH-severity advisories in Prisma's dependency tree; both were remediated. The final full pnpm audit reported no known vulnerabilities.

## Findings and remediation

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | HIGH | `pnpm-lock.yaml:782` (initial resolution) | `effect@3.18.4` was affected by [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g): AsyncLocalStorage context may be lost or contaminated under concurrent RPC work. | **Resolved.** Upgraded `prisma` and `@prisma/client` to `6.19.3`; current lockfile resolves `effect@3.21.0` at `pnpm-lock.yaml:785`. |
| 2 | HIGH | `pnpm-lock.yaml:764` (initial resolution) | `deepmerge-ts@7.1.5` was affected by [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): recursive object merging can cause stack exhaustion. | **Resolved.** Added a scoped pnpm override to `8.0.2`; current lockfile resolves `deepmerge-ts@8.0.2` at `pnpm-lock.yaml:767`. |

## Validation performed

| Check | Result |
| --- | --- |
| Static review for backdoors, injection, authorization, validation, unsafe sinks, privacy, and Prisma access | No actionable exploitable source findings reported in the reviewed files/diffs |
| `corepack pnpm audit` | Passed after remediation: no known vulnerabilities |
| `corepack pnpm audit --prod` | Passed: no known vulnerabilities |
| `corepack pnpm test` | Passed: 24 tests, including privacy-scope and verified-review trust regressions |
| `corepack pnpm typecheck` | Passed |
| `corepack pnpm build` | Passed for the integrated workspace |
| Prisma schema validation using a placeholder `DATABASE_URL` | Passed; no database connection was made |
| Dynamic penetration testing | Not run |

The review covered the existing marketplace plus the social routes, services, models, seed behavior, and regression tests in the integration working tree. The social seed is disabled in production, and mock social demo accounts are not created in production mode. Trust metrics use verified reviews and explain ISBN checksum coverage as an identifier signal, not proof of physical-item authenticity.

## Limitations and follow-up

- No dynamic pentest was run: Docker and the Strix LLM settings were unavailable, and no deployed target was supplied.
- No deployment or live application was probed.
- The test suite covers core social authorization/privacy invariants but does not replace dynamic testing or production database testing.
- The process-local mock store and rate limiter are not distributed production controls.

For the full project record following the supplied documentation template, see [docs/security-assessment.md](docs/security-assessment.md).
