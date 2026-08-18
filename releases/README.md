# Local Android builds

Generated APKs and checksum files are kept in this directory locally and are ignored by Git.

- `FitnessCompanion-<version>-stable.apk` uses `dev.pranav.fitnesscompanion` and the stable on-device data sandbox.
- `FitnessCompanion-<version>-dev.apk` uses `dev.pranav.fitnesscompanion.dev` and a separate on-device data sandbox.

The development app can be installed beside the stable app. Data does not cross between them unless a JSON backup is explicitly exported from one and imported into the other.

## Preserved checkpoints

| Tag | APK | Android version | SHA-256 |
| --- | --- | --- | --- |
| `v0.1.1-alpha` | `FitnessCompanion-0.1.1-alpha-stable.apk` | code 2, `0.1.1-alpha` | `339024A147AC885360850E3AA2AC81293010B9E0D34773C56CD8E1B115136A09` |
| `v0.2.0-alpha` | `FitnessCompanion-0.2.0-alpha-dev.apk` | code 3, `0.2.0-alpha-dev` | `FB5353F0CAC7EA21DE2BCF3873E38A1B42E540ADD486F8FB6C441A2F3EB3EA55` |
| `v0.2.1-alpha` | `FitnessCompanion-0.2.1-alpha-dev.apk` | code 4, `0.2.1-alpha-dev` | `F35EC3C2CBAA72999A02AB29BD1CBF92041104B2C4B41EE4BFC14553CB7C313F` |
