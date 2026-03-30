import { useContext } from "react";
import { LoggingContext } from "../contexts/LoggingContext";

export const useLogging = () => {
  const ctx = useContext(LoggingContext);
  if (!ctx) throw new Error("useLogging must be used within a LoggingProvider");
  return ctx;
};
