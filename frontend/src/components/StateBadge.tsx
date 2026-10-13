import type { ClaimState } from "@/lib/types";
import styles from "./StateBadge.module.css";

const LABELS: Record<ClaimState, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  inferred: "Inferred",
  unresolved: "Unresolved",
};

export function StateBadge({ state }: { state: ClaimState }) {
  return <span className={`${styles.badge} ${styles[state]}`}>{LABELS[state]}</span>;
}
