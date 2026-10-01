# Licensed OG-only font assets

Tajawal Regular400 Arabic/Latin WOFF subsets from `@fontsource/tajawal@5.3.0`, upstream Google Fonts, retrieved2026-10-02 via the npm registry. `OFL.txt` is the complete licence shipped with that distribution (Google Inc., SIL Open Font License1.1). Retain it whenever redistributing these font files. Font output images do not need to be licensed under OFL.

- Arabic SHA256: `011a34e9bce80078231d12f8603721d0f99963b7104df560970fb754306ac359`.
- Latin SHA256: `31a473958608f90fdb257e924b554f67359c8f5f797f1b9cd0b69518b965d25c`.
- Combined font files:25,476 bytes. Local, server-only; no Google Fonts network calls and no font load on regular page navigation.
- Official upstream: https://github.com/google/fonts/tree/main/ofl/tajawal
- Distribution: https://www.npmjs.com/package/@fontsource/tajawal/v/5.3.0

Why not Noto Sans Arabic? Its tested current subset triggered `lookupType:5/substFormat:3` unsupported in the bundled ImageResponse shaping engine. Tajawal was rendered and inspected instead. Arabic words are individually shaped and explicitly laid out RTL by `ogTextRuns`; mixed Latin runs remain LTR. Templates separate timestamps and labels to avoid guessed bidirectional punctuation. General non-Arabic/non-Latin typography is not claimed as supported by this OG-only font.

Do not move these assets to `public/` or import them into a client component. Next output-file tracing must include both WOFFs and the licence. Verify `route.js.nft.json` after build, including when changing the image route.

`lib/font-coverage.ts` contains ranges generated from each WOFF’s nonzero `cmap` glyph mappings (format4/12;398 codepoints). The checksum test pins this correspondence. If changing fonts, regenerate coverage using a WOFF/cmap parser or FontTools and rerun real Arabic PNG inspection. Do not expand ranges based only on a CSS unicode-range claim. Metadata falls back to the existing generic site image for characters outside the local font, and the renderer fails closed without making remote font requests. Native SVG/PNG still uses device text shaping and preserves the source name.
