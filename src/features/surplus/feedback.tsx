import type { ReactNode } from "react";
import styles from "./surplus.module.css";

export type Feedback = { tone: "progress" | "success" | "error"; content: ReactNode };

export function SurplusFeedback({ feedback }: { feedback: Feedback | null }) {
  return <p role="status" aria-atomic="true" className={`${styles.status} ${feedback ? styles[feedback.tone] : ""}`}>
    {feedback?.content}
  </p>;
}
