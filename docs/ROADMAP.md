# Fitness Companion roadmap

This file is the living scope record for the Android private alpha. Update it whenever a feature is added, deferred, or discovered so that reduced scope does not become lost scope.

## Product constraints

- Android only for the private alpha.
- Designed for generally healthy adults (18+); not for pregnancy, breastfeeding, minors, or clinical nutrition.
- Core use requires no account, network connection, or hosted backend.
- All personal, nutrition, inventory, and workout data is stored locally.
- Online AI features are optional and must never block the offline workflow.
- Recalibration must show what changed, the evidence used, why it changed, confidence, and an undo path.
- Publishing and app-store preparation are out of scope; this is a private sideloaded app.

## Current sprint: private alpha foundation

- [x] Isolate development on the `fitness-companion` branch.
- [x] Give the fork a distinct Android application ID and SQLite database.
- [x] Add versioned SQLite tables for nutrition, profile history, plans, recalibration, inventory, and workouts.
- [x] Extend foods and meal snapshots with protein, carbohydrate, fat, and fiber.
- [x] Consolidate meal entry and daily calorie/macro status on Today/Home.
- [x] Add fixed-daily and flexible-weekly calorie modes.
- [x] Add an offline macro calculator for generally healthy adults.
- [x] Keep all plan history and expose restore actions for the latest three versions.
- [x] Add a seven-day calorie/macro routine.
- [x] Add transparent baseline/profile nutrition recalibration reports.
- [x] Add trend-based nutrition recalibration after sufficient weight and adherence history.
- [x] Add on-device English/Latin nutrition-label OCR with manual confirmation.
- [x] Add workout templates and logging for sets, reps, load, RIR/RPE, cardio, pain, and recovery.
- [x] Add transparent workout recalibration reports.
- [x] Add local inventory.
- [x] Add validated local JSON export/import backup with automatic pre-import recovery.
- [x] Build and verify a signed private Android debug APK.
- [x] Fix native transaction handling found during the first device test.
- [x] Make active weekday plans authoritative for Today while preserving manual fallback targets.
- [x] Persist the complete calculator draft and latest body measurements.
- [x] Add discard, automatic revert, undo, and three-version workout history.
- [x] Replace technical goal selection with physique outcomes and an explained first-phase recommendation.
- [ ] Complete the physical-device smoke test in `docs/ALPHA_TESTING.md`.

## Next after the offline alpha

- [ ] Pantry-aware recipe prompt export to the Android share sheet for ChatGPT or Claude.
- [ ] Optional integrated recipe assistant through a provider-neutral serverless proxy.
- [ ] AI-assisted workout-plan explanations and revisions, with deterministic validation.
- [ ] Expiration reminders and optional confirmed inventory deductions.
- [ ] Exercise and body-measurement charts.
- [ ] Accessibility review for comfortable private use.

## Explicitly deferred

- [ ] Rewards and points as an independent section.
- [ ] Shared household inventory and synchronization.
- [ ] Accounts or mandatory sign-in.
- [ ] Barcode scanning.
- [ ] Plated-food recognition or portion estimation from photographs.
- [ ] iOS and browser releases.
- [ ] Medical, pregnancy, breastfeeding, or under-18 calculation modes.
- [ ] Wearable and health-platform integrations.

## Decisions still needed

- Final product name and visual identity (working name: Fitness Companion).
- Metric-only entry or simultaneous metric/imperial support.
- Whether later OCR releases need labels beyond English/Latin script.
- Whether flex days receive a fixed percentage uplift or a user-entered target.
- Which exercise catalogue and workout styles ship in the first template library.
- Whether private-alpha AI uses prompt sharing, a small shared API budget, or per-user API keys.

## Discovered gaps and safeguards

- Existing native and web builds use different persistence paths and duplicate business logic. Native/offline behavior is authoritative for this Android fork.
- Logged meal nutrients must be immutable snapshots; editing a food reference must not rewrite history.
- Nutrition recalibration needs enough weight and adherence data. When evidence is insufficient, the report must state that only the baseline formula was rerun.
- Trend recalibration requires at least four weigh-ins spanning ten days, seven logged food days, and 70% logging coverage. Each calorie change is capped at 150 kcal per recalibration.
- Workout completion may affect workout progression and daily macro distribution, but must not independently claim a change in maintenance calories.
- Workout progression requires two qualifying logs for the same exercise. Missing effort data prevents progression, and any recent pain report holds progression for review.
- Local-only data needs an explicit backup path because uninstalling the app can remove its database.
- Consumer ChatGPT and Claude subscriptions do not provide third-party API usage. Provider integration remains separately gated.
- The web production build, unit tests, Capacitor sync, and native Gradle debug build pass.
- Capacitor 8 native plugins require a Java 21 toolchain. A checksum-verified Temurin JDK is kept in the ignored local `.tools` directory for builds.
- The universal debug APK is roughly 73 MB because it includes offline OCR and SQLite native libraries for ARM and x86. An ARM-only/release split can reduce distribution size after device compatibility is confirmed.
- The dependency tree currently reports npm audit findings; review them without applying an unbounded automatic upgrade before the private APK handoff.
