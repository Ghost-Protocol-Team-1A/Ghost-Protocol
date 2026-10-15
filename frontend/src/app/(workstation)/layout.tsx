import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { Sidebar } from "@/features/shell/Sidebar";
import { TourCard } from "@/features/tour/TourCard";
import shell from "@/features/shell/shell.module.css";
import { initials, ROLE_LABELS } from "@/lib/identity";
import { currentIdentity } from "@/lib/session";
import styles from "./workstation.module.css";

export default async function WorkstationLayout({ children }: { children: React.ReactNode }) {
  const identity = await currentIdentity();
  return (
    <div className={styles.shell}>
      <Sidebar />
      <header className={shell.topbar}>
        <div className={shell.topLeft}>
          <CommandPalette />
          <span className={`gp-chip gp-chip-lime ${shell.hideSmall}`}>Synthetic demo data</span>
        </div>
        <div className={shell.topRight}>
          <span className={`gp-chip ${shell.hideSmall}`}>Investigative aid · not a verdict</span>
          {identity ? (
            <div className={shell.identity}>
              <span className={shell.avatar} aria-hidden="true">
                {initials(identity.name)}
              </span>
              <span className={shell.who}>
                <span>{identity.name}</span>
                <span className={shell.role}>{ROLE_LABELS[identity.role]}</span>
              </span>
              <form action={signOut}>
                <button type="submit" className="gp-btn gp-btn-quiet">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/signin" className="gp-btn gp-btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <Suspense fallback={null}>
        <TourCard />
      </Suspense>
    </div>
  );
}
