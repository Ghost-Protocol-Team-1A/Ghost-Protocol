import type { Metadata } from "next";
import Link from "next/link";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing — Ghost Protocol",
  description:
    "Transparent, review-centric packaging for incident investigation teams. Built around evidence review, not automated verdicts.",
};

const TIERS = [
  {
    tag: "Case Pilot",
    tagClass: styles.tagCyan,
    heading: "Contact us",
    headingClass: styles.priceCyan,
    subtitle: "One controlled case.",
    features: [
      "Evidence intake and hashing",
      "Timeline normalization",
      "Conflict review",
      "Report preview",
    ],
    ctaText: "Talk to us",
    ctaHref: "/contact",
  },
  {
    tag: "Response Team",
    tagClass: styles.tagLime,
    heading: "Custom",
    headingClass: styles.priceLime,
    subtitle: "Repeatable investigations.",
    features: [
      "Multiple active cases",
      "Team roles and audit trail",
      "Hypothesis comparison",
      "Review assignments",
    ],
    ctaText: "Request team demo",
    ctaHref: "/contact",
  },
  {
    tag: "Enterprise",
    tagClass: styles.tagGold,
    heading: "Let's scope it",
    headingClass: styles.priceGold,
    subtitle: "Complex environments.",
    features: [
      "Identity integration",
      "Advanced access policies",
      "Deployment options",
      "Security review and support",
    ],
    ctaText: "Talk to us",
    ctaHref: "/contact",
  },
];

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          Plans built around review, not automated verdicts
        </p>
        <h1 className={styles.title}>Start with one case. Scale with confidence.</h1>
        <p className={styles.lead}>
          Proposed packaging for validation. Confirm rates, limits, and service terms
          before launch.
        </p>
        <div className={styles.hackathonNotice} role="note">
          Illustrative tiers for the hackathon. Not a commercial offer.
        </div>
      </header>

      <section className={styles.grid} aria-label="Investigation tiers">
        {TIERS.map((tier) => (
          <article key={tier.tag} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={tier.tagClass}>{tier.tag}</span>
              <h2 className={tier.headingClass}>{tier.heading}</h2>
              <p className={styles.subtitle}>{tier.subtitle}</p>
              <ul className={styles.featureList}>
                {tier.features.map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.cardAction}>
              <Link href={tier.ctaHref} className={styles.actionBtn}>
                {tier.ctaText}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <footer className={styles.footnote}>
        Pricing should never incentivize unnecessary evidence collection. Confirm
        data residency, retention, and contract terms.
      </footer>
    </div>
  );
}
