import CssParseError from '../CssParseError';
import Position from '../CssPosition';
import {
  type CssAtRuleAST,
  type CssCharsetAST,
  type CssCommentAST,
  type CssCommonPositionAST,
  type CssContainerAST,
  type CssCounterStyleAST,
  type CssCustomMediaAST,
  type CssDeclarationAST,
  type CssDocumentAST,
  type CssFontFaceAST,
  type CssFontFeatureValuesAST,
  type CssGenericAtRuleAST,
  type CssHostAST,
  type CssImportAST,
  type CssKeyframeAST,
  type CssKeyframesAST,
  type CssLayerAST,
  type CssMediaAST,
  type CssNamespaceAST,
  type CssPageAST,
  type CssPageMarginBoxAST,
  type CssPositionTryAST,
  type CssPropertyAST,
  type CssRuleAST,
  type CssScopeAST,
  type CssStartingStyleAST,
  type CssStylesheetAST,
  type CssSupportsAST,
  CssTypes,
  type CssViewTransitionAST,
} from '../type';
import {
  indexOfArrayWithBracketAndQuoteSupport,
  splitWithBracketAndQuoteSupport,
} from '../utils/stringSearch';
import { Ch_AT, Ch_CLOSE, Ch_SLASH, Ch_STAR, Lexer } from './lexer';

// http://www.w3.org/TR/CSS21/grammar.html
// https://github.com/visionmedia/css-parse/pull/49#issuecomment-30088027
// New rule => https://www.w3.org/TR/CSS22/syndata.html#comments
// [^] is equivalent to [.\n\r]
const commentRegex = /\/\*[^]*?(?:\*\/|$)/g;

// ─── Sticky regexes (y-flag) ────────────────────────────────────────────────
// Using sticky regexes matched against the full input string avoids
// creating a temporary substring on every `matchRegex` call.
const re_comment = /\/\*[^]*?\*\//y;
const re_propName = /(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/y;
const re_keyframeValue = /((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/y;
const re_keyframesName = /@([-\w]+)?keyframes\s*/y;
const re_identifier = /([-\w]+)\s*/y;
const re_supports = /@supports *([^{]+)/y;
const re_host = /@host\s*/y;
const re_container = /@container *([^{]+)/y;
const re_layer = /@layer *([^{;@]+)/y;
const re_media = /@media *([^{]+)/y;
const re_customMedia = /@custom-media\s+(--\S+)\s+([^{;\s][^{;]*);/y;
const re_page = /@page */y;
const re_document = /@([-\w]+)?document *([^{]+)/y;
const re_fontFace = /@font-face\s*/y;
const re_property = /@property\s+(--[-\w]+)\s*/y;
const re_counterStyle = /@counter-style\s+([-\w]+)\s*/y;
const re_fontFeatureValues = /@font-feature-values\s+([^{]+)/y;
const re_scope = /@scope\s*([^{]*)/y;
const re_viewTransition = /@view-transition\s*/y;
const re_positionTry = /@position-try\s+(--[-\w]+)\s*/y;
const re_startingStyle = /@starting-style\s*/y;
const re_genericAtRule = /@([-\w]+)\s*/y;

// Pre-compiled page margin box regex (moved to module scope to avoid re-creation)
const pageMarginBoxNames = [
  'top-left-corner',
  'top-left',
  'top-center',
  'top-right',
  'top-right-corner',
  'bottom-left-corner',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'bottom-right-corner',
  'left-top',
  'left-middle',
  'left-bottom',
  'right-top',
  'right-middle',
  'right-bottom',
];
const re_pageMarginBox = new RegExp(
  `@(${pageMarginBoxNames.join('|')})(?![\\w-])\\s*`,
  'y',
);

// Pre-compiled non-block at-rule regexes.
// NOTE: these patterns are inherited from the original _compileAtRule factory.
const re_atImport =
  /@import\s*((?::?[^;'"]|"(?:\\"|[^"])*?"|'(?:\\'|[^'])*?')+)(?:;|$)/y;
const re_atCharset =
  /@charset\s*((?::?[^;'"]|"(?:\\"|[^"])*?"|'(?:\\'|[^'])*?')+)(?:;|$)/y;
const re_atNamespace =
  /@namespace\s*((?::?[^;'"]|"(?:\\"|[^"])*?"|'(?:\\'|[^'])*?')+)(?:;|$)/y;

export const parse = (
  css: string,
  options?: { source?: string; silent?: boolean },
): CssStylesheetAST => {
  options = options || {};

  const lexer = new Lexer(css);

  /**
   * Mark position and patch `node.position`.
   */
  function position() {
    const start = lexer.getPosition();
    return <T1 extends CssCommonPositionAST>(
      node: Omit<T1, 'position'>,
    ): T1 => {
      (node as T1).position = new Position(
        start,
        lexer.getPosition(),
        options?.source || '',
      );
      lexer.skipWhitespace();
      return node as T1;
    };
  }

  /**
   * Error `msg`.
   */
  const errorsList: Array<CssParseError> = [];

  function error(msg: string): undefined {
    const err = new CssParseError(
      options?.source || '',
      msg,
      lexer.lineno,
      lexer.column,
      lexer.remaining,
    );

    if (options?.silent) {
      errorsList.push(err);
    } else {
      throw err;
    }
  }

  /**
   * Parse stylesheet.
   */
  function stylesheet(): CssStylesheetAST {
    const rulesList = rules();

    const result: CssStylesheetAST = {
      type: CssTypes.stylesheet,
      stylesheet: {
        source: options?.source,
        rules: rulesList,
        parsingErrors: errorsList,
      },
    };

    return result;
  }

  /**
   * Opening brace.
   */
  function open(): boolean {
    return lexer.tryOpenBrace();
  }

  /**
   * Closing brace.
   */
  function close(): boolean {
    return lexer.tryCloseBrace();
  }

  /**
   * Parse ruleset.
   */
  function rules() {
    let node: CssRuleAST | CssAtRuleAST | undefined;
    const rules: Array<CssRuleAST | CssAtRuleAST> = [];
    lexer.skipWhitespace();
    comments(rules);
    while (lexer.hasMore) {
      if (lexer.charCodeAt() === Ch_CLOSE) {
        if (options?.silent) {
          // Skip stray closing braces at top level
          error("extra '}'");
          lexer.consume(1);
          lexer.skipWhitespace();
          comments(rules);
          continue;
        }
        break;
      }
      node = atRule() || rule();
      if (node) {
        rules.push(node);
        comments(rules);
      } else {
        if (options?.silent) {
          // Skip unrecognized character to recover
          lexer.consume(1);
          lexer.skipWhitespace();
          comments(rules);
          continue;
        }
        break;
      }
    }
    return rules;
  }

  /**
   * Parse whitespace.
   */
  function whitespace() {
    lexer.skipWhitespace();
  }

  /**
   * Parse comments;
   */
  function comments<T1 extends CssCommonPositionAST>(
    rules?: Array<T1 | CssCommentAST>,
  ) {
    rules = rules || [];
    let c: CssCommentAST | undefined = comment();
    while (c) {
      rules.push(c);
      c = comment();
    }
    return rules;
  }

  /**
   * Parse comment.
   */
  function comment(): CssCommentAST | undefined {
    const pos = position();
    if (lexer.charCodeAt() !== Ch_SLASH || lexer.charCodeAt(1) !== Ch_STAR) {
      return;
    }

    const m = lexer.matchRegex(re_comment);
    if (!m) {
      return error('End of comment missing');
    }

    return pos<CssCommentAST>({
      type: CssTypes.comment,
      comment: m[0].slice(2, -2),
    });
  }

  /**
   * Parse selector.
   */
  function selector() {
    const bracePos = indexOfArrayWithBracketAndQuoteSupport(lexer.remaining, [
      '{',
    ]);
    if (bracePos === -1 || bracePos === 0) {
      return;
    }
    const selectorStr = lexer.consume(bracePos);

    // remove comment in selector;
    const res = trim(selectorStr).replace(commentRegex, '');

    return splitWithBracketAndQuoteSupport(res, [',']).map((v) => trim(v));
  }

  /**
   * Parse declaration.
   */
  function declaration(): CssDeclarationAST | undefined {
    const pos = position();

    // prop
    const propMatch = lexer.matchRegex(re_propName);
    if (!propMatch) {
      return;
    }
    const propValue = trim(propMatch[0]);

    // :
    if (!lexer.tryColon()) {
      return error("property missing ':'");
    }

    // val
    let value = '';
    const endValuePosition = indexOfArrayWithBracketAndQuoteSupport(
      lexer.remaining,
      [';', '}'],
    );
    if (endValuePosition !== -1) {
      value = lexer.consume(endValuePosition);
      value = trim(value).replace(commentRegex, '');
    }

    const ret = pos<CssDeclarationAST>({
      type: CssTypes.declaration,
      property: propValue.replace(commentRegex, ''),
      value: value,
    });

    // ;
    lexer.skipSemicolonAndWhitespace();

    return ret;
  }

  /**
   * Parse declarations (without nesting support).
   * Used by @font-face, @page, keyframes.
   */
  function declarations() {
    const decls: Array<CssDeclarationAST | CssCommentAST> = [];

    if (!open()) {
      return error("missing '{'");
    }
    comments(decls);

    // declarations
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      comments(decls);
      decl = declaration();
    }
    // In silent mode, try to recover from errors by skipping to next semicolon
    while (
      options?.silent &&
      lexer.hasMore &&
      lexer.charCodeAt() !== Ch_CLOSE
    ) {
      const remaining = lexer.remaining;
      const semiPos = remaining.indexOf(';');
      const bracePos = remaining.indexOf('}');
      if (semiPos !== -1 && (bracePos === -1 || semiPos < bracePos)) {
        lexer.consume(semiPos + 1);
        whitespace();
        comments(decls);
        decl = declaration();
        while (decl) {
          decls.push(decl);
          comments(decls);
          decl = declaration();
        }
      } else {
        break;
      }
    }

    if (!close()) {
      return error("missing '}'");
    }
    return decls;
  }

  /**
   * Check if the current position looks like a nested rule
   * ('{' appears before ';' and '}' at the top level).
   */
  function looksLikeNestedRule(): boolean {
    const remaining = lexer.remaining;
    const bracePos = indexOfArrayWithBracketAndQuoteSupport(remaining, ['{']);
    if (bracePos === -1) {
      return false;
    }
    const semiPos = indexOfArrayWithBracketAndQuoteSupport(remaining, [';']);
    const closePos = indexOfArrayWithBracketAndQuoteSupport(remaining, ['}']);

    if (semiPos !== -1 && semiPos < bracePos) {
      return false;
    }
    if (closePos !== -1 && closePos < bracePos) {
      return false;
    }
    return true;
  }

  /**
   * Parse rule body with CSS nesting support.
   * Handles declarations, comments, nested rules, and nested at-rules.
   */
  function ruleBody():
    | Array<CssDeclarationAST | CssCommentAST | CssAtRuleAST>
    | undefined {
    const items: Array<CssDeclarationAST | CssCommentAST | CssAtRuleAST> = [];

    if (!open()) {
      return error("missing '{'");
    }
    comments(items);

    while (lexer.hasMore && lexer.charCodeAt() !== Ch_CLOSE) {
      // nested at-rule
      if (lexer.charCodeAt() === Ch_AT) {
        const ar = atRule();
        if (ar) {
          items.push(ar);
          comments(items);
          continue;
        }
      }

      // nested rule ('{' comes before ';' and '}')
      if (looksLikeNestedRule()) {
        const nestedR = rule();
        if (nestedR) {
          items.push(nestedR);
          comments(items);
          continue;
        }
      }

      // declaration
      const decl = declaration();
      if (decl) {
        items.push(decl);
        comments(items);
        continue;
      }

      // nothing matched — skip to next semicolon or closing brace to recover
      if (options?.silent) {
        const remaining = lexer.remaining;
        const semiPos = remaining.indexOf(';');
        const bracePos = remaining.indexOf('}');
        if (semiPos !== -1 && (bracePos === -1 || semiPos < bracePos)) {
          lexer.consume(semiPos + 1);
          whitespace();
          comments(items);
          continue;
        }
      }
      break;
    }

    if (!close()) {
      return error("missing '}'");
    }
    return items;
  }

  /**
   * Parse rules, declarations, and nested rules.
   * Used by block at-rules (media, supports, etc.) to support
   * both top-level rules and declarations when nested inside a rule.
   */
  function rulesOrDeclarations() {
    const items: Array<CssAtRuleAST | CssDeclarationAST | CssCommentAST> = [];
    whitespace();
    comments(items);
    while (lexer.hasMore && lexer.charCodeAt() !== Ch_CLOSE) {
      // at-rule
      if (lexer.charCodeAt() === Ch_AT) {
        const ar = atRule();
        if (ar) {
          items.push(ar);
          comments(items);
          continue;
        }
      }

      // nested rule ('{' comes before ';' and '}')
      if (looksLikeNestedRule()) {
        const r = rule();
        if (r) {
          items.push(r);
          comments(items);
          continue;
        }
      }

      // declaration
      const decl = declaration();
      if (decl) {
        items.push(decl);
        comments(items);
        continue;
      }

      // nothing matched — skip to next semicolon or closing brace to recover
      if (options?.silent) {
        const remaining = lexer.remaining;
        const semiPos = remaining.indexOf(';');
        const bracePos = remaining.indexOf('}');
        if (semiPos !== -1 && (bracePos === -1 || semiPos < bracePos)) {
          lexer.consume(semiPos + 1);
          whitespace();
          comments(items);
          continue;
        }
      }
      break;
    }
    return items;
  }

  /**
   * Parse keyframe.
   */
  function keyframe() {
    const vals = [];
    const pos = position();

    let m = lexer.matchRegex(re_keyframeValue);
    while (m) {
      vals.push(m[1]);
      lexer.tryCommaAndWhitespace();
      m = lexer.matchRegex(re_keyframeValue);
    }

    if (!vals.length) {
      return;
    }

    return pos<CssKeyframeAST>({
      type: CssTypes.keyframe,
      values: vals,
      declarations: declarations() || [],
    });
  }

  /**
   * Parse keyframes.
   */
  function atKeyframes(): CssKeyframesAST | undefined {
    const pos = position();
    const m1 = lexer.matchRegex(re_keyframesName);

    if (!m1) {
      return;
    }
    const vendor = m1[1];

    // identifier
    const m2 = lexer.matchRegex(re_identifier);
    if (!m2) {
      return error('@keyframes missing name');
    }
    const name = m2[1];

    if (!open()) {
      return error("@keyframes missing '{'");
    }

    let frames: Array<CssKeyframeAST | CssCommentAST> = comments();
    let frame: CssKeyframeAST | undefined = keyframe();
    while (frame) {
      frames.push(frame);
      frames = frames.concat(comments());
      frame = keyframe();
    }

    if (!close()) {
      return error("@keyframes missing '}'");
    }

    return pos<CssKeyframesAST>({
      type: CssTypes.keyframes,
      name: name,
      vendor: vendor,
      keyframes: frames,
    });
  }

  /**
   * Parse supports.
   */
  function atSupports(): CssSupportsAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_supports);

    if (!m) {
      return;
    }
    const supports = trim(m[1]);

    if (!open()) {
      return error("@supports missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@supports missing '}'");
    }

    return pos<CssSupportsAST>({
      type: CssTypes.supports,
      supports: supports,
      rules: style,
    });
  }

  /**
   * Parse host.
   */
  function atHost() {
    const pos = position();
    const m = lexer.matchRegex(re_host);

    if (!m) {
      return;
    }

    if (!open()) {
      return error("@host missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@host missing '}'");
    }

    return pos<CssHostAST>({
      type: CssTypes.host,
      rules: style,
    });
  }

  /**
   * Parse container.
   */
  function atContainer(): CssContainerAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_container);

    if (!m) {
      return;
    }
    const container = trim(m[1]);

    if (!open()) {
      return error("@container missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@container missing '}'");
    }

    return pos<CssContainerAST>({
      type: CssTypes.container,
      container: container,
      rules: style,
    });
  }

  /**
   * Parse layer.
   */
  function atLayer(): CssLayerAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_layer);

    if (!m) {
      return;
    }
    const layer = trim(m[1]);

    if (!open()) {
      lexer.skipSemicolonAndWhitespace();
      return pos<CssLayerAST>({
        type: CssTypes.layer,
        layer: layer,
      });
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@layer missing '}'");
    }

    return pos<CssLayerAST>({
      type: CssTypes.layer,
      layer: layer,
      rules: style,
    });
  }

  /**
   * Parse media.
   */
  function atMedia(): CssMediaAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_media);

    if (!m) {
      return;
    }
    const media = trim(m[1]);

    if (!open()) {
      return error("@media missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@media missing '}'");
    }

    return pos<CssMediaAST>({
      type: CssTypes.media,
      media: media,
      rules: style,
    });
  }

  /**
   * Parse custom-media.
   */
  function atCustomMedia(): CssCustomMediaAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_customMedia);
    if (!m) {
      return;
    }

    return pos<CssCustomMediaAST>({
      type: CssTypes.customMedia,
      name: trim(m[1]),
      media: trim(m[2]),
    });
  }

  /**
   * Parse @page margin box at-rules (@top-left, @bottom-right, @left-middle, etc.).
   */
  function atPageMarginBox(): CssPageMarginBoxAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_pageMarginBox);
    if (!m) {
      return;
    }
    const name = m[1];

    if (!open()) {
      return error(`@${name} missing '{'`);
    }
    let decls = comments<CssDeclarationAST>();
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }
    if (!close()) {
      return error(`@${name} missing '}'`);
    }

    return pos<CssPageMarginBoxAST>({
      type: CssTypes.pageMarginBox,
      name: name,
      declarations: decls,
    });
  }

  /**
   * Parse paged media.
   */
  function atPage(): CssPageAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_page);
    if (!m) {
      return;
    }

    const sel = selector() || [];

    if (!open()) {
      return error("@page missing '{'");
    }
    const decls: Array<CssDeclarationAST | CssCommentAST | CssAtRuleAST> = [];
    comments(decls);

    // declarations and nested at-rules (margin boxes)
    while (lexer.hasMore && lexer.charCodeAt() !== Ch_CLOSE) {
      if (lexer.charCodeAt() === Ch_AT) {
        const ar = atRule();
        if (ar) {
          decls.push(ar);
          comments(decls);
          continue;
        }
      }
      const decl = declaration();
      if (decl) {
        decls.push(decl);
        comments(decls);
        continue;
      }
      break;
    }

    if (!close()) {
      return error("@page missing '}'");
    }

    return pos<CssPageAST>({
      type: CssTypes.page,
      selectors: sel,
      declarations: decls,
    });
  }

  /**
   * Parse document.
   */
  function atDocument(): CssDocumentAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_document);
    if (!m) {
      return;
    }

    const vendor = trim(m[1]);
    const doc = trim(m[2]);

    if (!open()) {
      return error("@document missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@document missing '}'");
    }

    return pos<CssDocumentAST>({
      type: CssTypes.document,
      document: doc,
      vendor: vendor,
      rules: style,
    });
  }

  /**
   * Parse font-face.
   */
  function atFontFace(): CssFontFaceAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_fontFace);
    if (!m) {
      return;
    }

    if (!open()) {
      return error("@font-face missing '{'");
    }
    let decls = comments<CssDeclarationAST>();

    // declarations
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }

    if (!close()) {
      return error("@font-face missing '}'");
    }

    return pos<CssFontFaceAST>({
      type: CssTypes.fontFace,
      declarations: decls,
    });
  }

  /**
   * Parse @property.
   */
  function atProperty(): CssPropertyAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_property);
    if (!m) {
      return;
    }
    const name = m[1];

    if (!open()) {
      return error("@property missing '{'");
    }
    let decls = comments<CssDeclarationAST>();
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }
    if (!close()) {
      return error("@property missing '}'");
    }

    return pos<CssPropertyAST>({
      type: CssTypes.property,
      name: name,
      declarations: decls,
    });
  }

  /**
   * Parse @counter-style.
   */
  function atCounterStyle(): CssCounterStyleAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_counterStyle);
    if (!m) {
      return;
    }
    const name = m[1];

    if (!open()) {
      return error("@counter-style missing '{'");
    }
    let decls = comments<CssDeclarationAST>();
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }
    if (!close()) {
      return error("@counter-style missing '}'");
    }

    return pos<CssCounterStyleAST>({
      type: CssTypes.counterStyle,
      name: name,
      declarations: decls,
    });
  }

  /**
   * Parse @font-feature-values.
   */
  function atFontFeatureValues(): CssFontFeatureValuesAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_fontFeatureValues);
    if (!m) {
      return;
    }
    const fontFamily = trim(m[1]);

    if (!open()) {
      return error("@font-feature-values missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@font-feature-values missing '}'");
    }

    return pos<CssFontFeatureValuesAST>({
      type: CssTypes.fontFeatureValues,
      fontFamily: fontFamily,
      rules: style,
    });
  }

  /**
   * Parse @scope.
   */
  function atScope(): CssScopeAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_scope);
    if (!m) {
      return;
    }
    const scope = trim(m[1]);

    if (!open()) {
      return error("@scope missing '{'");
    }

    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@scope missing '}'");
    }

    return pos<CssScopeAST>({
      type: CssTypes.scope,
      scope: scope,
      rules: style,
    });
  }

  /**
   * Parse @view-transition.
   */
  function atViewTransition(): CssViewTransitionAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_viewTransition);
    if (!m) {
      return;
    }

    if (!open()) {
      return error("@view-transition missing '{'");
    }
    let decls = comments<CssDeclarationAST>();
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }
    if (!close()) {
      return error("@view-transition missing '}'");
    }

    return pos<CssViewTransitionAST>({
      type: CssTypes.viewTransition,
      declarations: decls,
    });
  }

  /**
   * Parse @position-try.
   */
  function atPositionTry(): CssPositionTryAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_positionTry);
    if (!m) {
      return;
    }
    const name = m[1];

    if (!open()) {
      return error("@position-try missing '{'");
    }
    let decls = comments<CssDeclarationAST>();
    let decl: CssDeclarationAST | undefined = declaration();
    while (decl) {
      decls.push(decl);
      decls = decls.concat(comments());
      decl = declaration();
    }
    if (!close()) {
      return error("@position-try missing '}'");
    }

    return pos<CssPositionTryAST>({
      type: CssTypes.positionTry,
      name: name,
      declarations: decls,
    });
  }

  /**
   * Parse starting style.
   */
  function atStartingStyle(): CssStartingStyleAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_startingStyle);
    if (!m) {
      return;
    }

    if (!open()) {
      return error("@starting-style missing '{'");
    }
    const style = rulesOrDeclarations();

    if (!close()) {
      return error("@starting-style missing '}'");
    }

    return pos<CssStartingStyleAST>({
      type: CssTypes.startingStyle,
      rules: style,
    });
  }

  /**
   * Parse import
   */
  function atImport(): CssImportAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_atImport);
    if (!m) {
      return;
    }
    return pos<CssImportAST>({
      type: CssTypes.import,
      import: m[1].trim(),
    } as unknown as CssImportAST) as CssImportAST;
  }

  /**
   * Parse charset
   */
  function atCharset(): CssCharsetAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_atCharset);
    if (!m) {
      return;
    }
    return pos<CssCharsetAST>({
      type: CssTypes.charset,
      charset: m[1].trim(),
    } as unknown as CssCharsetAST) as CssCharsetAST;
  }

  /**
   * Parse namespace
   */
  function atNamespace(): CssNamespaceAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_atNamespace);
    if (!m) {
      return;
    }
    return pos<CssNamespaceAST>({
      type: CssTypes.namespace,
      namespace: m[1].trim(),
    } as unknown as CssNamespaceAST) as CssNamespaceAST;
  }

  /**
   * Parse generic/unknown at-rule (fallback for any unrecognized at-rule).
   * Handles both block at-rules (@scope { ... }) and statement at-rules (@foo ...;).
   */
  function atGeneric(): CssGenericAtRuleAST | undefined {
    const pos = position();
    const m = lexer.matchRegex(re_genericAtRule);
    if (!m) {
      return;
    }
    const name = m[1];

    // Capture prelude (everything between the name and '{' or ';')
    let prelude = '';
    const preludeEnd = indexOfArrayWithBracketAndQuoteSupport(lexer.remaining, [
      '{',
      ';',
    ]);
    if (preludeEnd !== -1 && preludeEnd > 0) {
      prelude = trim(lexer.consume(preludeEnd));
    }

    // Block at-rule
    if (open()) {
      const style = rulesOrDeclarations();

      if (!close()) {
        return error(`@${name} missing '}'`);
      }

      return pos<CssGenericAtRuleAST>({
        type: CssTypes.atRule,
        name: name,
        prelude: prelude,
        rules: style,
      });
    }

    // Statement at-rule (ends with ';')
    lexer.skipSemicolonAndWhitespace();

    return pos<CssGenericAtRuleAST>({
      type: CssTypes.atRule,
      name: name,
      prelude: prelude,
    });
  }

  /**
   * Parse at rule.
   */
  function atRule(): CssAtRuleAST | undefined {
    if (lexer.charCodeAt() !== Ch_AT) {
      return;
    }

    return (
      atKeyframes() ||
      atMedia() ||
      atCustomMedia() ||
      atSupports() ||
      atImport() ||
      atCharset() ||
      atNamespace() ||
      atDocument() ||
      atPage() ||
      atHost() ||
      atFontFace() ||
      atFontFeatureValues() ||
      atContainer() ||
      atStartingStyle() ||
      atLayer() ||
      atProperty() ||
      atCounterStyle() ||
      atScope() ||
      atViewTransition() ||
      atPositionTry() ||
      atPageMarginBox() ||
      atGeneric()
    );
  }

  /**
   * Parse rule.
   */
  function rule() {
    const pos = position();
    const sel = selector();

    if (!sel) {
      return error('selector missing');
    }
    comments();

    return pos<CssRuleAST>({
      type: CssTypes.rule,
      selectors: sel,
      declarations: ruleBody() || [],
    });
  }

  return addParent(stylesheet());
};

/**
 * Trim `str`.
 */
function trim(str: string) {
  return str ? str.trim() : '';
}

/**
 * Adds non-enumerable parent node reference to each node.
 */
function addParent<T1 extends { type?: string }>(
  obj: T1,
  parent?: unknown,
): T1 {
  const isNode = obj && typeof obj.type === 'string';
  const childParent = isNode ? obj : parent;

  for (const k in obj) {
    const value = obj[k];
    if (Array.isArray(value)) {
      value.forEach((v) => {
        addParent(v, childParent);
      });
    } else if (value && typeof value === 'object') {
      addParent(value, childParent);
    }
  }

  if (isNode) {
    Object.defineProperty(obj, 'parent', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: parent || null,
    });
  }

  return obj;
}

export default parse;
