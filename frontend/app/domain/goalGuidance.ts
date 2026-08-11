import type { CurrentState, GoalKind, PhysiqueGoal } from "../types";

export type PhaseRecommendation = {
  goal: GoalKind;
  title: string;
  explanation: string;
  next_step: string | null;
};

export function recommendPhase(
  physiqueGoal: PhysiqueGoal,
  currentState: CurrentState
): PhaseRecommendation {
  if (physiqueGoal === "performance") {
    return phase("performance", "Performance", "Fuel training quality and recovery around your event goal.", null);
  }
  if (physiqueGoal === "maintain") {
    return phase("maintain", "Maintain", "Keep calories near estimated maintenance while preserving your current routine.", null);
  }
  if (physiqueGoal === "leaner") {
    return phase("fat_loss", "Fat-loss phase", "Use a controlled calorie deficit while keeping protein and strength work in the plan.", "Reassess at your checkpoint before maintaining or building muscle.");
  }
  if (currentState === "reduce_fat") {
    return phase("fat_loss", "Fat-loss phase", "Start by reducing body fat while preserving muscle; this better supports the physique you selected before adding size.", "When you reach the first checkpoint, reassess for recomposition or a muscle-building phase.");
  }
  if (currentState === "fairly_lean_gain_muscle") {
    return phase("muscle_gain", "Lean muscle-building phase", "Use a small calorie surplus to support muscle and strength gains; scale weight may gradually rise.", "Reassess regularly so the surplus stays appropriate.");
  }
  return phase("recomposition", "Recomposition phase", "Use a conservative target while training consistently to work on body fat and muscle together.", "Progress is usually gradual; recalibration will use your logged trends.");
}

export function phaseLabel(goal: GoalKind): string {
  return {
    maintain: "Maintain",
    fat_loss: "Fat-loss phase",
    muscle_gain: "Lean muscle-building phase",
    recomposition: "Recomposition phase",
    performance: "Performance",
  }[goal];
}

export function phaseImpact(goal: GoalKind): string {
  return {
    maintain: "Calories stay near estimated maintenance while you preserve your current routine.",
    fat_loss: "Calories are set below estimated maintenance. This prioritizes fat reduction while protein and training support muscle retention.",
    muscle_gain: "Calories use a small surplus to support muscle and strength. Scale weight will likely rise and some fat gain is possible.",
    recomposition: "Calories stay conservative while consistent training works on fat and muscle together; visible change is usually gradual.",
    performance: "Calories prioritize training quality and recovery rather than deliberately changing body weight.",
  }[goal];
}

function phase(goal: GoalKind, title: string, explanation: string, next_step: string | null): PhaseRecommendation {
  return { goal, title, explanation, next_step };
}
