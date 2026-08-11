import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { inTransaction } from "./client";

function fakeDb(active = true) {
  return {
    beginTransaction: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
    commitTransaction: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
    rollbackTransaction: jest.fn().mockResolvedValue({ changes: { changes: 0 } }),
    isTransactionActive: jest.fn().mockResolvedValue({ result: active }),
  } as unknown as SQLiteDBConnection;
}

describe("inTransaction", () => {
  it("commits a successful operation", async () => {
    const db = fakeDb();
    await expect(inTransaction(db, async () => 42)).resolves.toBe(42);
    expect(db.beginTransaction).toHaveBeenCalledTimes(1);
    expect(db.commitTransaction).toHaveBeenCalledTimes(1);
    expect(db.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("rolls back an active transaction and preserves the original error", async () => {
    const db = fakeDb();
    const failure = new Error("write failed");
    await expect(inTransaction(db, async () => { throw failure; })).rejects.toBe(failure);
    expect(db.commitTransaction).not.toHaveBeenCalled();
    expect(db.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
});
