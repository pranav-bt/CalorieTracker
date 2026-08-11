import { parseNutritionLabel } from "./nutritionLabel";

describe("parseNutritionLabel", () => {
  it("extracts a standard US label per serving", () => {
    const parsed = parseNutritionLabel(`
      Nutrition Facts
      8 servings per container
      Serving size 2/3 cup (55g)
      Calories 230
      Total Fat 8g
      Total Carbohydrate 37g
      Dietary Fiber 4g
      Protein 3g
    `);

    expect(parsed).toMatchObject({
      reference_quantity: 55,
      unit: "g",
      calories: 230,
      protein_g: 3,
      carbs_g: 37,
      fat_g: 8,
      fiber_g: 4,
      confidence: "high",
    });
  });

  it("handles values split onto the following OCR line", () => {
    const parsed = parseNutritionLabel(`Serving size\n250 ml\nCalories\n120\nTotal Fat\n4g\nCarbohydrate\n12g\nProtein\n8g`);
    expect(parsed.reference_quantity).toBe(250);
    expect(parsed.unit).toBe("ml");
    expect(parsed.calories).toBe(120);
    expect(parsed.protein_g).toBe(8);
  });

  it("requires calories instead of guessing", () => {
    expect(() => parseNutritionLabel("Protein 3g\nTotal Fat 2g")).toThrow("Calories could not be identified");
  });
});
