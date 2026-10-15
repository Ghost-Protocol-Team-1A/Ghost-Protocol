"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { type PaletteItem, rankItems } from "@/lib/palette";
import styles from "./palette.module.css";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Search trigger for the top bar plus the ⌘K / Ctrl+K dialog it opens. */
export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [items, setItems] = useState<PaletteItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mac, setMac] = useState(true);

  const results = useMemo(() => rankItems(items ?? [], query), [items, query]);

  const open = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    setQuery("");
    setCursor(0);
    d.showModal();
    input.current?.focus();
    if (items === null) {
      fetch("/search-index", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: PaletteItem[]) => setItems(data))
        .catch(() => setFailed(true));
    }
  }, [items]);

  const close = () => dialog.current?.close();

  const go = (item: PaletteItem) => {
    close();
    if (item.download) window.location.assign(item.href);
    else router.push(item.href);
  };

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) close();
        else open();
      } else if (e.key === "/" && !isTyping(e.target) && !dialog.current?.open) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open} aria-haspopup="dialog">
        <Icon name="search" size={16} />
        <span className={styles.triggerText}>Search cases, evidence, events…</span>
        <kbd>{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Command palette"
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className={styles.box}>
          <div className={styles.field}>
            <Icon name="search" size={18} />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Jump to a page, conflict, event or evidence…"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[cursor] ? `${listId}-${cursor}` : undefined}
              aria-autocomplete="list"
              spellCheck={false}
            />
            <kbd>Esc</kbd>
          </div>

          <ul id={listId} role="listbox" className={styles.list} aria-label="Results">
            {results.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === cursor}
                className={styles.option}
                onMouseMove={() => setCursor(i)}
                onClick={() => go(item)}
              >
                <span className={styles.group}>{item.group}</span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.hint}>{item.hint}</span>
              </li>
            ))}
          </ul>

          {results.length === 0 && (
            <p className={styles.empty}>
              {items === null && !failed ? "Loading…" : `Nothing matches “${query}”.`}
            </p>
          )}
          {failed && <p className={styles.empty}>Case data is unavailable; pages and actions still work.</p>}

          <p className={styles.foot}>
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> move
            </span>
            <span>
              <kbd>↵</kbd> open
            </span>
            <span>
              <kbd>/</kbd> or <kbd>{mac ? "⌘K" : "Ctrl K"}</kbd> anywhere
            </span>
          </p>
        </div>
      </dialog>
    </>
  );
}
