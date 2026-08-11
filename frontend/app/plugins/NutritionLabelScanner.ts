import { registerPlugin } from "@capacitor/core";

export interface NutritionLabelScannerPlugin {
  recognize(options: { path: string }): Promise<{ text: string }>;
}

export const NutritionLabelScanner = registerPlugin<NutritionLabelScannerPlugin>(
  "NutritionLabelScanner"
);
