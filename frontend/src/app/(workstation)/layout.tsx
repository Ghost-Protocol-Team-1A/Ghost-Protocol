import { Sidebar } from "@/features/shell/Sidebar";
import shell from "@/features/shell/shell.module.css";
import styles from "./workstation.module.css";

export default function WorkstationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <header className={shell.topbar}>
        <span className="gp-chip gp-chip-lime">Synthetic demo data</span>
        <div className={shell.topRight}>
          <span className="gp-chip">Investigative aid · not a verdict</span>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
