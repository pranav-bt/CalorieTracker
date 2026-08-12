import type { CapacitorConfig } from "@capacitor/cli";

const isDevelopment = process.env.FITNESS_COMPANION_CHANNEL === "development";

const config: CapacitorConfig = {
  appId: isDevelopment ? "dev.pranav.fitnesscompanion.dev" : "dev.pranav.fitnesscompanion",
  appName: isDevelopment ? "Fitness Companion Dev" : "Fitness Companion",
  webDir: "out",
  server: { androidScheme: "https" },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
