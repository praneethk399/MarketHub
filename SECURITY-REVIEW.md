# MarketHub Security Review

**Assessment date:** 2026-10-06

**Repository:** https://github.com/praneethk399/MarketHub

**Reviewed baseline:** `main` at `b42956c` plus the working-tree changes available during the review.

## Executive summary

The static source review found no actionable exploitable code-level vulnerabilities in the reviewed scope. The initial full dependency audit found two HIGH-severity advisories in Prisma's dependency tree. Both were remediated. The final full and production-only pnpm audits reported no known vulnerabilities.

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
| `npm run build` | Passed on the final run, including TypeScript and static page generation |
| Prisma schema validation using a placeholder `DATABASE_URL` | Passed; no database connection was made |
| Dynamic penetration testing | Not run |

The review covered the committed application and the working-tree service files, including late-appearing modules and later changes to `lib/validation.ts` and `services/reviews.ts`. These working-tree application files remain untracked or modified and were not included in the remediation/report commits.

## Limitations and follow-up

- No dynamic pentest was run: Docker and the Strix LLM settings were unavailable, and no deployed target was supplied.
- No deployment or live application was probed.
- No automated test suite was present in the inspected repository.
- The process-local mock store and rate limiter are not distributed production controls.

For the full project record following the supplied documentation template, see [docs/security-assessment.md](docs/security-assessment.md).
