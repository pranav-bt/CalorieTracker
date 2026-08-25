# Headless test suite

Run the release gate from `frontend`:

```powershell
npm.cmd run test:ci
npm.cmd run lint
npm.cmd run build
npm.cmd audit
```

The Jest suite is the headless acceptance layer. It covers:

- calorie and macro calculation, validation boundaries, weekly redistribution, and configurable flex-day targets;
- fixed versus flexible-weekly carryover behavior;
- physique-to-phase guidance and nutrition trend recalibration safeguards;
- multilingual Latin-script nutrition-label parsing, decimal commas, kJ/kcal disambiguation, and required manual-confirmation data;
- immutable recipe estimates, remaining-target calculations, and explicit commit/discard behavior;
- inventory expiry classification, shortages, and earliest-expiring deductions;
- transaction commit/rollback behavior, schema migrations, profile persistence, and backup validation;
- equipment-aware workout generation across all selectable styles, completed-set progress aggregation, and chart presentation;
- accessible body and exercise charts, including empty and missing-data states;
- key Home and meal-logging component workflows.

Headless tests deliberately do not claim to validate Android camera permissions, OCR camera quality, share sheets, SQLite plugin/device lifecycle, APK upgrades, touch ergonomics, or airplane-mode process restarts. Those remain in `docs/ALPHA_TESTING.md` for the physical-device pass.
