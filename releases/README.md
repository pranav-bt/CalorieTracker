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
| `v0.2.2-alpha` | `FitnessCompanion-0.2.2-alpha-dev.apk` | code 5, `0.2.2-alpha-dev` | `AC0935C1BD21300D28D213D2B100F98A290A36D12B131C66DC212B8E98174F22` |
| `v0.2.3-alpha` | `FitnessCompanion-0.2.3-alpha-dev.apk` | code 6, `0.2.3-alpha-dev` | `AF2E3D27EE446648044FC9781D0B6E7918E0DA367CD3109FE85388E2FFC6EBD3` |
| `v0.3.0-alpha` | `FitnessCompanion-0.3.0-alpha-dev.apk` | code 7, `0.3.0-alpha-dev` | `996485A3F77B3FA026F14F19C02B34EBFE24699F60B3F95821D3334432DF04BA` |
