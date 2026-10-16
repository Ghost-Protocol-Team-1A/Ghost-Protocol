# Design source

HTML that generates the Figma frames in file `3IWZQxgbsWBZuzPqPYVI2M`, section **v2 · Black + Lime**.
Keep it here so a frame can be regenerated and checked against the built screen.

- `v2.css`: the v2 tokens (ink `#0A0B0D`, signal lime `#B8F54A`, state colors for data only).
- `build_analytics_frames.py`: frames `v2 · APP / Analytics` and `v2 · APP / AI assistant (briefing + ask)`.

## Chart colors

State fills in charts are darker steps of the badge colors, validated for the dark chart
surface `#111317` with the data-viz palette validator. The order is also the severity scale:

| State | Badge | Chart fill |
| --- | --- | --- |
| Contradicted | `#FF6B5E` | `#E04A64` (plus a 45° texture) |
| Unresolved | `#F5B94F` | `#B88A10` |
| Inferred | `#7DB4FF` | `#5A8AF0` |
| Supported | `#B8F54A` | `#6E9F22` |

The worst adjacent colour-blind distance is 7.9 (deutan), inside the band that requires a
second encoding. Every segment therefore carries its count as a direct label, contradicted
carries a texture, and every chart has a legend and a table view.
