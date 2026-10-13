import Link from "next/link";

export default function Home() {
  return (
    <section>
      <p style={{ color: "var(--gp-lime)", fontSize: "var(--gp-text-xs)", letterSpacing: "0.08em" }}>
        EVIDENCE YOU CAN INSPECT
      </p>
      <h1 style={{ fontSize: "var(--gp-text-xl)", maxWidth: 720 }}>
        Reconstruct what happened. Show the evidence. Reveal what remains unknown.
      </h1>
      <p style={{ color: "var(--gp-text-muted)", maxWidth: 640 }}>
        Ghost Protocol aligns fragmented evidence into one timeline, keeps original timestamps,
        flags contradictions with the rule that found them, and never presents an inference as
        a fact.
      </p>
      <Link href="/cases/CASE-001/timeline">Open the fictional demo case →</Link>
    </section>
  );
}
