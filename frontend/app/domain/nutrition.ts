import type {
  ActivityLevel,
  MacroCalculationInput,
  MacroCalculationResult,
  NutritionPlanDay,
  NutritionTarget,
} from "../types";

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

const DEFAULT_WORKOUT_DAYS: Record<number, number[]> = {
  0: [],
  1: [2],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function calculateNutritionPlan(input: MacroCalculationInput): MacroCalculationResult {
  validateInput(input);

  const age = ageOnDate(input.birth_date, input.as_of_date);
  const sexConstant = input.metabolic_sex === "male" ? 5 : -161;
  const bmr = Math.round(10 * input.weight_kg + 6.25 * input.height_cm - 5 * age + sexConstant);
  const maintenance = Math.round(bmr * ACTIVITY_MULTIPLIER[input.activity_level]);
  const requestedAdjustment = goalAdjustment(input, maintenance);
  const calorieFloor = Math.max(1200, bmr);
  const calories = roundTo(Math.max(calorieFloor, maintenance + requestedAdjustment), 25);
  const daily = macrosForCalories(calories, input.weight_kg, input.primary_goal);
  const days = distributeWeek(input, daily);
  const weeklyCalories = days.reduce((sum, day) => sum + day.calories, 0);

  const direction = calories < maintenance ? "below" : calories > maintenance ? "above" : "at";
  const assumptions = [
    "Energy needs are an estimate and become more useful after weight and intake trends are available.",
    "Activity level includes normal daily movement as well as the selected training frequency.",
    "Workout and flex-day targets are redistributed without changing the weekly calorie budget.",
  ];

  return {
    ...daily,
    bmr,
    estimated_maintenance_calories: maintenance,
    weekly_calories: weeklyCalories,
    calculation_method: "mifflin_st_jeor",
    days,
    explanation:
      `Estimated resting expenditure is ${bmr} kcal and maintenance is approximately ${maintenance} kcal. ` +
      `The initial target is ${calories} kcal, ${direction} estimated maintenance for the selected goal.`,
    assumptions,
  };
}

export function retargetNutritionPlan(
  input: MacroCalculationInput,
  base: MacroCalculationResult,
  calories: number,
  reason: string
): MacroCalculationResult {
  const daily = macrosForCalories(calories, input.weight_kg, input.primary_goal);
  const days = distributeWeek(input, daily);
  return {
    ...base,
    ...daily,
    weekly_calories: days.reduce((sum, day) => sum + day.calories, 0),
    days,
    explanation: `${base.explanation} ${reason}`,
  };
}

function validateInput(input: MacroCalculationInput): void {
  const age = ageOnDate(input.birth_date, input.as_of_date);
  if (age < 18 || age > 100) throw new Error("This calculator currently supports adults aged 18 to 100.");
  if (input.height_cm < 100 || input.height_cm > 250) throw new Error("Height must be between 100 and 250 cm.");
  if (input.weight_kg < 35 || input.weight_kg > 350) throw new Error("Weight must be between 35 and 350 kg.");
  if (input.workout_days_per_week < 0 || input.workout_days_per_week > 7) {
    throw new Error("Workout days must be between 0 and 7.");
  }
  if (input.flex_days_per_week < 0 || input.flex_days_per_week > 1) {
    throw new Error("The private alpha supports up to one flex day each week.");
  }
  if (input.target_date && daysBetween(input.as_of_date, input.target_date) <= 0) {
    throw new Error("Target date must be in the future.");
  }
}

function goalAdjustment(input: MacroCalculationInput, maintenance: number): number {
  if (input.primary_goal === "recomposition") return -maintenance * 0.05;
  if (input.primary_goal === "maintain" || input.primary_goal === "performance") return 0;

  const days = input.target_date ? daysBetween(input.as_of_date, input.target_date) : null;
  const hasUsableTarget = input.target_weight_kg !== null && days !== null && days > 0;
  const targetAdjustment = hasUsableTarget
    ? ((input.target_weight_kg! - input.weight_kg) * 7700) / days!
    : null;

  if (input.primary_goal === "fat_loss") {
    const fallback = -maintenance * 0.15;
    const requested = targetAdjustment !== null && targetAdjustment < 0 ? targetAdjustment : fallback;
    return clamp(requested, -Math.min(500, maintenance * 0.2), 0);
  }

  const fallback = 200;
  const requested = targetAdjustment !== null && targetAdjustment > 0 ? targetAdjustment : fallback;
  return clamp(requested, 0, 300);
}

function macrosForCalories(
  calories: number,
  weightKg: number,
  goal: MacroCalculationInput["primary_goal"]
): NutritionTarget {
  const proteinMultiplier =
    goal === "fat_loss" || goal === "muscle_gain" || goal === "recomposition"
      ? 1.8
      : goal === "performance"
        ? 1.6
        : 1.4;
  const protein = roundMacro(weightKg * proteinMultiplier);
  const fat = roundMacro(Math.max(weightKg * 0.7, (calories * 0.25) / 9));
  const carbs = roundMacro(Math.max(0, (calories - protein * 4 - fat * 9) / 4));
  const fiber = roundMacro((calories / 1000) * 14);
  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat, fiber_g: fiber };
}

function distributeWeek(input: MacroCalculationInput, daily: NutritionTarget): NutritionPlanDay[] {
  const selectedDays = uniqueValidWeekdays(input.preferred_workout_days);
  const workoutDays = new Set(
    selectedDays.length === input.workout_days_per_week
      ? selectedDays
      : DEFAULT_WORKOUT_DAYS[input.workout_days_per_week]
  );
  const flexDay = input.flex_days_per_week === 1 ? (input.flex_day_weekday ?? 5) : null;
  const weights = Array.from({ length: 7 }, (_, weekday) => {
    let weight = workoutDays.has(weekday) ? 1.04 : 1;
    if (weekday === flexDay) weight += 0.1;
    return weight;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const weeklyBudget = daily.calories * 7;
  const caloriesByDay = weights.map((weight) => roundTo((weeklyBudget * weight) / weightTotal, 5));
  const roundingDifference = weeklyBudget - caloriesByDay.reduce((sum, calories) => sum + calories, 0);
  caloriesByDay[flexDay ?? 6] += roundingDifference;

  return caloriesByDay.map((calories, weekday) => {
    const targets = macrosForCalories(calories, input.weight_kg, input.primary_goal);
    const workout = workoutDays.has(weekday);
    const flex = weekday === flexDay;
    return {
      weekday,
      day_kind: workout && flex ? "workout_flex" : workout ? "workout" : flex ? "flex" : "standard",
      ...targets,
    };
  });
}

function uniqueValidWeekdays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
}

function ageOnDate(birthDate: string, asOfDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  const asOf = new Date(`${asOfDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) throw new Error("Enter valid dates.");
  let age = asOf.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
