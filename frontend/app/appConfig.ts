export const APP_CHANNEL = process.env.NEXT_PUBLIC_APP_CHANNEL === "development"
  ? "development"
  : "stable";

export const IS_DEVELOPMENT_BUILD = APP_CHANNEL === "development";
export const APP_DISPLAY_NAME = IS_DEVELOPMENT_BUILD
  ? "Fitness Companion Dev"
  : "Fitness Companion";
