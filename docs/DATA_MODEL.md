# Offline data model

The SQLite database is the source of truth for the Android app. Values copied into logs are snapshots so future edits do not alter history.

## Nutrition

- `foods`: reusable nutrition reference for a quantity and unit.
- `meals`: dated meal header and calorie total.
- `meal_items`: immutable calorie and macro snapshot for each logged food.
- `nutrition_plans`: immutable calculated plan versions and explanation.
- `nutrition_plan_days`: targets for each weekday in a plan.

## Profile and recalibration

- `user_profile`: current non-historical preferences and constraints, including an optional exact flex-day calorie target and selected workout style.
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

Exercise-progress charts are derived from completed `workout_sets`; no duplicate chart data is stored.

## Pantry

- `inventory_items`: locally stocked ingredients with quantity, unit, location, expiry, and low-stock threshold.

## Settings

The existing `settings` singleton remains for compatibility. `calorie_distribution_mode` distinguishes fixed daily targets from flexible weekly redistribution.

## Configurable rewards

Schema version 8 keeps reward behavior local and editable:

- `reward_preferences` stores the master switch, per-feature switches, point terminology, section name, and weekly point goal.
- `point_rules` stores the enabled state, display label, and award for each action the app can detect.
- `reward_messages` stores weekday greetings, motivations, love notes, reports, challenges, milestone text, and redemption messages by category/context.
- `rewards_catalogue` stores editable reward names and costs. `redemptions` remain immutable snapshots, so later catalogue edits do not rewrite history.

Disabling rewards does not delete earned points, catalogue configuration, or redemption history. It hides incentive surfaces and prevents new automatic awards until re-enabled.
