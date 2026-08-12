# Local Android builds

Generated APKs and checksum files are kept in this directory locally and are ignored by Git.

- `FitnessCompanion-<version>-stable.apk` uses `dev.pranav.fitnesscompanion` and the stable on-device data sandbox.
- `FitnessCompanion-<version>-dev.apk` uses `dev.pranav.fitnesscompanion.dev` and a separate on-device data sandbox.

The development app can be installed beside the stable app. Data does not cross between them unless a JSON backup is explicitly exported from one and imported into the other.
