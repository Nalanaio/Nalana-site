# Implementation checklist

- [x] Inspect live repository policy, main, dirty checkout and overlapping PRs.
- [x] Create isolated worktree and pin Grace reference.
- [x] Run baseline test/check/build and capture rendered original reference.
- [x] Separate subagents write site and animation implementation plans.
- [x] Separate coding subagent implements coordinated plans and focused tests.
- [x] Run final check, Node tests, build, HTTP integrations and automated browser checks; retain failures explicitly in the results.
- [x] Review screenshots, implementation and functional preservation; fix adaptation defects found in review.
- [x] Save local evidence/results and report exact remaining limitations in `C:/Nalana/evidence/site-grace-design-20261016/IMPLEMENTATION-RESULTS.md`.

Acceptance follow-ups, distinct from completing this local implementation/test run:

- [x] Resolve the preexisting Firefox root-error-module cancellation on immediate account redirects. Narrow Kit preload compatibility fix verified with the strict exception audit enabled; the latest full matrix passes 156/156.
- [ ] Jordan reviews the visible result; hardware Safari/GPU, physical touch, assistive technology, zoom and production performance acceptance remain separate.

Subsequent authorization: Jordan requested a separate dev deployment for personal testing. Deployed and smoke checked at https://nalana-grace-dev.vercel.app; see `C:/Nalana/evidence/site-grace-design-20261016/DEV-DEPLOYMENT.md`. On October 17, Jordan also authorized committing, pushing the feature branch and opening a PR. Merge and production deployment remain outside this authorization.

Dev review follow-up:

- [x] Device-specific desktop downloads; both choices on phones/tablets, including iPad desktop mode.
- [x] Existing Three.js demo replaces workflow screenshot, with owned playback and narrow layout.
- [x] Existing section 02 five-app animation replaces the laptop's static frame.
- [x] Focused browser checks, 178 Node tests and Svelte check pass.
- [x] Complete broader browser regression and visual review; update the separate dev site and verify its live result. Full matrix retains two failures (known Firefox cancellation and one WebKit avatar timeout); avatar passed 3/3 isolated reruns. See `C:/Nalana/evidence/site-grace-design-20261016/FOLLOWUP-RESULTS.md`.

October 17 regression repair (supersedes the failure state recorded above):

- [x] Own unused Kit preload rejections, replace invalid avatar PNG fixture, and stabilize the verification countdown controls.
- [x] Add verification recovery and current credit/plan tests; exercise real login/profile/avatar/verification/accounting/download behavior with a disposable FastAPI database.
- [x] Pass 181 Node tests, 156 browser tests with zero skips/failures, 65 actual-backend checks, 12 download handler checks and Svelte check (zero errors).
- [x] Deploy a fresh build only to the existing dev project; verify 24 live HTTP checks, account/recovery flows in Chromium/Firefox/WebKit with synthetic API responses, and all five device/demo/laptop checks.
- [x] Save current evidence at `C:/Nalana/evidence/site-grace-design-20261016/regression-fix-20261017/REGRESSION-FIX-RESULTS.md`. Production remains unchanged; real mailbox delivery, installed binaries and human/hardware acceptance remain separate.
