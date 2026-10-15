import type { Metadata } from "next";
import { ContactForm } from "@/features/site/contact-form";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact — Ghost Protocol",
  description:
    "Get in touch with the Ghost Protocol team for partnerships, pilot evaluations, and investigation workflow demos.",
};

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Contact / Partnerships / Demos</p>
        <h1 className={styles.title}>Let’s make the evidence trail clear.</h1>
        <p className={styles.lead}>
          Tell us about your workflow or integration needs. Do not send sensitive
          case evidence through this form.
        </p>
      </header>

      <div className={styles.grid}>
        <ContactForm />

        <aside className={styles.infoCard} aria-label="Direct contact details">
          <ul className={styles.directList}>
            <li className={styles.directItem}>
              <span className={styles.emailLabel}>Email /</span>
              <a href="mailto:info@rayvme.com" className={styles.directLink}>
                info@rayvme.com
              </a>
            </li>
            <li className={styles.directItem}>
              <span className={styles.phoneLabel}>Phone /</span>
              <a href="tel:+2348154612625" className={styles.directLink}>
                +234 815 461 2625
              </a>
            </li>
          </ul>

          <div className={styles.addressBlock}>
            <span className={styles.companyName}>Rayvmedia Plus Ltd</span>
            <p className={styles.addressText}>
              2–4 Oladimeji Street, Orisha, Magodo GRA Phase 1, Isheri, Lagos,
              Nigeria
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
