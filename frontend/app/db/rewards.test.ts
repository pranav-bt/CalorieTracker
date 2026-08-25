import { Capacitor } from "@capacitor/core";
import { getDb, inTransaction } from "./client";
import {
  awardConfiguredPoints, configuredPointValue, loadRewardRuntime,
  replaceRewardCatalogue, replaceRewardMessages, saveRewardPreferences,
} from "./rewards";

jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: jest.fn() } }));
jest.mock("./client", () => ({ getDb: jest.fn(), inTransaction: jest.fn() }));

const preference = { enabled: 1, motivations_enabled: 1, love_notes_enabled: 1, weekly_challenges_enabled: 1, points_enabled: 1, system_name: "Stars", point_name_singular: "star", point_name_plural: "stars", weekly_points_goal: 20 };

describe("configurable rewards persistence", () => {
  beforeEach(() => {
    jest.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    jest.mocked(inTransaction).mockImplementation(async (_db, operation) => operation());
  });

  it("loads runtime switches, point rules, and message pools", async () => {
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ values: [preference] })
      .mockResolvedValueOnce({ values: [{ action_key: "log_meal", label: "Meal", points: 4, enabled: 1 }] })
      .mockResolvedValueOnce({ values: [{ id: 1, category: "affirmation", context_key: "", text: "Keep going", order_index: 0 }] }) };
    const runtime = await loadRewardRuntime(db as never);
    expect(runtime.preferences).toMatchObject({ enabled: true, system_name: "Stars", weekly_points_goal: 20 });
    expect(configuredPointValue(runtime, "log_meal")).toBe(4);
    expect(runtime.messages[0].text).toBe("Keep going");
  });

  it("awards the configured value and respects the master switch", async () => {
    const enabledDb = { query: jest.fn()
      .mockResolvedValueOnce({ values: [preference] })
      .mockResolvedValueOnce({ values: [{ action_key: "goal_hit", label: "Goal", points: 8, enabled: 1 }] })
      .mockResolvedValueOnce({ values: [] }), run: jest.fn().mockResolvedValue({ changes: { changes: 1 } }) };
    await expect(awardConfiguredPoints(enabledDb as never, "goal_hit", false)).resolves.toBe(8);
    expect(enabledDb.run).toHaveBeenCalledWith(expect.stringContaining("heart_points_log"), ["goal_hit", 8], false);

    const disabledDb = { query: jest.fn()
      .mockResolvedValueOnce({ values: [{ ...preference, enabled: 0 }] })
      .mockResolvedValueOnce({ values: [{ action_key: "goal_hit", label: "Goal", points: 8, enabled: 1 }] })
      .mockResolvedValueOnce({ values: [] }), run: jest.fn() };
    await expect(awardConfiguredPoints(disabledDb as never, "goal_hit")).resolves.toBe(0);
    expect(disabledDb.run).not.toHaveBeenCalled();
  });

  it("replaces reward and message lists transactionally", async () => {
    const db = { run: jest.fn().mockResolvedValue({ changes: { changes: 1 } }) };
    jest.mocked(getDb).mockResolvedValue(db as never);
    await replaceRewardCatalogue([{ name: "Movie", cost: 12 }]);
    expect(db.run).toHaveBeenCalledWith("DELETE FROM rewards_catalogue", [], false);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO rewards_catalogue"), [1, "Movie", 12], false);
    db.run.mockClear();
    await replaceRewardMessages("affirmation", "", [" First ", "", "Second"]);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM reward_messages"), ["affirmation", ""], false);
    expect(db.run).toHaveBeenCalledTimes(3);
  });

  it("validates names, costs, and weekly goals before writing", async () => {
    await expect(replaceRewardCatalogue([{ name: "", cost: 0 }])).rejects.toThrow("Every reward");
    await expect(saveRewardPreferences({ enabled: true, motivations_enabled: true, love_notes_enabled: true, weekly_challenges_enabled: true, points_enabled: true, system_name: "", point_name_singular: "point", point_name_plural: "points", weekly_points_goal: 10 })).rejects.toThrow("cannot be empty");
  });
});
