export type Unit = "g" | "ml" | "piece" | "slice";
export type GoalMode = "daily" | "weekly";
export type CalorieDistributionMode = "fixed" | "flexible_weekly";
export type MetabolicSex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type GoalKind = "maintain" | "fat_loss" | "muscle_gain" | "recomposition" | "performance";
export type PlanSource = "initial" | "manual" | "recalibration" | "restored";
export type RecalibrationConfidence = "low" | "medium" | "high";

export type Macros = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type MealItem = {
  name: string;
  quantity: number;
  unit: Unit;
  calories: number;
} & Macros;

export type MealRow = {
  name: string;
  quantity: string;
  unit: Unit;
};

export type MealSummary = {
  id: number;
  date: string;
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  daily_total: number;
  remaining: number;
  milestone?: string | null;
  heart_points_earned: number;
};

export type MealRecord = {
  id: number;
  date: string;
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
};

export type DailySummary = {
  date: string;
  goal: number;
  goal_mode: GoalMode;
  calorie_distribution_mode: CalorieDistributionMode;
  daily_goal: number;
  weekly_goal: number;
  adjusted_goal: number;
  consumed: number;
  remaining: number;
  week_consumed: number;
  week_remaining: number;
  week_start: string;
  week_end: string;
  week_start_day: number;
  greeting: string;
  affirmation: string;
  streak: number;
  partner_name: string;
  end_of_day_note: string | null;
  days_logged_this_week: number;
  weekly_report_message: string | null;
  current_challenge: string;
  challenge_completed: boolean;
  heart_points: number;
};

export type HeartPointEntry = {
  id: number;
  source: string;
  points: number;
  created_at: string;
};

export type RewardItem = {
  id: number;
  name: string;
  cost: number;
};

export type Redemption = {
  id: number;
  reward: string;
  points_spent: number;
  created_at: string;
  claimed: boolean;
  claimed_at: string | null;
};

export type HeartPointsBalance = {
  balance: number;
  log: HeartPointEntry[];
  rewards: RewardItem[];
  redemptions: Redemption[];
};

export type HistoryDay = {
  date: string;
  total_calories: number;
};

export type Food = {
  id: number;
  name: string;
  unit: Unit;
  reference_quantity: number;
  reference_calories: number;
  source: "manual" | "label_scan";
} & Macros;

export type Settings = {
  goal_mode: GoalMode;
  daily_calorie_goal: number;
  weekly_calorie_goal: number;
  history_retention_days: number;
  week_start_day: number;
  partner_name: string;
  calorie_distribution_mode: CalorieDistributionMode;
};

export type UserProfile = {
  birth_date: string;
  metabolic_sex: MetabolicSex;
  height_cm: number;
  activity_level: ActivityLevel;
  primary_goal: GoalKind;
  target_weight_kg: number | null;
  target_date: string | null;
  event_name: string;
  event_date: string | null;
  workout_days_per_week: number;
  preferred_workout_days: number[];
  workout_session_minutes: number;
  flex_days_per_week: number;
  flex_day_weekday: number | null;
  dietary_preferences: string[];
  available_equipment: string[];
  injuries_or_limitations: string[];
};

export type BodyMeasurement = {
  id: number;
  recorded_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string;
};

export type NutritionTarget = Macros & {
  calories: number;
};

export type DailyMacroSummary = {
  consumed: Macros;
  target: Macros;
  plan_id: number | null;
};

export type NutritionPlan = NutritionTarget & {
  id: number;
  created_at: string;
  activated_at: string | null;
  is_active: boolean;
  source: PlanSource;
  calculation_method: string;
  weekly_calories: number;
  explanation: string;
};

export type NutritionPlanDay = NutritionTarget & {
  weekday: number;
  day_kind: "standard" | "workout" | "flex" | "workout_flex";
};

export type MacroCalculationInput = {
  as_of_date: string;
  birth_date: string;
  metabolic_sex: MetabolicSex;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  primary_goal: GoalKind;
  target_weight_kg: number | null;
  target_date: string | null;
  workout_days_per_week: number;
  preferred_workout_days: number[];
  flex_days_per_week: number;
  flex_day_weekday: number | null;
};

export type MacroCalculationResult = NutritionTarget & {
  bmr: number;
  estimated_maintenance_calories: number;
  weekly_calories: number;
  calculation_method: "mifflin_st_jeor";
  days: NutritionPlanDay[];
  explanation: string;
  assumptions: string[];
};

export type RecalibrationChange = {
  area: "nutrition" | "workout" | "schedule";
  field: string;
  previous_value: string | number | null;
  new_value: string | number | null;
  reason: string;
};

export type RecalibrationReport = {
  id: number;
  created_at: string;
  confidence: RecalibrationConfidence;
  summary: string;
  evidence: string[];
  changes: RecalibrationChange[];
};

export type InventoryItem = {
  id: number;
  food_id: number | null;
  name: string;
  quantity: number;
  unit: Unit;
  location: "pantry" | "fridge" | "freezer" | "other";
  expires_on: string | null;
  low_stock_quantity: number | null;
  updated_at: string;
};

export type WorkoutSet = {
  id: number;
  set_number: number;
  reps: number | null;
  load_kg: number | null;
  rir: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  completed: boolean;
};
