import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeartPointsPage from "./page";
import { getHeartPoints, redeemReward } from "../db";

jest.mock("next/link", () => function Link({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href}>{children}</a>; });
jest.mock("../db", () => ({ getHeartPoints: jest.fn(), redeemReward: jest.fn(), claimRedemption: jest.fn() }));

const balance = {
  enabled: true, system_name: "Gold Stars", point_name_plural: "stars", balance: 20,
  weekly_earned: 6, weekly_goal: 10, redemption_pending_message: "Unlocked {reward}!",
  redemption_claimed_message: "Finished {reward}!", log: [], redemptions: [],
  rewards: [{ id: 1, name: "Movie", cost: 10 }],
};

describe("Rewards page", () => {
  it("explains when points are disabled while preserving the displayed balance", async () => {
    jest.mocked(getHeartPoints).mockResolvedValue({ ...balance, enabled: false });
    render(<HeartPointsPage />);
    expect(await screen.findByText("Points and rewards are disabled")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem" })).not.toBeInTheDocument();
  });

  it("redeems a configured reward and uses its configured message", async () => {
    const user = userEvent.setup();
    jest.mocked(getHeartPoints).mockResolvedValue(balance);
    jest.mocked(redeemReward).mockResolvedValue({ redeemed: "Movie", new_balance: 10 });
    render(<HeartPointsPage />);
    await user.click(await screen.findByRole("button", { name: "Redeem" }));
    await waitFor(() => expect(redeemReward).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Unlocked Movie!")).toBeInTheDocument();
    expect(screen.getByText("6 / 10 stars")).toBeInTheDocument();
  });
});
