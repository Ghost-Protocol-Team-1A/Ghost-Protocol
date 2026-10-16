"""Builds the Figma source for 'v2 · APP / Analytics' and 'v2 · APP / AI assistant'.

Run: python3 design/build_analytics_frames.py > /tmp/frames.html, then send it to Figma.
"""

from pathlib import Path

CSS = (Path(__file__).parent / "v2.css").read_text()
LOGO = (
    '<svg width="28" height="28" viewBox="0 0 32 32"><path d="M16 2.5 4.5 7v8.4c0 6.9 4.7 12.4 '
    '11.5 14.1 6.8-1.7 11.5-7.2 11.5-14.1V7L16 2.5Z" fill="#B8F54A"/><path d="m10.5 16.2 3.7 3.7 '
    '7.3-7.6" fill="none" stroke="#0A0B0D" stroke-width="2.6" stroke-linecap="round" '
    'stroke-linejoin="round"/></svg>'
)
# Chart fills for states, validated on #111317 (order: contradicted, unresolved, inferred, supported).
ST = {"con": "#E04A64", "unr": "#B88A10", "inf": "#5A8AF0", "sup": "#6E9F22"}
LABEL = {"con": "Contradicted", "unr": "Unresolved", "inf": "Inferred", "sup": "Supported"}
RAMP = ["#161A1F", "#2A3A12", "#3F5A17", "#5B8420", "#8CC63A", "#B8F54A"]


def pt(text: str, tags) -> str:
    chips = "".join(f'<span class="tag {c}">{t}</span>' for c, t in tags)
    return (
        f'<div style="display:flex;flex-direction:column;gap:6px"><p class="small">{text}</p>'
        f'<div style="display:flex;gap:6px">{chips}</div></div>'
    )


def side(active: str) -> str:
    items = [
        ("WORKSPACE", None),
        ("Dashboard", "dash"), ("Cases", "cases"), ("Guide", "guide"),
        ("CASE-001", None),
        ("Overview", "home"), ("Timeline", "timeline"), ("Graph", "graph"),
        ("Analytics", "analytics"), ("AI assistant", "ai"), ("Conflicts", "conflicts"),
        ("Questions & claims", "questions"), ("Conclusion", "conclusion"), ("Report", "report"),
    ]
    out = [f'<div class="side"><div style="padding:4px 12px 20px"><div class="logo">{LOGO}GHOST PROTOCOL</div></div>']
    for label, key in items:
        if key is None:
            out.append(f'<div class="group">{label}</div>')
        else:
            on = " on" if key == active else ""
            out.append(f'<div class="item{on}"><span class="n">·</span>{label}</div>')
    out.append('<div style="flex:1"></div><div class="small muted" style="padding:12px">← Back to website</div></div>')
    return "".join(out)


TOP = (
    '<div class="top"><div class="search"><span>Search cases, evidence, events…</span>'
    '<span class="kbd">⌘K</span></div><div style="display:flex;gap:14px;align-items:center">'
    '<span class="chip chip-line">Synthetic demo data</span><span class="small muted">Judge Adaeze · Reviewer</span>'
    '<div style="width:32px;height:32px;border-radius:50%;background:#B8F54A;color:#0A0B0D;display:flex;'
    'align-items:center;justify-content:center;font-weight:700;font-size:13px">JA</div></div></div>'
)


def app(fid: str, active: str, body: str) -> str:
    return f'<div class="frame" id="{fid}"><div class="app">{side(active)}<div>{TOP}<div class="main">{body}</div></div></div></div>'


def stack(parts, unit=1.0) -> str:
    segs = "".join(
        f'<span class="{"tex" if k == "con" else ""}" style="flex:{n};background:{ST[k]}">{n}</span>'
        for k, n in parts if n
    )
    return f'<div class="bar">{segs}</div>'


def legend() -> str:
    return '<div class="lg">' + "".join(
        f'<span><i class="{"tex" if k == "con" else ""}" style="background:{ST[k]}"></i>{LABEL[k]}</span>' for k in ST
    ) + "</div>"


def hist(vals) -> str:
    mx = max(vals) or 1
    bars = "".join(
        f'<div style="flex:1;height:{max(2, int(v / mx * 38))}px;background:{"#8CC63A" if v else "#1E2228"};border-radius:2px 2px 0 0"></div>'
        for v in vals
    )
    return f'<div style="display:flex;align-items:flex-end;gap:2px;height:40px;flex:1">{bars}</div>'


SOURCES = [
    ("E-01 Entrance CCTV", [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], [("sup", 1)]),
    ("E-02 Bay CCTV", [0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], [("sup", 3)]),
    ("E-03 Alarm audio", [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [("inf", 1)]),
    ("E-04 Access log", [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [("sup", 1)]),
    ("E-05 Inventory", [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [("con", 1), ("sup", 2)]),
    ("E-06 Witness", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0], [("unr", 1)]),
]
ROW = '<div style="display:grid;grid-template-columns:170px 1fr;gap:14px;align-items:{a}"><span class="mono xs muted">{n}</span>{c}</div>'
activity = "".join(ROW.format(a="end", n=n, c=hist(v)) for n, v, _ in SOURCES)
reliability = "".join(
    ROW.format(a="center", n=n, c=f'<div style="width:{sum(x for _, x in p) * 80}px">{stack(p)}</div>') for n, _, p in SOURCES
)
HEAT = {"BJ": [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "SYS": [2, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        "Judge Adaeze": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 2], "Femi": [0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0]}
heat = "".join(
    f'<div style="display:grid;grid-template-columns:110px repeat(12,1fr);gap:3px;align-items:center"><span class="small muted">{a}</span>'
    + "".join(f'<div style="height:22px;border-radius:3px;background:{RAMP[min(v, 5)]}"></div>' for v in vals) + "</div>"
    for a, vals in HEAT.items()
)
hours = '<div style="display:grid;grid-template-columns:110px repeat(12,1fr);gap:3px" class="ax"><span></span>' + "".join(
    f"<span>{h:02d}</span>" for h in range(9, 21)) + "</div>"

analytics = f"""
<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><span class="eyebrow">CASE-001 · analytics</span>
<h1 style="font-size:40px;margin-top:8px">What the evidence shows</h1></div>
<span class="btn btn-ghost" style="height:40px">Download for Power BI / Tableau</span></div>
<div class="flt"><span class="small muted">Filter</span><span class="sel">All sources ▾</span><span class="sel">All states ▾</span>
<span class="sel">Busiest 12 min ▾</span><span class="xs dim">Every chart follows these filters</span></div>
<div class="grid-4">
<div class="card kpi"><span class="mono xs dim">EVENTS</span><span class="v">10</span><span class="xs muted">across 6 sources</span></div>
<div class="card kpi"><span class="mono xs dim">SUPPORTED</span><span class="v">70%</span><span class="xs muted">7 of 10 events</span></div>
<div class="card kpi"><span class="mono xs dim">TIME-CORRECTED</span><span class="v">3</span><span class="xs muted">one camera, 120 s fast</span></div>
<div class="card kpi"><span class="mono xs dim">DECIDED</span><span class="v">2 / 3</span><span class="xs muted">conflicts with a decision</span></div></div>
<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px">
<div class="card" style="display:flex;flex-direction:column;gap:12px"><h3>Activity by source</h3><span class="xs muted">Events per minute, normalized time</span>
{activity}<div style="display:grid;grid-template-columns:170px 1fr;gap:14px"><span></span><div style="display:flex;justify-content:space-between" class="ax"><span>21:08</span><span>21:14</span><span>21:20</span></div></div></div>
<div class="card" style="display:flex;flex-direction:column;gap:12px"><h3>How each source holds up</h3><span class="xs muted">Events by state</span>{legend()}{reliability}</div></div>
<div class="grid-3">
<div class="card" style="display:flex;flex-direction:column;gap:12px"><h3>Claims</h3><span class="xs muted">7 claims by state</span>
{stack([("con", 1), ("unr", 2), ("inf", 1), ("sup", 3)])}{legend()}</div>
<div class="card" style="display:flex;flex-direction:column;gap:12px"><h3>Clock corrections</h3><span class="xs muted">How far each source's clock was off</span>
<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center"><span class="mono xs muted">E-02 Bay CCTV</span>
<div style="display:flex;align-items:center;gap:8px"><div style="width:2px;height:18px;background:#F2F4F7"></div><div style="width:170px;height:14px;background:#8A929E;border-radius:0 4px 4px 0"></div><span class="mono xs">120 s fast</span></div>
<span class="mono xs muted">5 others</span><div style="display:flex;align-items:center;gap:8px"><div style="width:2px;height:18px;background:#F2F4F7"></div><span class="mono xs muted">0 s · trusted clock</span></div></div></div>
<div class="card" style="display:flex;flex-direction:column;gap:10px"><h3>Conflicts</h3><span class="xs muted">By rule and decision</span>
<table class="table"><tr><th>Rule</th><th>Open</th><th>Decided</th></tr><tr><td class="mono">RULE-DUP-001</td><td>0</td><td>1</td></tr>
<tr><td class="mono">RULE-TIME-002</td><td>1</td><td>0</td></tr><tr><td class="mono">RULE-CLAIM-001</td><td>0</td><td>1</td></tr></table></div></div>
<div class="card" style="display:flex;flex-direction:column;gap:12px"><h3>Who did what, when</h3><span class="xs muted">Audit actions per hour · brighter is more</span>{heat}{hours}</div>
"""

assistant = f"""
<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><span class="eyebrow">CASE-001 · AI assistant</span>
<h1 style="font-size:40px;margin-top:8px">Case briefing</h1></div><span class="tag b-inf" style="padding:6px 10px">CLAUDE SONNET 5.5 · CITED · YOU DECIDE</span></div>
<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px">
<div class="card ai" style="display:flex;flex-direction:column;gap:14px"><div style="display:flex;justify-content:space-between">
<span class="mono xs" style="color:#7DB4FF">COMPILED 22:41 · FOR JUDGE ADAEZE</span><span class="small lime">Recompile</span></div>
<h3>Summary</h3>
{pt("The bay door opened at 21:12, from the access log.", [("b-sup","EV-012")])}
{pt("The bay camera runs 120 s fast; corrected, its door opening matches the access log.", [("b-inf","C-02")])}
{pt("An inventory row at 21:09 copies the access-log row. It is flagged, not treated as an event.", [("b-con","C-01")])}
<h3>Still unknown</h3>
{pt("Whether EQ-4471 was on the trolley, and who held badge B-117.", [("b-unr","CL-06"),("b-unr","CL-04")])}
<h3>Next steps</h3><p class="small">Get the gate camera export · Decide C-02 · Answer Q-03</p>
<p class="xs muted">2 points were removed because their citations did not exist.</p></div>
<div class="card" style="display:flex;flex-direction:column;gap:14px"><span class="mono xs lime">ASK THE CASE</span>
<div class="input" style="color:#F2F4F7">When did the trolley pass the bay?</div>
<div style="padding:14px;border-radius:12px;background:#15181C;display:flex;flex-direction:column;gap:8px"><p class="small">At 21:14 on the reference clock (21:16 on the camera's own clock).</p>
<div style="display:flex;gap:6px"><span class="tag b-sup">EV-014</span><span class="tag b-inf">C-02</span></div></div>
<div style="padding:14px;border-radius:12px;background:#15181C;display:flex;flex-direction:column;gap:8px"><p class="small muted">Who took the asset?</p>
<p class="small">The records cannot tell. No source links a person to badge B-117.</p><div><span class="tag b-unr">CL-04</span></div></div>
<p class="xs muted">Answers use only this case's records. Citations that do not exist are removed.</p></div></div>
"""

print(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
      + app("v2-analytics", "analytics", analytics) + app("v2-ai", "ai", assistant) + "</body></html>")
