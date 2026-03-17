import { parse, stringify } from '../src/index';

describe('investigate issues', () => {
  it('empty rules round trip', () => {
    const css = '.empty {}\n@media screen {}\n@layer utilities {}\n@keyframes empty {}';
    const ast = parse(css);
    const out1 = stringify(ast);
    console.log('OUT1:', JSON.stringify(out1));
    const ast2 = parse(out1);
    const out2 = stringify(ast2);
    console.log('OUT2:', JSON.stringify(out2));
    // The issue is: .empty {} produces an empty rule with no declarations
    // On stringify it may produce just ".empty {\n}" with a trailing newline
    // Let's just check parse works
    expect(ast.stylesheet.rules.length).toBe(4);
  });

  it('multi-line grid-template-areas round trip', () => {
    const css = `.grid {\n  grid-template-areas:\n    "header header"\n    "sidebar main"\n    "footer footer";\n}`;
    const ast = parse(css);
    const out1 = stringify(ast);
    console.log('GRID OUT1:', JSON.stringify(out1));
    const ast2 = parse(out1);
    const out2 = stringify(ast2);
    console.log('GRID OUT2:', JSON.stringify(out2));
  });
});
