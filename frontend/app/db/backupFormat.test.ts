import { parseFitnessBackup } from "./backupFormat";

const validBackup = {
  database: "fitness_companion",
  version: 3,
  encrypted: false,
  mode: "full",
  tables: [{ name: "db_meta", schema: [], values: [] }],
};

describe("parseFitnessBackup", () => {
  it("accepts an app backup and enables replacement", () => {
    expect(parseFitnessBackup(JSON.stringify(validBackup))).toMatchObject({
      database: "fitness_companion",
      overwrite: true,
    });
  });

  it("rejects another database", () => {
    expect(() => parseFitnessBackup(JSON.stringify({ ...validBackup, database: "other" })))
      .toThrow("not a Fitness Companion full backup");
  });

  it("rejects a future schema", () => {
    expect(() => parseFitnessBackup(JSON.stringify({ ...validBackup, version: 99 })))
      .toThrow("newer app version");
  });
});
