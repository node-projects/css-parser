import { parse, stringify } from '../src/index';

function testParse(name: string, css: string): { name: string, ok: boolean, error?: string, roundTripDiff?: boolean } {
  try {
    const ast = parse(css);
    const out = stringify(ast);
    const compressed = stringify(ast, { compress: true });
    // Check round-trip
    const ast2 = parse(out);
    const out2 = stringify(ast2);
    if (out !== out2) {
      return { name, ok: false, roundTripDiff: true, error: `Round trip: [${out.substring(0, 100)}] vs [${out2.substring(0, 100)}]` };
    }
    return { name, ok: true };
  } catch (e: any) {
    return { name, ok: false, error: e.message };
  }
}

const tests = [
  ['color-mix()', `.box { color: color-mix(in srgb, red 50%, blue); }`],
  ['oklch()', `.box { color: oklch(0.7 0.15 180); background: oklch(0.5 0.2 120 / 0.5); }`],
  ['lab() and lch()', `.box { color: lab(50% 20 -30); background: lch(50% 30 180); }`],
  ['hwb()', `.box { color: hwb(180 20% 30%); }`],
  ['@supports complex', `@supports (display: grid) and (not (display: inline-grid)) { .grid { display: grid; } }\n@supports selector(:has(> .child)) { .parent:has(> .child) { color: red; } }`],
  ['@property', `@property --my-color { syntax: "<color>"; inherits: false; initial-value: #c0ffee; }`],
  ['@scope complex', `@scope (.card) to (.card-body > *) { :scope { padding: 1rem; } .title { font-size: 1.2em; } }`],
  ['@layer with imports', `@layer base, components, utilities;\n@import url("base.css") layer(base);\n@layer components { .btn { padding: 0.5em 1em; } }`],
  ['@container with style()', `@container style(--theme: dark) { .card { background: #333; } }\n@container sidebar (min-width: 400px) and style(--responsive: true) { .sidebar-content { display: flex; } }`],
  ['Complex pseudo-class selectors', `:has(> img):not(:has(> img + *)) { aspect-ratio: 1; }\n:is(h1, h2, h3):where(.title, .heading) { font-weight: bold; }\n:has(+ .sibling) { margin-right: 1em; }`],
  ['Math functions', `.box { width: calc(100% - 2rem); height: min(50vh, 300px); font-size: clamp(1rem, 2vw + 0.5rem, 2rem); }`],
  ['Custom properties with complex fallbacks', `.box { color: var(--color, var(--fallback-color, blue)); background: var(--bg, linear-gradient(to right, red, blue)); }`],
  ['@font-face with unicode-range', `@font-face { font-family: "Custom Font"; src: url("font.woff2") format("woff2"), url("font.woff") format("woff"); unicode-range: U+0025-00FF, U+4??; font-display: swap; font-weight: 100 900; }`],
  ['Media range syntax', `@media (width > 600px) { .box { color: red; } }\n@media (400px <= width <= 800px) { .box { color: blue; } }`],
  ['Nested media queries', `@media screen { @media (min-width: 768px) { @media (prefers-color-scheme: dark) { .box { color: white; } } } }`],
  ['!important', `.box { color: red !important; background: linear-gradient(to right, red, blue) !important; --custom: value !important; }`],
  ['CSS Grid complex', `.grid { grid-template-areas: "header header header" "sidebar main aside" "footer footer footer"; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }`],
  ['Complex animations', `.box { animation: slide-in 0.5s ease-out forwards, fade-in 0.3s ease-in, pulse 2s infinite alternate; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }`],
  ['@keyframes complex values', `@keyframes complex-anim { from { transform: translateX(0) rotate(0deg) scale(1); } 25%, 75% { transform: translateX(50px) rotate(180deg); } to { transform: translateX(0); } }`],
  ['Complex attribute selectors', `[data-value^="prefix"] { color: red; }\n[data-value$="suffix" i] { color: blue; }\ninput[type="text"][required]:not(:disabled) { border: 1px solid red; }`],
  ['@starting-style nested', `.box { transition: opacity 0.5s; opacity: 1; @starting-style { opacity: 0; } }`],
  ['@view-transition', `@view-transition { navigation: auto; }\n::view-transition-old(main) { animation-duration: 0.3s; }`],
  ['Complex nesting with multiple selectors', `.card, .panel { padding: 1rem; & .title, & .heading { font-size: 1.5em; &:hover, &:focus { color: blue; } } @media (max-width: 768px) { padding: 0.5rem; } }`],
  ['Deep nesting 6 levels', `.l1 { .l2 { .l3 { .l4 { .l5 { .l6 { color: red; } } } } } }`],
  ['Empty rules', `.empty {}\n@media screen {}\n@layer utilities {}\n@keyframes empty {}`],
  ['Minified CSS', `.box{color:red;background:blue;border:1px solid green}`],
  ['Escaped chars in selectors', `.foo\\.bar { color: red; }\n.foo\\:bar { color: blue; }`],
  ['@position-try', `@position-try --my-position { top: 10px; left: 20px; }`],
  ['Multi-line grid-template-areas', `.grid {\n  grid-template-areas:\n    "header header"\n    "sidebar main"\n    "footer footer";\n}`],
  ['@counter-style', `@counter-style thumbs { system: cyclic; symbols: "\\1F44D"; suffix: " "; }`],
] as [string, string][];

describe('Complex CSS parsing', () => {
  for (const [name, css] of tests) {
    it(`should parse: ${name}`, () => {
      const result = testParse(name, css);
      if (!result.ok) {
        console.log(`FAIL: ${name}: ${result.error}`);
      }
      expect(result.ok).toBe(true);
    });
  }
});
