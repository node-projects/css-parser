import { parse, stringify } from '../src/index.js';
import {
  type CssDeclarationAST,
  type CssMediaAST,
  type CssRuleAST,
  CssTypes,
} from '../src/type.js';

// ---------------------------------------------------------------------------
// Adding new declarations to an existing rule
// ---------------------------------------------------------------------------
describe('identity mode with new declarations', () => {
  it('should format a new declaration appended to a rule', () => {
    const css = '.foo {\n  color: red;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const rule = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'background',
      value: 'blue',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe('.foo {\n  color: red;\n  background: blue;\n}\n');
  });

  it('should format multiple new declarations appended to a rule', () => {
    const css = '.foo {\n  color: red;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const rule = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push(
      {
        type: CssTypes.declaration,
        property: 'background',
        value: 'blue',
      } as CssDeclarationAST,
      {
        type: CssTypes.declaration,
        property: 'font-size',
        value: '14px',
      } as CssDeclarationAST,
    );

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      '.foo {\n  color: red;\n  background: blue;\n  font-size: 14px;\n}\n',
    );
  });

  it('should handle inserting a declaration into an empty rule', () => {
    const css = '.empty {}\n';
    const ast = parse(css, { preserveFormatting: true });

    const rule = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'display',
      value: 'block',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe('.empty {\n  display: block;\n}\n');
  });
});

// ---------------------------------------------------------------------------
// Adding new rules to a stylesheet
// ---------------------------------------------------------------------------
describe('identity mode with new rules', () => {
  it('should format a new rule appended to the stylesheet', () => {
    const css = '.existing {\n  color: red;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    ast.stylesheet.rules.push({
      type: CssTypes.rule,
      selectors: ['.new-rule'],
      declarations: [
        {
          type: CssTypes.declaration,
          property: 'background',
          value: 'blue',
        } as CssDeclarationAST,
      ],
    } as CssRuleAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      '.existing {\n  color: red;\n}\n\n.new-rule {\n  background: blue;\n}',
    );
  });

  it('should format a new rule with multiple declarations', () => {
    const css = 'h1 {\n  font-size: 2em;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    ast.stylesheet.rules.push({
      type: CssTypes.rule,
      selectors: ['.added'],
      declarations: [
        {
          type: CssTypes.declaration,
          property: 'color',
          value: 'green',
        } as CssDeclarationAST,
        {
          type: CssTypes.declaration,
          property: 'padding',
          value: '1rem',
        } as CssDeclarationAST,
      ],
    } as CssRuleAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      'h1 {\n  font-size: 2em;\n}\n\n.added {\n  color: green;\n  padding: 1rem;\n}',
    );
  });
});

// ---------------------------------------------------------------------------
// Adding new declarations inside @media
// ---------------------------------------------------------------------------
describe('identity mode with new nodes in @media', () => {
  it('should format a new declaration inside a @media rule', () => {
    const css = '@media screen {\n  .foo {\n    color: red;\n  }\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const media = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.media,
    ) as CssMediaAST;
    const rule = media.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'background',
      value: 'blue',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      '@media screen {\n  .foo {\n    color: red;\n    background: blue;\n  }\n}\n',
    );
  });

  it('should format a new rule appended inside @media', () => {
    const css = '@media screen {\n  .foo {\n    color: red;\n  }\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const media = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.media,
    ) as CssMediaAST;
    media.rules.push({
      type: CssTypes.rule,
      selectors: ['.bar'],
      declarations: [
        {
          type: CssTypes.declaration,
          property: 'font-size',
          value: '14px',
        } as CssDeclarationAST,
      ],
    } as CssRuleAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      '@media screen {\n  .foo {\n    color: red;\n  }\n\n  .bar {\n    font-size: 14px;\n  }\n}\n',
    );
  });
});

// ---------------------------------------------------------------------------
// New nodes should match existing indentation (not just default 2-space)
// ---------------------------------------------------------------------------
describe('identity mode matches existing indentation for new nodes', () => {
  it('should use 4-space indent when existing declarations use 4 spaces', () => {
    const css = '* {\n    font-size: 20px;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const rule = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'color',
      value: 'red',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe('* {\n    font-size: 20px;\n    color: red;\n}\n');
  });

  it('should use tab indent when existing declarations use tabs', () => {
    const css = '* {\n\tfont-size: 20px;\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const rule = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'color',
      value: 'red',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe('* {\n\tfont-size: 20px;\n\tcolor: red;\n}\n');
  });

  it('should use 4-space indent in nested @media blocks', () => {
    const css = '@media screen {\n    .foo {\n        color: red;\n    }\n}\n';
    const ast = parse(css, { preserveFormatting: true });

    const media = ast.stylesheet.rules.find(
      (r) => r.type === CssTypes.media,
    ) as CssMediaAST;
    const rule = media.rules.find(
      (r) => r.type === CssTypes.rule,
    ) as CssRuleAST;
    rule.declarations.push({
      type: CssTypes.declaration,
      property: 'background',
      value: 'blue',
    } as CssDeclarationAST);

    const output = stringify(ast, { identity: true });
    expect(output).toBe(
      '@media screen {\n    .foo {\n        color: red;\n        background: blue;\n    }\n}\n',
    );
  });
});

// ---------------------------------------------------------------------------
// Existing identity round-trip must still work
// ---------------------------------------------------------------------------
describe('identity mode preserves existing formatting', () => {
  it('should round-trip with identity mode', () => {
    const css =
      '  body  ,  div  {\n\n    color:  red ;\n\n  }\n\n.other {\n  margin: 0;\n}\n';
    const ast = parse(css, { preserveFormatting: true });
    const output = stringify(ast, { identity: true });
    expect(output).toBe(css);
  });
});
