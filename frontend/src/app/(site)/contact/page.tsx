import type { Metadata } from "next";
import m from "@/features/site/marketing.module.css";
import { ContactForm } from "@/features/site/contact-form";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact — Ghost Protocol",
  description:
    "Get in touch with the Ghost Protocol team for partnerships, pilot evaluations, and investigation workflow demos.",
};

export default function ContactPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Contact · Partnerships · Demos</span>
        <h1 className={m.title}>Let’s make the evidence trail clear.</h1>
        <p className={m.lead}>
          Tell us about your workflow or integration needs. Do not send sensitive case evidence
          through this form.
        </p>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Get in touch">
        <div className={styles.grid}>
          <ContactForm />

          <aside className={`${m.card} ${styles.info}`} aria-label="Direct contact details">
            <span className={m.label}>Direct</span>
            <a href="mailto:info@rayvme.com" className={styles.big}>
              info@rayvme.com
            </a>
            <a href="tel:+2348154612625" className={styles.big}>
              +234 815 461 2625
            </a>
            <div className={styles.address}>
              <span className={m.label}>Rayvmedia Plus Ltd</span>
              <p>2–4 Oladimeji Street, Orisha, Magodo GRA Phase 1, Isheri, Lagos, Nigeria</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
