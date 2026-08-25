import { getDb } from "./client";
import { initDb } from "./init";

jest.mock("./client", () => ({ getDb: jest.fn() }));

const mockedGetDb = jest.mocked(getDb);

describe("initDb migrations", () => {
  it("upgrades schema 4 with flex-day targets and workout styles", async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      run: jest.fn().mockResolvedValue({ changes: { changes: 1 } }),
      query: jest.fn()
        .mockResolvedValueOnce({ values: [{ value: "4" }] })
        .mockResolvedValueOnce({ values: [{ name: "id" }, { name: "flex_day_weekday" }] })
        .mockResolvedValueOnce({ values: [{ name: "id" }, { name: "workout_session_minutes" }] }),
    };
    mockedGetDb.mockResolvedValue(db as never);

    await initDb();

    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE user_profile ADD COLUMN flex_day_calorie_target REAL"));
    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE user_profile ADD COLUMN workout_style TEXT NOT NULL DEFAULT 'balanced'"));
    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS planned_meals"));
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("schema_version"), ["7"]);
    expect(db.execute).toHaveBeenLastCalledWith("PRAGMA user_version = 7;", false);
  });

  it("leaves an up-to-date schema unchanged", async () => {
    const db = {
      execute: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      run: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
      query: jest.fn().mockResolvedValue({ values: [{ value: "7" }] }),
    };
    mockedGetDb.mockResolvedValue(db as never);
    await initDb();
    expect(db.execute).toHaveBeenCalledTimes(3);
    expect(db.run).not.toHaveBeenCalled();
  });
});
