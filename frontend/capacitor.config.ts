import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.pranav.fitnesscompanion",
  appName: "Fitness Companion",
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
