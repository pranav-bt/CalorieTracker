import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogMealPage from "./page";

const foods = [
  {
    id: 1,
    name: "egg",
    unit: "piece",
    reference_quantity: 1,
    reference_calories: 70,
  },
  {
    id: 2,
    name: "toast",
    unit: "slice",
    reference_quantity: 1,
    reference_calories: 80,
  },
];

const loggedMeal = {
  id: 1,
  date: "2026-05-21",
  items: [
    { name: "egg", quantity: 2, unit: "piece", calories: 140 },
    { name: "toast", quantity: 1, unit: "slice", calories: 80 },
  ],
  total_calories: 220,
  daily_total: 220,
  remaining: 1780,
};

function mockJsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response);
}

describe("LogMealPage", () => {
  beforeEach(() => {
    let meals: unknown[] = [];

    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/foods")) {
        return mockJsonResponse(foods);
      }

      if (url.endsWith("/meals")) {
        return mockJsonResponse(meals);
      }

      if (url.endsWith("/log-meal") && init?.method === "POST") {
        meals = [
          {
            id: loggedMeal.id,
            date: loggedMeal.date,
            items: loggedMeal.items,
            total_calories: loggedMeal.total_calories,
          },
        ];
        return mockJsonResponse(loggedMeal);
      }

      if (url.endsWith("/meal/1") && init?.method === "DELETE") {
        meals = [];
        return mockJsonResponse({ deleted: true });
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });
  });

  it("logs and deletes today's meals", async () => {
    const user = userEvent.setup();
    render(<LogMealPage />);

    await user.type(await screen.findByLabelText("Food 1"), "egg");
    await user.clear(screen.getByLabelText("Quantity 1"));
    await user.type(screen.getByLabelText("Quantity 1"), "1");
    await user.click(screen.getByRole("button", { name: /add row/i }));
    await user.type(screen.getByLabelText("Food 2"), "toast");
    await user.click(screen.getByRole("button", { name: /log meal/i }));

    expect(await screen.findByText("Last meal")).toBeInTheDocument();
    expect(screen.getAllByText("220").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/log-meal",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await user.click(screen.getAllByTitle("Delete meal")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/meal/1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("updates the unit when typing a known food", async () => {
    const user = userEvent.setup();
    render(<LogMealPage />);

    await user.type(await screen.findByLabelText("Food 1"), "toast");

    expect(screen.getByLabelText("Unit 1")).toHaveValue("slice");
  });
});

