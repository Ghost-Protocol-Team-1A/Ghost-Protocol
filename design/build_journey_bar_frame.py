"""Builds the Figma source for 'v2 · APP / Journey bar on every case page'."""

from pathlib import Path

CSS = (Path(__file__).parent / "v2.css").read_text()
STEPS = [("Scope", "done"), ("Evidence", "done"), ("Extract", "now"), ("Timeline", ""), ("Questions", ""), ("Conclude", "")]


def pill(i, label, state):
    num = "✓" if state == "done" else str(i)
    ring = {"done": "background:#B8F54A;color:#0A0B0D;border:none", "now": "border:1px solid #B8F54A;color:#B8F54A", "": "border:1px solid #2A2E35;color:#9BA3AF"}[state]
    box = "border:1px solid #B8F54A;box-shadow:0 0 0 3px rgba(184,245,74,.12)" if state == "now" else "border:1px solid #22262C"
    return (
        f'<div style="display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:#111317;{box}">'
        f'<span style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-size:11px;{ring}">{num}</span>'
        f'<span class="small" style="font-weight:600">{label}</span></div>'
    )


bar = (
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 32px;border-bottom:1px solid #16191E;background:#0D0F12">'
    '<div style="display:flex;align-items:center;gap:8px"><span class="mono xs dim" style="margin-right:6px">CASE-003</span>'
    + "".join(pill(i, l, s) for i, (l, s) in enumerate(STEPS, 1))
    + '</div><div style="display:flex;align-items:center;gap:12px"><span class="small muted">2 files without events yet</span>'
    '<span class="btn btn-lime" style="height:38px">Next: Turn evidence into events →</span></div></div>'
)
page = (
    '<div class="frame" id="v2-journey-bar"><div style="height:64px;border-bottom:1px solid #16191E"></div>' + bar
    + '<div class="main"><span class="eyebrow">Evidence viewer</span><h1 style="font-size:40px">E-02 · dock_cam.mov</h1>'
    '<div class="card" style="height:260px;display:flex;align-items:center;justify-content:center" class="muted">Evidence page content</div>'
    '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #16191E;padding-top:20px">'
    '<span class="small muted">← Intake</span><span class="btn btn-ghost" style="height:40px">Continue to Extract →</span></div></div></div>'
)
print(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{page}</body></html>')
