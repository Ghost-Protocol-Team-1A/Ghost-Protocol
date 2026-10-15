import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing — Ghost Protocol",
  description:
    "Transparent, review-centric packaging for incident investigation teams. Built around evidence review, not automated verdicts.",
};

const TIERS = [
  {
    tag: "Case Pilot",
    heading: "Contact us",
    subtitle: "One controlled case.",
    features: ["Evidence intake and hashing", "Timeline normalization", "Conflict review", "Report preview"],
    ctaText: "Talk to us",
  },
  {
    tag: "Response Team",
    heading: "Custom",
    subtitle: "Repeatable investigations.",
    features: ["Multiple active cases", "Team roles and audit trail", "Hypothesis comparison", "Review assignments"],
    ctaText: "Request team demo",
    featured: true,
  },
  {
    tag: "Enterprise",
    heading: "Let's scope it",
    subtitle: "Complex environments.",
    features: ["Identity integration", "Advanced access policies", "Deployment options", "Security review and support"],
    ctaText: "Talk to us",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Pricing</span>
        <h1 className={m.title}>Start with one case. Scale with confidence.</h1>
        <p className={m.lead}>
          Plans built around review, not automated verdicts. Proposed packaging for validation;
          rates, limits and service terms are confirmed before launch.
        </p>
        <span className="gp-chip" role="note">
          Illustrative tiers for the hackathon · not a commercial offer
        </span>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Investigation tiers">
        <div className={m.grid3}>
          {TIERS.map((tier) => (
            <article key={tier.tag} className={`${m.card} ${styles.tier} ${tier.featured ? styles.featured : ""}`}>
              <span className={m.label}>{tier.tag}</span>
              <h2 className={styles.price}>{tier.heading}</h2>
              <p>{tier.subtitle}</p>
              <ul className={styles.features}>
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                href="/contact"
                className={`gp-btn ${tier.featured ? "gp-btn-lime" : "gp-btn-ghost"} ${styles.cta}`}
              >
                {tier.ctaText}
              </Link>
            </article>
          ))}
        </div>
        <p className={m.note}>
          Pricing should never incentivize unnecessary evidence collection. Confirm data residency,
          retention, and contract terms.
        </p>
      </section>
    </>
  );
}
