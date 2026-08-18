# Stable and development builds

## Source control

- `stable` points to the current tested release. Do not develop directly on it.
- `development` is the integration branch for the next roadmap phase.
- `v0.1.1-alpha` permanently identifies the first stable checkpoint at commit `7124b6d`.
- `v0.2.0-alpha` identifies the first development Recipes checkpoint and its versioned APK.
- The `development` branch now targets `0.2.1-alpha` (Android version code 4) for the next APK checkpoint.
- `fitness-companion` is retained as the original feature branch and historical remote branch.

Promote a tested development checkpoint by merging it into `stable`, bumping Android's `versionCode` and `versionName`, building the stable channel, and creating a new annotated version tag.

## Android isolation

| Channel | App name | Application ID | Local data |
| --- | --- | --- | --- |
| Stable | Fitness Companion | `dev.pranav.fitnesscompanion` | Stable sandbox |
| Development | Fitness Companion Dev | `dev.pranav.fitnesscompanion.dev` | Development sandbox |

Both apps can be installed on one Android device. Each Android application sandbox has its own SQLite database, files, preferences, camera permissions, and backup recovery file. The development UI also shows a `DEV` badge.

## Build commands

From the repository root:

```powershell
.\scripts\build-android.ps1 development
```

After a tested development checkpoint has been promoted into `stable`, build it with:

```powershell
.\scripts\build-android.ps1 stable
```

The script refuses to build a channel from the wrong branch. Generated APKs are copied into `releases/` and ignored by Git.

The current `stable` branch is intentionally pinned to the already-built `v0.1.1-alpha` checkpoint, before this build script was introduced. Its preserved APK is `releases/FitnessCompanion-0.1.1-alpha-stable.apk`; do not rebuild that historical tag.

Development APKs use an increasing Android `versionCode` and a distinct `versionName`. Each tagged checkpoint remains in `releases/` under its versioned filename so later builds do not replace it.
