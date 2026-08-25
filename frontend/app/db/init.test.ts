import { getDb } from "./client";
import { initDb } from "./init";

jest.mock("./client", () => ({ getDb: jest.fn() }));

const mockedGetDb = jest.mocked(getDb);

describe("initDb migrations", () => {
  it("upgrades schema 4 with the configurable flex-day target", async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      run: jest.fn().mockResolvedValue({ changes: { changes: 1 } }),
      query: jest.fn()
        .mockResolvedValueOnce({ values: [{ value: "4" }] })
        .mockResolvedValueOnce({ values: [{ name: "id" }, { name: "flex_day_weekday" }] }),
    };
    mockedGetDb.mockResolvedValue(db as never);

    await initDb();

    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE user_profile ADD COLUMN flex_day_calorie_target REAL"));
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("schema_version"), ["5"]);
    expect(db.execute).toHaveBeenLastCalledWith("PRAGMA user_version = 5;", false);
  });

  it("leaves an up-to-date schema unchanged", async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      run: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      query: jest.fn().mockResolvedValue({ values: [{ value: "5" }] }),
    };
    mockedGetDb.mockResolvedValue(db as never);
    await initDb();
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(db.run).not.toHaveBeenCalled();
  });
});
