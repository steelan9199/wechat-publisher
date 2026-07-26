# SVG 图设计规范（技能内置，自包含）

本文件是 svg-diagram 技能的内置设计规范，列出手绘 SVG 图表的全部硬性约束。
技能完全自包含——不依赖任何外部 AI 客户端命令，所有绘图知识都在本文件与示例内。
请严格按本规范绘制，以保证图表风格一致、在浅色 / 深色主题下都清晰可读。

## Canvas

- Root: `<svg viewBox="0 0 680 H" width="100%" role="img">` — `680` is fixed.
- `H` = bottommost element y + 20. Do not guess.
- Safe area: x ∈ [40, 640], y ∈ [40, H-40]. Outer background transparent.
- First children: `<title>` and `<desc>` (accessibility).

## Typography

- Fonts: `font-family="sans-serif"`.
- Two weights only: `400` (regular), `500` (medium). Never 600/700.
- Sizes: title 14px/500, subtitle 13px/400, body 13px/400, caption 12px/400.
  No font below 11px.
- `line-height` 1.6 (for HTML widgets, not SVG).
- Theme-aware text:
  - Light theme: primary text `#1f2937`, secondary/muted `#5F5E5A`, hint `#888780`.
  - Dark theme: primary `#E6E6E6` (light), secondary `#A8A8A8`.
- Inside boxes, every `<text>` needs `dominant-baseline="central"`.

## Color palette (9 ramps × 7 levels)

Level meaning: 50 lightest fill, 100–200 light fills, 400 midtone, 600 accent/
stroke, 800–900 text on light bg.

| Ramp   | 50      | 100     | 200     | 400     | 600     | 800     | 900     |
|--------|---------|---------|---------|---------|---------|---------|---------|
| purple | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |
| teal   | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |
| coral  | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |
| pink   | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |
| gray   | #F1EFE8 | #D3D1C7 | #B4B2A9 | #888780 | #5F5E5A | #444441 | #2C2C2A |
| blue   | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |
| green  | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |
| amber  | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |
| red    | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |

- Light mode node: 50 fill + 600 stroke + 800 title / 600 subtitle.
- Dark mode node: 800 fill + 200 stroke + 100 title / 200 subtitle.
- Caps per diagram: ≤2 color ramps.

## Flatness rules

- NO gradients, drop shadows, blur, glow, or neon.
- Solid flat fills only. Use `fill="none"` on all connector paths.
- 0.5px strokes for diagram borders/edges.

## Arrow marker (include in every `<defs>`)

```svg
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>
```

Use `marker-end="url(#arrow)"` on connector lines; color follows
`stroke="context-stroke"`.

## Box geometry

- Single-line node: height 44px. Two-line node: height 56px.
- `rect_width = max(title_chars × 7, subtitle_chars × 6) + 24`.
- `rx="8"` (or `rx="10"`–`12` for larger cards).
- Inner padding ≥24px; ≥60px gap between boxes; ≥12px between text and edge.
- Keep all nodes in a tier the same height when content type matches.

## Node examples

```svg
<!-- single-line -->
<g>
  <rect x="100" y="20" width="180" height="44" rx="8" fill="#E6F1FB" stroke="#185FA5" stroke-width="0.5"/>
  <text x="190" y="42" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-size="14" font-weight="500" fill="#1f2937">T-cells</text>
</g>

<!-- two-line -->
<g>
  <rect x="100" y="20" width="200" height="56" rx="8" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.5"/>
  <text x="200" y="38" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-size="14" font-weight="500" fill="#1f2937">Dendritic cells</text>
  <text x="200" y="56" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-size="12" fill="#5F5E5A">Detect foreign antigens</text>
</g>
```

## Forbidden

- `<!-- comments -->` or `/* comments */` inside the SVG.
- Rotated text, `position: fixed`, `<html>`/`<head>`/`<body>` wrappers.
- Emoji in the SVG; use shapes/paths instead.
- 每个内联渲染调用只放一张图（one diagram per call）。
