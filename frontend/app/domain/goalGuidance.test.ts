import { recommendPhase } from "./goalGuidance";

describe("recommendPhase", () => {
  it("starts a fit and defined goal with fat loss when fat reduction is the current priority", () => {
    expect(recommendPhase("fit_defined", "reduce_fat").goal).toBe("fat_loss");
  });

  it("uses lean muscle gain only when the user says they are fairly lean", () => {
    expect(recommendPhase("muscular", "fairly_lean_gain_muscle").goal).toBe("muscle_gain");
  });

  it("uses recomposition when the user wants both or is unsure", () => {
    expect(recommendPhase("fit_defined", "both_unsure").goal).toBe("recomposition");
  });

  it("prioritizes event performance", () => {
    expect(recommendPhase("performance", "reduce_fat").goal).toBe("performance");
  });
});
