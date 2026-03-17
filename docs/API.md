# API Reference

## Overview

`@adobe/css-tools` provides a modern CSS parser and stringifier with comprehensive TypeScript support. It can parse CSS into an Abstract Syntax Tree (AST) and convert the AST back to CSS with various formatting options.

## Installation

```bash
npm install @adobe/css-tools
```

## Core Functions

### `parse(code, options?)`

Parses CSS code and returns an Abstract Syntax Tree (AST).

#### Parameters

- `code` (string) - The CSS code to parse
- `options` (object, optional) - Parsing options
  - `silent` (boolean) - Silently fail on parse errors instead of throwing. When `true`, errors are collected in `ast.stylesheet.parsingErrors`
  - `source` (string) - File path for better error reporting
  - `preserveFormatting` (boolean) - Store source character offsets and original CSS text on the AST for identity round-trip. When `true`, position nodes include an `offset` field and `ast.stylesheet.originalSource` is set. Default: `false`

#### Returns

- `CssStylesheetAST` - The parsed CSS as an AST

#### Example

```javascript
import { parse } from '@adobe/css-tools';

const css = `
  .example {
    color: red;
    font-size: 16px;
  }
`;

const ast = parse(css);
console.log(ast.stylesheet.rules);
```

### `stringify(ast, options?)`

Converts a CSS AST back to CSS string with configurable formatting.

#### Parameters

- `ast` (CssStylesheetAST) - The CSS AST to stringify
- `options` (CompilerOptions, optional) - Stringification options
  - `indent` (string) - Indentation string (default: `'  '`)
  - `compress` (boolean) - Whether to compress/minify the output (default: `false`)
  - `identity` (boolean) - Reproduce the original CSS exactly as parsed. Requires `preserveFormatting: true` during parsing. Falls back to beautified output when original source is not available. Default: `false`
  - `removeEmptyRules` (boolean) - Remove rules with empty declaration blocks from the output. Works in all modes (beautified, compressed, identity). Default: `false`

#### Returns

- `string` - The formatted CSS string

#### Example

```javascript
import { parse, stringify } from '@adobe/css-tools';

const css = '.example { color: red; }';
const ast = parse(css);

// Pretty print
const formatted = stringify(ast, { indent: '  ' });
console.log(formatted);
// Output:
// .example {
//   color: red;
// }

// Compressed
const minified = stringify(ast, { compress: true });
console.log(minified);
// Output: .example{color:red}
```

## Type Definitions

### Core Types

#### `CssStylesheetAST`
The root AST node representing a complete CSS stylesheet.

```typescript
type CssStylesheetAST = {
  type: CssTypes.stylesheet;
  stylesheet: {
    source?: string;
    rules: CssRuleAST[];
    parsingErrors?: CssParseError[];
    originalSource?: string; // Set when preserveFormatting is true
  };
};
```

#### `CssRuleAST`
Represents a CSS rule (selector + declarations).

```typescript
type CssRuleAST = {
  type: CssTypes.rule;
  selectors: string[];
  declarations: CssDeclarationAST[];
  position?: CssPosition;
  parent?: CssStylesheetAST;
};
```

#### `CssDeclarationAST`
Represents a CSS property declaration.

```typescript
type CssDeclarationAST = {
  type: CssTypes.declaration;
  property: string;
  value: string;
  position?: CssPosition;
  parent?: CssRuleAST;
};
```

#### `CssMediaAST`
Represents a CSS @media rule.

```typescript
type CssMediaAST = {
  type: CssTypes.media;
  media: string;
  rules: CssRuleAST[];
  position?: CssPosition;
  parent?: CssStylesheetAST;
};
```

#### `CssKeyframesAST`
Represents a CSS @keyframes rule.

```typescript
type CssKeyframesAST = {
  type: CssTypes.keyframes;
  name: string;
  keyframes: CssKeyframeAST[];
  position?: CssPosition;
  parent?: CssStylesheetAST;
};
```

#### `CssPosition`
Represents source position information.

```typescript
type CssPosition = {
  source?: string;
  start: {
    line: number;
    column: number;
    offset?: number; // Set when preserveFormatting is true
  };
  end: {
    line: number;
    column: number;
    offset?: number; // Set when preserveFormatting is true
  };
};
```

#### `CssParseError`
Represents a parsing error.

```typescript
type CssParseError = {
  message: string;
  reason: string;
  filename?: string;
  line: number;
  column: number;
  source?: string;
};
```

### Compiler Options

#### `CompilerOptions`
Options for the stringifier.

```typescript
type CompilerOptions = {
  indent?: string;          // Default: '  '
  compress?: boolean;       // Default: false
  identity?: boolean;       // Default: false
  removeEmptyRules?: boolean; // Default: false
};
```

## Error Handling

### Silent Parsing

When parsing malformed CSS, you can use the `silent` option to collect errors instead of throwing:

```javascript
import { parse } from '@adobe/css-tools';

const malformedCss = `
  body { color: red; }
  { color: blue; } /* Missing selector */
  .valid { background: green; }
`;

const result = parse(malformedCss, { silent: true });

if (result.stylesheet.parsingErrors) {
  result.stylesheet.parsingErrors.forEach(error => {
    console.log(`Error at line ${error.line}: ${error.message}`);
  });
}

// Valid rules are still parsed
console.log('Valid rules:', result.stylesheet.rules.length);
```

### Source Tracking

Enable source tracking for better error reporting:

```javascript
import { parse } from '@adobe/css-tools';

const css = 'body { color: red; }';
const ast = parse(css, { source: 'styles.css' });

const rule = ast.stylesheet.rules[0];
console.log(rule.position?.source); // "styles.css"
console.log(rule.position?.start);  // { line: 1, column: 1 }
console.log(rule.position?.end);    // { line: 1, column: 20 }
```

## Advanced Usage

### Working with At-Rules

```javascript
import { parse, stringify } from '@adobe/css-tools';

const css = `
  @media (max-width: 768px) {
    .container {
      padding: 10px;
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ast = parse(css);

// Access media rules
const mediaRule = ast.stylesheet.rules.find(rule => rule.type === 'media');
console.log(mediaRule.media); // "(max-width: 768px)"

// Access keyframes
const keyframesRule = ast.stylesheet.rules.find(rule => rule.type === 'keyframes');
console.log(keyframesRule.name); // "fadeIn"
```

### Custom Formatting

```javascript
import { parse, stringify } from '@adobe/css-tools';

const css = '.example{color:red;font-size:16px}';
const ast = parse(css);

// Custom indentation
const formatted = stringify(ast, { indent: '    ' });
console.log(formatted);
// Output:
// .example {
//     color: red;
//     font-size: 16px;
// }

// Compressed with no spaces
const compressed = stringify(ast, { compress: true });
console.log(compressed);
// Output: .example{color:red;font-size:16px}
```

### Identity Round-Trip

Reproduce the original CSS exactly as it was written, preserving all whitespace, comments, and formatting:

```javascript
import { parse, stringify } from '@adobe/css-tools';

const css = '.example  {  color:  red;  font-size:16px  }';

// Parse with preserveFormatting to store original source
const ast = parse(css, { preserveFormatting: true });

// Stringify with identity mode to reproduce the original CSS
const output = stringify(ast, { identity: true });
console.log(output === css); // true
```

When `preserveFormatting` was not used during parsing, identity mode falls back to beautified output.

### Removing Empty Rules

Strip rules with empty declaration blocks from the output:

```javascript
import { parse, stringify } from '@adobe/css-tools';

const css = '.empty {} .keep { color: red; }';
const ast = parse(css);

// Beautified without empty rules
const output = stringify(ast, { removeEmptyRules: true });
console.log(output);
// Output:
// .keep {
//   color: red;
// }

// Also works with compressed mode
const compressed = stringify(ast, { compress: true, removeEmptyRules: true });
console.log(compressed);
// Output: .keep{color:red;}
```

## TypeScript Integration

The library provides comprehensive TypeScript support with full type definitions for all AST nodes and functions:

```typescript
import { parse, stringify, type CssStylesheetAST } from '@adobe/css-tools';

const css: string = '.example { color: red; }';
const ast: CssStylesheetAST = parse(css);
const output: string = stringify(ast);
```

## Performance Considerations

- The parser is optimized for large CSS files
- AST nodes are lightweight and memory-efficient
- Stringification is fast and supports streaming for large outputs
- Consider using `compress: true` for production builds to reduce file size

## Browser Support

The library works in all modern browsers and Node.js environments. For older environments, you may need to use a bundler with appropriate polyfills.
