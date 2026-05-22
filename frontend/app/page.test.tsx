import { render, screen } from "@testing-library/react";
import Home from "./page";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

const dailySummary = {
  date: "2026-05-21",
  goal: 2000,
  goal_mode: "daily",
  daily_goal: 2000,
  weekly_goal: 14000,
  adjusted_goal: 2000,
  consumed: 500,
  remaining: 1500,
  week_consumed: 2500,
  week_remaining: 11500,
  week_start: "2026-05-18",
  week_end: "2026-05-24",
};

const history = [
  { date: "2026-05-21", total_calories: 500 },
  { date: "2026-05-20", total_calories: 2000 },
];

function mockJsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response);
}

describe("Home", () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/daily-summary")) {
        return mockJsonResponse(dailySummary);
      }

      if (url.endsWith("/history")) {
        return mockJsonResponse(history);
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });
  });

  it("shows dashboard summary and weekly metrics", async () => {
    render(<Home />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(await screen.findByText("500")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("11500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log meal/i })).toHaveAttribute(
      "href",
      "/log-meal",
    );
  });
});
