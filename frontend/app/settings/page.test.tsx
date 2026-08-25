import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./page";
import { getRewardConfiguration, replaceRewardCatalogue, replaceRewardMessages, savePointRules, saveRewardPreferences } from "../db/rewards";

jest.mock("next/link", () => function Link({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href}>{children}</a>; });
jest.mock("../db/rewards", () => ({
  getRewardConfiguration: jest.fn(), replaceRewardCatalogue: jest.fn(), replaceRewardMessages: jest.fn(),
  savePointRules: jest.fn(), saveRewardPreferences: jest.fn(),
}));

const config = {
  preferences: { enabled: true, motivations_enabled: true, love_notes_enabled: true, weekly_challenges_enabled: true, points_enabled: true, system_name: "Heart Points", point_name_singular: "point", point_name_plural: "points", weekly_points_goal: 15 },
  point_rules: [{ action_key: "log_meal", label: "Log a meal", points: 1, enabled: true }],
  rewards: [{ id: 1, name: "Movie", cost: 10 }],
  messages: [{ id: 1, category: "day_greeting", context_key: "0", text: "Monday energy", order_index: 0 }],
};

describe("reward settings page", () => {
  beforeEach(() => {
    jest.mocked(getRewardConfiguration).mockResolvedValue(config);
    jest.mocked(saveRewardPreferences).mockResolvedValue(); jest.mocked(savePointRules).mockResolvedValue();
    jest.mocked(replaceRewardCatalogue).mockResolvedValue(); jest.mocked(replaceRewardMessages).mockResolvedValue();
  });

  it("can completely disable the system without deleting configuration", async () => {
    const user = userEvent.setup(); render(<SettingsPage />);
    const master = await screen.findByLabelText("Enable rewards and motivation");
    await user.click(master);
    await user.click(screen.getByRole("button", { name: /save feature settings/i }));
    await waitFor(() => expect(saveRewardPreferences).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, system_name: "Heart Points" })));
  });

  it("edits point values, catalogue items, and text pools", async () => {
    const user = userEvent.setup(); render(<SettingsPage />);
    const points = await screen.findByLabelText("log_meal points");
    await user.clear(points); await user.type(points, "6");
    await user.click(screen.getByRole("button", { name: /save point actions/i }));
    expect(savePointRules).toHaveBeenCalledWith([expect.objectContaining({ action_key: "log_meal", points: 6 })]);

    const rewardName = screen.getByLabelText("Reward 1 name");
    await user.clear(rewardName); await user.type(rewardName, "Dinner out");
    await user.click(screen.getByRole("button", { name: /save catalogue/i }));
    expect(replaceRewardCatalogue).toHaveBeenCalledWith([expect.objectContaining({ name: "Dinner out", cost: 10 })]);

    const messages = screen.getByLabelText("Messages, one per line");
    await user.clear(messages); await user.type(messages, "Fresh Monday\nKeep moving");
    await user.click(screen.getByRole("button", { name: /save this text group/i }));
    expect(replaceRewardMessages).toHaveBeenCalledWith("day_greeting", "0", ["Fresh Monday", "Keep moving"]);
  });
});
