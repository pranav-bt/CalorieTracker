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

  it.each([
    ["Spanish", `Tamaño de la porción 30 g\nCalorías 120\nGrasa total 3,5 g\nCarbohidratos 20 g\nFibra alimentaria 4 g\nProteínas 5 g`, { reference_quantity: 30, calories: 120, fat_g: 3.5, carbs_g: 20, fiber_g: 4, protein_g: 5 }],
    ["French", `Taille de la portion 50 g\nÉnergie 840 kJ / 200 kcal\nMatières grasses 7,5 g\nGlucides 26 g\nFibres alimentaires 3 g\nProtéines 8 g`, { reference_quantity: 50, calories: 200, fat_g: 7.5, carbs_g: 26, fiber_g: 3, protein_g: 8 }],
    ["German", `Portionsgröße 25 g\nBrennwert 400 kJ / 95 kcal\nFett 2 g\nKohlenhydrate 14 g\nBallaststoffe 2,5 g\nEiweiß 4 g`, { reference_quantity: 25, calories: 95, fat_g: 2, carbs_g: 14, fiber_g: 2.5, protein_g: 4 }],
    ["Portuguese", `Porção 40 g\nValor energético 630 kJ / 150 kcal\nGordura total 5 g\nCarboidratos 21 g\nFibra alimentar 3 g\nProteínas 6 g`, { reference_quantity: 40, calories: 150, fat_g: 5, carbs_g: 21, fiber_g: 3, protein_g: 6 }],
    ["Italian", `Porzione 60 g\nEnergia 750 kJ / 180 kcal\nGrassi 6 g\nCarboidrati 24 g\nFibre alimentari 4 g\nProteine 7 g`, { reference_quantity: 60, calories: 180, fat_g: 6, carbs_g: 24, fiber_g: 4, protein_g: 7 }],
  ])("extracts a %s Latin-script label", (_language, label, expected) => {
    expect(parseNutritionLabel(label)).toMatchObject({ ...expected, confidence: "high", unit: "g" });
  });

  it("prefers kcal over the larger kJ energy value", () => {
    expect(parseNutritionLabel("Serving size 50 g\nEnergy 840 kJ / 200 kcal").calories).toBe(200);
  });
});
