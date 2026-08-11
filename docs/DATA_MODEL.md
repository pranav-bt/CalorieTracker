# Offline data model

The SQLite database is the source of truth for the Android app. Values copied into logs are snapshots so future edits do not alter history.

## Nutrition

- `foods`: reusable nutrition reference for a quantity and unit.
- `meals`: dated meal header and calorie total.
- `meal_items`: immutable calorie and macro snapshot for each logged food.
- `nutrition_plans`: immutable calculated plan versions and explanation.
- `nutrition_plan_days`: targets for each weekday in a plan.

## Profile and recalibration

- `user_profile`: current non-historical preferences and constraints.
- `body_measurements`: time series of weight and optional body measurements.
- `recalibration_reports`: immutable evidence and change records that link old and new plans.

The UI exposes the latest three plans for quick restoration, while the database retains all versions for auditability.

## Workouts

- `workout_plans`: versioned weekly workout plans.
- `workout_plan_days`: scheduled sessions.
- `workout_plan_exercises`: prescribed exercise targets.
- `workout_sessions`: actual completed or skipped sessions.
- `workout_exercise_logs`: exercise-level result and feedback.
- `workout_sets`: individual set data such as repetitions, load, RIR, RPE, duration, and distance.

## Pantry

- `inventory_items`: locally stocked ingredients with quantity, unit, location, expiry, and low-stock threshold.

## Settings

The existing `settings` singleton remains for compatibility. `calorie_distribution_mode` distinguishes fixed daily targets from flexible weekly redistribution.

