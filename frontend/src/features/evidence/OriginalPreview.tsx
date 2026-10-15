"use client";

import { useState } from "react";
import type { EvidenceItem } from "@/lib/types";
import styles from "./preview.module.css";

/** Plays or shows a stored original. Formats a browser cannot render fall back to a download. */
export function OriginalPreview({ item, href }: { item: EvidenceItem; href: string }) {
  const [failed, setFailed] = useState(false);
  const ext = item.original_filename.split(".").pop()?.toUpperCase() ?? "";
  const onError = () => setFailed(true);

  let player: React.ReactNode = null;
  if (!failed) {
    if (item.type === "audio") {
      player = <audio controls preload="metadata" src={href} onError={onError} className={styles.audio} />;
    } else if (item.type === "video") {
      player = <video controls playsInline preload="metadata" src={href} onError={onError} className={styles.video} />;
    } else if (item.type === "image") {
      // eslint-disable-next-line @next/next/no-img-element -- original bytes, not an optimizable asset
      player = <img src={href} alt={`Original image ${item.original_filename}`} onError={onError} className={styles.image} />;
    } else if (item.type === "pdf") {
      player = <iframe src={href} title={`Original PDF ${item.original_filename}`} className={styles.pdf} />;
    }
  }

  return (
    <div className={styles.preview}>
      {player}
      {failed && (
        <p className={styles.note} role="note">
          This browser cannot play {ext} files. The original is stored unchanged; download it to open it
          in another player.
        </p>
      )}
      {!player && !failed && (
        <p className={styles.note}>{ext} files are stored as uploaded. Open the original to read it.</p>
      )}
      <p className={styles.meta}>
        Stored and hashed exactly as uploaded. Events are not extracted from uploaded {item.type} files in
        this MVP, so nothing on the timeline comes from it yet.
      </p>
      <a href={href} className="gp-btn gp-btn-ghost" target="_blank" rel="noreferrer">
        Open original {ext}
      </a>
    </div>
  );
}
