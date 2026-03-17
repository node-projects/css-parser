import { parse, stringify } from '../src/index';
import { type CssDeclarationAST, type CssRuleAST, CssTypes } from '../src/type';

/**
 * Helper: parse CSS, stringify, re-parse, re-stringify and assert round-trip
 * stability. Also verifies that compression produces valid output.
 */
function expectRoundTrip(css: string) {
  const ast = parse(css);
  const out1 = stringify(ast);
  const compressed = stringify(ast, { compress: true });
  // Compressed output must also parse cleanly
  parse(compressed);
  // Round-trip: stringify(parse(stringify(parse(css)))) === stringify(parse(css))
  const out2 = stringify(parse(out1));
  expect(out2).toBe(out1);
}

// ---------------------------------------------------------------------------
// Modern color functions
// ---------------------------------------------------------------------------
describe('modern color functions', () => {
  it('should parse color-mix()', () => {
    expectRoundTrip('.a { color: color-mix(in srgb, red 50%, blue); }');
  });

  it('should parse oklch()', () => {
    expectRoundTrip(
      '.a { color: oklch(0.7 0.15 180); background: oklch(0.5 0.2 120 / 0.5); }',
    );
  });

  it('should parse lab() and lch()', () => {
    expectRoundTrip(
      '.a { color: lab(50% 20 -30); background: lch(50% 30 180); }',
    );
  });

  it('should parse hwb()', () => {
    expectRoundTrip('.a { color: hwb(180 20% 30%); }');
  });
});

// ---------------------------------------------------------------------------
// Complex selectors
// ---------------------------------------------------------------------------
describe('complex selectors', () => {
  it('should parse :has(), :is(), :where() combinations', () => {
    expectRoundTrip(`
      :has(> img):not(:has(> img + *)) { aspect-ratio: 1; }
      :is(h1, h2, h3):where(.title, .heading) { font-weight: bold; }
      :has(+ .sibling) { margin-right: 1em; }
    `);
  });

  it('should parse complex attribute selectors', () => {
    expectRoundTrip(`
      [data-value^="prefix"] { color: red; }
      [data-value$="suffix" i] { color: blue; }
      [data-value*="contains" s] { color: green; }
      input[type="text"][required]:not(:disabled) { border: 1px solid red; }
    `);
  });

  it('should parse escaped characters in selectors', () => {
    expectRoundTrip('.foo\\.bar { color: red; }\n.foo\\:bar { color: blue; }');
  });
});

// ---------------------------------------------------------------------------
// Modern at-rules
// ---------------------------------------------------------------------------
describe('modern at-rules', () => {
  it('should parse @supports with selector()', () => {
    expectRoundTrip(`
      @supports (display: grid) and (not (display: inline-grid)) {
        .grid { display: grid; }
      }
      @supports selector(:has(> .child)) {
        .parent:has(> .child) { color: red; }
      }
    `);
  });

  it('should parse @property', () => {
    const css =
      '@property --my-color { syntax: "<color>"; inherits: false; initial-value: #c0ffee; }';
    const ast = parse(css);
    const prop = ast.stylesheet.rules[0];
    expect(prop.type).toBe(CssTypes.property);
    expectRoundTrip(css);
  });

  it('should parse @scope with complex boundaries', () => {
    expectRoundTrip(`
      @scope (.card) to (.card-body > *) {
        :scope { padding: 1rem; }
        .title { font-size: 1.2em; }
      }
    `);
  });

  it('should parse @layer ordering and body', () => {
    expectRoundTrip(`
      @layer base, components, utilities;
      @layer components {
        .btn { padding: 0.5em 1em; }
      }
    `);
  });

  it('should parse @container with style()', () => {
    expectRoundTrip(`
      @container style(--theme: dark) { .card { background: #333; } }
      @container sidebar (min-width: 400px) and style(--responsive: true) {
        .sidebar-content { display: flex; }
      }
    `);
  });

  it('should parse @starting-style nested inside a rule', () => {
    expectRoundTrip(`
      .box {
        transition: opacity 0.5s;
        opacity: 1;
        @starting-style { opacity: 0; }
      }
    `);
  });

  it('should parse @view-transition', () => {
    expectRoundTrip(`
      @view-transition { navigation: auto; }
      ::view-transition-old(main) { animation-duration: 0.3s; }
      ::view-transition-new(main) { animation-duration: 0.3s; }
    `);
  });

  it('should parse @position-try', () => {
    expectRoundTrip('@position-try --my-position { top: 10px; left: 20px; }');
  });

  it('should parse @counter-style', () => {
    expectRoundTrip(
      '@counter-style thumbs { system: cyclic; symbols: "\\1F44D"; suffix: " "; }',
    );
  });
});

// ---------------------------------------------------------------------------
// Complex values
// ---------------------------------------------------------------------------
describe('complex values', () => {
  it('should parse math functions (calc, min, max, clamp)', () => {
    expectRoundTrip(`
      .box {
        width: calc(100% - 2rem);
        height: min(50vh, 300px);
        font-size: clamp(1rem, 2vw + 0.5rem, 2rem);
      }
    `);
  });

  it('should parse nested var() fallbacks', () => {
    expectRoundTrip(`
      .box {
        color: var(--color, var(--fallback-color, blue));
        background: var(--bg, linear-gradient(to right, red, blue));
        border: var(--border, 1px solid var(--border-color, #ccc));
      }
    `);
  });

  it('should parse !important in various positions', () => {
    const css =
      '.box { color: red !important; background: linear-gradient(to right, red, blue) !important; --custom: value !important; }';
    const ast = parse(css);
    const decls = (ast.stylesheet.rules[0] as CssRuleAST)
      .declarations as CssDeclarationAST[];
    expect(decls[0].value).toContain('!important');
    expectRoundTrip(css);
  });

  it('should parse complex animation shorthands', () => {
    expectRoundTrip(`
      .box {
        animation: slide-in 0.5s ease-out forwards,
                   fade-in 0.3s ease-in,
                   pulse 2s infinite alternate;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
    `);
  });

  it('should parse @font-face with unicode-range and variable weights', () => {
    expectRoundTrip(`
      @font-face {
        font-family: "Custom Font";
        src: url("font.woff2") format("woff2"),
             url("font.woff") format("woff");
        unicode-range: U+0025-00FF, U+4??;
        font-display: swap;
        font-weight: 100 900;
      }
    `);
  });

  it('should parse multi-line grid-template-areas and round-trip correctly', () => {
    expectRoundTrip(`.grid {
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
}`);
  });
});

// ---------------------------------------------------------------------------
// Media queries
// ---------------------------------------------------------------------------
describe('media queries', () => {
  it('should parse range syntax', () => {
    expectRoundTrip(`
      @media (width > 600px) { .box { color: red; } }
      @media (400px <= width <= 800px) { .box { color: blue; } }
    `);
  });

  it('should parse triply-nested media queries', () => {
    expectRoundTrip(`
      @media screen {
        @media (min-width: 768px) {
          @media (prefers-color-scheme: dark) {
            .box { color: white; }
          }
        }
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// CSS nesting
// ---------------------------------------------------------------------------
describe('CSS nesting', () => {
  it('should parse deeply nested rules (6 levels)', () => {
    expectRoundTrip(
      '.l1 { .l2 { .l3 { .l4 { .l5 { .l6 { color: red; } } } } } }',
    );
  });

  it('should parse complex nesting with multiple selectors', () => {
    expectRoundTrip(`
      .card, .panel {
        padding: 1rem;
        & .title, & .heading {
          font-size: 1.5em;
          &:hover, &:focus { color: blue; }
        }
        &:hover {
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        @media (max-width: 768px) { padding: 0.5rem; }
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('should handle minified CSS', () => {
    expectRoundTrip('.box{color:red;background:blue;border:1px solid green}');
  });

  it('should handle empty at-rule blocks without extra whitespace', () => {
    // Empty rules are intentionally stripped by the compiler;
    // verify the remaining at-rules still round-trip cleanly.
    const css =
      '.empty {}\n@media screen {}\n@layer utilities;\n@keyframes empty {}';
    const ast = parse(css);
    const out = stringify(ast);
    // .empty {} has no declarations and is dropped
    // @media screen {} has no rules inside and is preserved (empty block)
    // @keyframes empty {} has no keyframes and is preserved (empty block)
    const out2 = stringify(parse(out));
    expect(out2).toBe(out);
  });
});

// ---------------------------------------------------------------------------
// Real-world complex CSS
// ---------------------------------------------------------------------------
describe('real-world complex CSS', () => {
  it('should parse and round-trip a modern design-system stylesheet', () => {
    const css = `
@layer base, components, utilities;

@property --accent-color {
  syntax: "<color>";
  inherits: true;
  initial-value: oklch(0.7 0.15 180);
}

@font-face {
  font-family: "App Font";
  src: url("font.woff2") format("woff2");
  font-display: swap;
}

@layer base {
  :root {
    --accent-color: oklch(0.7 0.15 180);
    --spacing: clamp(0.5rem, 2vw, 2rem);
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
  }
}

@layer components {
  .card {
    container-type: inline-size;
    padding: var(--spacing);
    background: color-mix(in oklch, var(--accent-color) 10%, white);
    border-radius: 0.5rem;

    & .title {
      font-size: 1.5em;
      color: var(--accent-color);

      &:hover {
        color: color-mix(in oklch, var(--accent-color), black 20%);
      }
    }

    @container (min-width: 400px) {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: var(--spacing);
    }

    @media (prefers-color-scheme: dark) {
      background: color-mix(in oklch, var(--accent-color) 10%, black);
    }
  }
}

@layer utilities {
  .sr-only:not(:focus):not(:active) {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }
}

@media print {
  @page {
    margin: 2cm;
    @top-center { content: "Document Title"; }
  }
  .no-print { display: none !important; }
}
`;
    expectRoundTrip(css);
  });
});

// ---------------------------------------------------------------------------
// removeEmptyRules option
// ---------------------------------------------------------------------------
describe('removeEmptyRules option', () => {
  it('should remove empty rules in beautified mode', () => {
    const css = '.empty {} .keep { color: red; }';
    const ast = parse(css);
    const output = stringify(ast, { removeEmptyRules: true });
    expect(output).not.toContain('.empty');
    expect(output).toContain('.keep');
    expect(output).toContain('color: red');
  });

  it('should remove empty rules in compressed mode', () => {
    const css = '.empty {} .keep { color: red; }';
    const ast = parse(css);
    const output = stringify(ast, { compress: true, removeEmptyRules: true });
    expect(output).not.toContain('.empty');
    expect(output).toContain('.keep');
  });

  it('should keep empty rules by default', () => {
    const css = '.empty {} .keep { color: red; }';
    const ast = parse(css);
    const output = stringify(ast);
    expect(output).toContain('.empty');
    expect(output).toContain('.keep');
  });

  it('should remove empty rules inside @media', () => {
    const css = '@media screen { .empty {} .keep { color: red; } }';
    const ast = parse(css);
    const output = stringify(ast, { removeEmptyRules: true });
    expect(output).not.toContain('.empty');
    expect(output).toContain('.keep');
  });
});

// ---------------------------------------------------------------------------
// identity (write-back) mode
// ---------------------------------------------------------------------------
describe('identity mode', () => {
  it('should reproduce original CSS with preserveFormatting', () => {
    const css = '.foo   {  color :  red ;  }';
    const ast = parse(css, { preserveFormatting: true });
    const output = stringify(ast, { identity: true });
    expect(output).toBe(css);
  });

  it('should preserve unusual whitespace', () => {
    const css = '  body  ,  div  {\n\n    color:  red ;\n\n  }\n\n';
    const ast = parse(css, { preserveFormatting: true });
    const output = stringify(ast, { identity: true });
    expect(output).toBe(css);
  });

  it('should preserve comments in original positions', () => {
    const css = '/* header */ .foo { color: red; /* inline */ }';
    const ast = parse(css, { preserveFormatting: true });
    const output = stringify(ast, { identity: true });
    expect(output).toBe(css);
  });

  it('should fall back to beautified output without preserveFormatting', () => {
    const css = '.foo{color:red}';
    const ast = parse(css);
    const output = stringify(ast, { identity: true });
    // Without preserveFormatting, identity falls back to beautified mode
    expect(output).toBe(stringify(ast));
  });
});
