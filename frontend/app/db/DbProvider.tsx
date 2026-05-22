"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { initDb } from "./init";
import { purgeOldHistory } from "./index";

type DbStatus = "loading" | "ready" | "error";
const DbContext = createContext<DbStatus>("ready");

export function DbProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DbStatus>(
    typeof window !== "undefined" && Capacitor.isNativePlatform() ? "loading" : "ready"
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    initDb()
      .then(() => purgeOldHistory())
      .then(() => setStatus("ready"))
      .catch((e) => { console.error("DB init error:", e); setStatus("error"); });
  }, []);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f7f8f4" }}>
        <p style={{ color: "#66706b" }}>Starting up…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f7f8f4" }}>
        <p style={{ color: "#b64242" }}>Failed to open app storage. Please restart.</p>
      </div>
    );
  }

  return <DbContext.Provider value={status}>{children}</DbContext.Provider>;
}

export function useDbStatus() {
  return useContext(DbContext);
}
