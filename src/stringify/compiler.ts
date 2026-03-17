import {
  type CssAllNodesAST,
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
  type CssWhitespaceAST,
} from '../type';

export type CompilerOptions = {
  indent?: string;
  compress?: boolean;
  identity?: boolean;
  removeEmptyRules?: boolean;
};

class Compiler {
  level = 0;
  indentation = '  ';
  compress = false;
  identity = false;
  removeEmptyRules = false;

  constructor(options?: CompilerOptions) {
    if (typeof options?.indent === 'string') {
      this.indentation = options?.indent;
    }
    if (options?.compress) {
      this.compress = true;
    }
    if (options?.identity) {
      this.identity = true;
    }
    if (options?.removeEmptyRules) {
      this.removeEmptyRules = true;
    }
  }

  // We disable no-unused-vars for _position. We keep position for potential reintroduction of source-map
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  emit(str: string, _position?: CssCommonPositionAST['position']) {
    return str;
  }

  /**
   * Increase, decrease or return current indentation.
   */
  indent(level?: number) {
    this.level = this.level || 1;

    if (level) {
      this.level += level;
      return '';
    }

    return this.level > 1 ? this.indentation.repeat(this.level - 1) : '';
  }

  visit(node: CssAllNodesAST): string {
    switch (node.type) {
      case CssTypes.stylesheet:
        return this.stylesheet(node);
      case CssTypes.rule:
        return this.rule(node);
      case CssTypes.declaration:
        return this.declaration(node);
      case CssTypes.comment:
        return this.comment(node);
      case CssTypes.whitespace:
        return this.whitespace(node);
      case CssTypes.container:
        return this.container(node);
      case CssTypes.charset:
        return this.charset(node);
      case CssTypes.counterStyle:
        return this.counterStyle(node);
      case CssTypes.document:
        return this.document(node);
      case CssTypes.customMedia:
        return this.customMedia(node);
      case CssTypes.fontFace:
        return this.fontFace(node);
      case CssTypes.fontFeatureValues:
        return this.fontFeatureValues(node);
      case CssTypes.host:
        return this.host(node);
      case CssTypes.import:
        return this.import(node);
      case CssTypes.keyframes:
        return this.keyframes(node);
      case CssTypes.keyframe:
        return this.keyframe(node);
      case CssTypes.layer:
        return this.layer(node);
      case CssTypes.media:
        return this.media(node);
      case CssTypes.namespace:
        return this.namespace(node);
      case CssTypes.page:
        return this.page(node);
      case CssTypes.pageMarginBox:
        return this.pageMarginBox(node);
      case CssTypes.positionTry:
        return this.positionTry(node);
      case CssTypes.property:
        return this.property(node);
      case CssTypes.scope:
        return this.scope(node);
      case CssTypes.startingStyle:
        return this.startingStyle(node);
      case CssTypes.supports:
        return this.supports(node);
      case CssTypes.viewTransition:
        return this.viewTransition(node);
      case CssTypes.atRule:
        return this.genericAtRule(node);
    }
  }

  mapVisit(nodes: Array<CssAllNodesAST>, delim?: string) {
    let buf = '';
    delim = delim || '';

    for (let i = 0, length = nodes.length; i < length; i++) {
      const str = this.visit(nodes[i]);
      if (str) {
        if (delim && buf) {
          buf += this.emit(delim);
        }
        buf += str;
      }
    }

    return buf;
  }

  /**
   * Emit a block at-rule that contains nested rules (e.g. @media, @supports, @container).
   */
  private rulesBlock(
    header: string,
    rules: Array<CssAllNodesAST>,
    position?: CssCommonPositionAST['position'],
    rawPrelude?: string,
  ) {
    if (this.identity && rawPrelude) {
      return (
        this.emit(rawPrelude, position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(rules)) +
        this.emit('}')
      );
    }
    const filteredRules = this.filterEmptyRules(this.stripWhitespace(rules));
    if (this.compress) {
      return (
        this.emit(header, position) +
        this.emit('{') +
        this.mapVisit(filteredRules) +
        this.emit('}')
      );
    }
    return (
      this.emit(`${this.indent()}${header}`, position) +
      this.emit(` {\n${this.indent(1)}`) +
      this.mapVisit(filteredRules, '\n\n') +
      this.emit(`\n${this.indent(-1)}${this.indent()}}`)
    );
  }

  /**
   * Emit a block at-rule that contains declarations (e.g. @font-face, @property).
   */
  private declsBlock(
    header: string,
    declarations: Array<CssAllNodesAST>,
    position?: CssCommonPositionAST['position'],
    rawPrelude?: string,
  ) {
    if (this.identity && rawPrelude) {
      return (
        this.emit(rawPrelude, position) +
        this.emit('{') +
        this.mapVisit(declarations) +
        this.emit('}')
      );
    }
    const stripped = this.stripWhitespace(declarations);
    if (this.compress) {
      return (
        this.emit(header, position) +
        this.emit('{') +
        this.mapVisit(stripped) +
        this.emit('}')
      );
    }
    return (
      this.emit(`${header} `, position) +
      this.emit('{\n') +
      this.emit(this.indent(1)) +
      this.mapVisit(stripped, '\n') +
      this.emit(this.indent(-1)) +
      this.emit('\n}')
    );
  }

  compile(node: CssStylesheetAST) {
    if (this.identity) {
      return this.identityCompile(node);
    }
    if (this.compress) {
      return this.filterEmptyRules(this.stripWhitespace(node.stylesheet.rules))
        .map(this.visit, this)
        .join('');
    }

    return this.stylesheet(node);
  }

  /**
   * Identity mode: walk the AST including whitespace nodes.
   * Falls back to beautified output when whitespace nodes are not available.
   */
  private identityCompile(node: CssStylesheetAST): string {
    const rules = node.stylesheet.rules;
    const hasWhitespace = rules.some((r) => r.type === CssTypes.whitespace);
    if (!hasWhitespace) {
      // Fallback to beautified when preserveFormatting was not used
      return this.stylesheet(node);
    }
    return this.filterEmptyRules(rules).map(this.visit, this).join('');
  }

  /**
   * Visit stylesheet node.
   */
  stylesheet(node: CssStylesheetAST) {
    return this.mapVisit(
      this.filterEmptyRules(this.stripWhitespace(node.stylesheet.rules)),
      '\n\n',
    );
  }

  /**
   * Strip whitespace nodes from an array (used in beautified/compressed modes).
   */
  private stripWhitespace<T extends CssAllNodesAST>(nodes: Array<T>): Array<T> {
    return nodes.filter((n) => n.type !== CssTypes.whitespace);
  }

  /**
   * Filter out empty rules when removeEmptyRules is enabled.
   */
  private filterEmptyRules<T extends CssAllNodesAST>(
    rules: Array<T>,
  ): Array<T> {
    if (!this.removeEmptyRules) {
      return rules;
    }
    return rules.filter((rule) => {
      if (rule.type === CssTypes.rule) {
        const decls = (rule as CssRuleAST).declarations.filter(
          (d) => d.type !== CssTypes.whitespace,
        );
        return decls.length > 0;
      }
      return true;
    });
  }

  /**
   * Visit whitespace node.
   */
  whitespace(node: CssWhitespaceAST) {
    if (this.identity) {
      return this.emit(node.value);
    }
    // In beautified/compressed mode, whitespace nodes are stripped before visiting
    return '';
  }

  /**
   * Visit comment node.
   */
  comment(node: CssCommentAST) {
    if (this.compress) {
      return this.emit('', node.position);
    }
    return this.emit(`${this.indent()}/*${node.comment}*/`, node.position);
  }

  /**
   * Visit container node.
   */
  container(node: CssContainerAST) {
    return this.rulesBlock(
      `@container ${node.container}`,
      node.rules,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit container node.
   */
  layer(node: CssLayerAST) {
    if (this.identity && node.rawPrelude && node.rules) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(<CssAllNodesAST[]>node.rules)) +
        this.emit('}')
      );
    }
    if (this.identity && !node.rules && (node as any).rawSource) {
      return this.emit((node as any).rawSource, node.position);
    }
    const rules = node.rules
      ? this.stripWhitespace(<CssAllNodesAST[]>node.rules)
      : undefined;
    if (this.compress) {
      return (
        this.emit(`@layer ${node.layer}`, node.position) +
        (rules ? this.emit('{') + this.mapVisit(rules) + this.emit('}') : ';')
      );
    }
    return (
      this.emit(`${this.indent()}@layer ${node.layer}`, node.position) +
      (rules
        ? this.emit(` {\n${this.indent(1)}`) +
          this.mapVisit(rules, '\n\n') +
          this.emit(`\n${this.indent(-1)}${this.indent()}}`)
        : ';')
    );
  }

  /**
   * Visit import node.
   */
  import(node: CssImportAST) {
    if (this.identity && (node as any).rawSource) {
      return this.emit((node as any).rawSource, node.position);
    }
    return this.emit(`@import ${node.import};`, node.position);
  }

  /**
   * Visit media node.
   */
  media(node: CssMediaAST) {
    return this.rulesBlock(
      `@media ${node.media}`,
      node.rules,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit document node.
   */
  document(node: CssDocumentAST) {
    const doc = `@${node.vendor || ''}document ${node.document}`;
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(node.rules)) +
        this.emit('}')
      );
    }
    const rules = this.stripWhitespace(node.rules);
    if (this.compress) {
      return (
        this.emit(doc, node.position) +
        this.emit('{') +
        this.mapVisit(rules) +
        this.emit('}')
      );
    }
    return (
      this.emit(doc, node.position) +
      this.emit(`  {\n${this.indent(1)}`) +
      this.mapVisit(rules, '\n\n') +
      this.emit(`${this.indent(-1)}\n}`)
    );
  }

  /**
   * Visit charset node.
   */
  charset(node: CssCharsetAST) {
    if (this.identity && (node as any).rawSource) {
      return this.emit((node as any).rawSource, node.position);
    }
    return this.emit(`@charset ${node.charset};`, node.position);
  }

  /**
   * Visit namespace node.
   */
  namespace(node: CssNamespaceAST) {
    if (this.identity && (node as any).rawSource) {
      return this.emit((node as any).rawSource, node.position);
    }
    return this.emit(`@namespace ${node.namespace};`, node.position);
  }

  /**
   * Visit starting-style node.
   */
  startingStyle(node: CssStartingStyleAST) {
    return this.rulesBlock(
      '@starting-style',
      node.rules,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit supports node.
   */
  supports(node: CssSupportsAST) {
    return this.rulesBlock(
      `@supports ${node.supports}`,
      node.rules,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit keyframes node.
   */
  keyframes(node: CssKeyframesAST) {
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(node.keyframes) +
        this.emit('}')
      );
    }
    const frames = this.stripWhitespace(node.keyframes);
    if (this.compress) {
      return (
        this.emit(
          `@${node.vendor || ''}keyframes ${node.name}`,
          node.position,
        ) +
        this.emit('{') +
        this.mapVisit(frames) +
        this.emit('}')
      );
    }
    return (
      this.emit(`@${node.vendor || ''}keyframes ${node.name}`, node.position) +
      this.emit(` {\n${this.indent(1)}`) +
      this.mapVisit(frames, '\n') +
      this.emit(`${this.indent(-1)}}`)
    );
  }

  /**
   * Visit keyframe node.
   */
  keyframe(node: CssKeyframeAST) {
    const decls = node.declarations;
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(decls) +
        this.emit('}')
      );
    }
    const stripped = this.stripWhitespace(decls);
    if (this.compress) {
      return (
        this.emit(node.values.join(','), node.position) +
        this.emit('{') +
        this.mapVisit(stripped) +
        this.emit('}')
      );
    }

    return (
      this.emit(this.indent()) +
      this.emit(node.values.join(', '), node.position) +
      this.emit(` {\n${this.indent(1)}`) +
      this.mapVisit(stripped, '\n') +
      this.emit(`${this.indent(-1)}\n${this.indent()}}\n`)
    );
  }

  /**
   * Visit page node.
   */
  page(node: CssPageAST) {
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(node.declarations) +
        this.emit('}')
      );
    }
    const decls = this.stripWhitespace(node.declarations);
    if (this.compress) {
      const sel = node.selectors.length ? node.selectors.join(', ') : '';

      return (
        this.emit(`@page ${sel}`, node.position) +
        this.emit('{') +
        this.mapVisit(decls) +
        this.emit('}')
      );
    }
    const sel = node.selectors.length ? `${node.selectors.join(', ')} ` : '';

    return (
      this.emit(`@page ${sel}`, node.position) +
      this.emit('{\n') +
      this.emit(this.indent(1)) +
      this.mapVisit(decls, '\n') +
      this.emit(this.indent(-1)) +
      this.emit('\n}')
    );
  }

  /**
   * Visit @page margin box node (@top-left, @bottom-right, etc.).
   */
  pageMarginBox(node: CssPageMarginBoxAST) {
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(node.declarations) +
        this.emit('}')
      );
    }
    const decls = this.stripWhitespace(node.declarations);
    if (this.compress) {
      return (
        this.emit(`@${node.name}`, node.position) +
        this.emit('{') +
        this.mapVisit(decls) +
        this.emit('}')
      );
    }
    return (
      this.emit(`${this.indent()}@${node.name} `, node.position) +
      this.emit('{\n') +
      this.emit(this.indent(1)) +
      this.mapVisit(decls, '\n') +
      this.emit(this.indent(-1)) +
      this.emit(`\n${this.indent()}}`)
    );
  }

  /**
   * Visit font-face node.
   */
  fontFace(node: CssFontFaceAST) {
    return this.declsBlock(
      '@font-face',
      node.declarations,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit host node.
   */
  host(node: CssHostAST) {
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(node.rules)) +
        this.emit('}')
      );
    }
    const rules = this.stripWhitespace(node.rules);
    if (this.compress) {
      return (
        this.emit('@host', node.position) +
        this.emit('{') +
        this.mapVisit(rules) +
        this.emit('}')
      );
    }
    return (
      this.emit('@host', node.position) +
      this.emit(` {\n${this.indent(1)}`) +
      this.mapVisit(rules, '\n\n') +
      this.emit(`${this.indent(-1)}\n}`)
    );
  }

  /**
   * Visit custom-media node.
   */
  customMedia(node: CssCustomMediaAST) {
    if (this.identity && (node as any).rawSource) {
      return this.emit((node as any).rawSource, node.position);
    }
    return this.emit(
      `@custom-media ${node.name} ${node.media};`,
      node.position,
    );
  }

  /**
   * Visit @property node.
   */
  property(node: CssPropertyAST) {
    return this.declsBlock(
      `@property ${node.name}`,
      node.declarations,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit @counter-style node.
   */
  counterStyle(node: CssCounterStyleAST) {
    return this.declsBlock(
      `@counter-style ${node.name}`,
      node.declarations,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit @font-feature-values node.
   */
  fontFeatureValues(node: CssFontFeatureValuesAST) {
    return this.rulesBlock(
      `@font-feature-values ${node.fontFamily}`,
      node.rules,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit @scope node.
   */
  scope(node: CssScopeAST) {
    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(node.rules)) +
        this.emit('}')
      );
    }
    const prelude = node.scope ? ` ${node.scope}` : '';
    return this.rulesBlock(
      `@scope${prelude}`,
      this.stripWhitespace(node.rules),
      node.position,
    );
  }

  /**
   * Visit @view-transition node.
   */
  viewTransition(node: CssViewTransitionAST) {
    return this.declsBlock(
      '@view-transition',
      node.declarations,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit @position-try node.
   */
  positionTry(node: CssPositionTryAST) {
    return this.declsBlock(
      `@position-try ${node.name}`,
      node.declarations,
      node.position,
      node.rawPrelude,
    );
  }

  /**
   * Visit generic at-rule node (fallback for any unrecognized at-rule).
   */
  genericAtRule(node: CssGenericAtRuleAST) {
    if (this.identity && node.rawPrelude && node.rules) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(this.filterEmptyRules(<CssAllNodesAST[]>node.rules)) +
        this.emit('}')
      );
    }
    const prelude = node.prelude ? ` ${node.prelude}` : '';
    const rules = node.rules
      ? this.stripWhitespace(<CssAllNodesAST[]>node.rules)
      : undefined;
    if (this.compress) {
      return (
        this.emit(`@${node.name}${prelude}`, node.position) +
        (rules ? this.emit('{') + this.mapVisit(rules) + this.emit('}') : ';')
      );
    }
    if (!rules) {
      return this.emit(
        `${this.indent()}@${node.name}${prelude};`,
        node.position,
      );
    }
    const hasNestedRules = rules.some(
      (r) => r.type !== CssTypes.declaration && r.type !== CssTypes.comment,
    );
    const delim = hasNestedRules ? '\n\n' : '\n';
    return (
      this.emit(`${this.indent()}@${node.name}${prelude}`, node.position) +
      this.emit(hasNestedRules ? ` {\n${this.indent(1)}` : ' {\n') +
      this.emit(hasNestedRules ? '' : this.indent(1)) +
      this.mapVisit(rules, delim) +
      this.emit(
        hasNestedRules
          ? `\n${this.indent(-1)}${this.indent()}}`
          : `${this.indent(-1)}\n${this.indent()}}`,
      )
    );
  }

  /**
   * Visit rule node.
   */
  rule(node: CssRuleAST) {
    const decls = node.declarations;

    if (this.identity && node.rawPrelude) {
      return (
        this.emit(node.rawPrelude, node.position) +
        this.emit('{') +
        this.mapVisit(decls) +
        this.emit('}')
      );
    }

    const stripped = this.stripWhitespace(decls);

    if (this.compress) {
      if (this.removeEmptyRules && !stripped.length) {
        return '';
      }
      return (
        this.emit(node.selectors.join(','), node.position) +
        this.emit('{') +
        this.mapVisit(stripped) +
        this.emit('}')
      );
    }
    const indent = this.indent();

    if (!stripped.length) {
      if (this.removeEmptyRules) {
        return '';
      }
      return (
        this.emit(
          node.selectors
            .map((s) => {
              return indent + s;
            })
            .join(',\n'),
          node.position,
        ) + this.emit(' {}')
      );
    }

    return (
      this.emit(
        node.selectors
          .map((s) => {
            return indent + s;
          })
          .join(',\n'),
        node.position,
      ) +
      this.emit(' {\n') +
      this.emit(this.indent(1)) +
      this.mapVisit(stripped, '\n') +
      this.emit(this.indent(-1)) +
      this.emit(`\n${this.indent()}}`)
    );
  }

  /**
   * Visit declaration node.
   */
  declaration(node: CssDeclarationAST) {
    if (this.identity && node.rawBetween != null) {
      return this.emit(
        `${node.property}${node.rawBetween}${node.rawValue ?? node.value}`,
        node.position,
      );
    }
    if (this.compress) {
      return (
        this.emit(`${node.property}:${node.value}`, node.position) +
        this.emit(';')
      );
    }
    if (node.property === 'grid-template-areas') {
      const indent = this.indent();
      const pad = indent.length + node.property.length + 2; // 2 for ": "
      const parts = node.value.split('\n');
      const aligned = parts
        .map((p, i) => (i === 0 ? p : ' '.repeat(pad) + p.trimStart()))
        .join('\n');
      return (
        this.emit(indent) +
        this.emit(`${node.property}: ${aligned}`, node.position) +
        this.emit(';')
      );
    }
    return (
      this.emit(this.indent()) +
      this.emit(`${node.property}: ${node.value}`, node.position) +
      this.emit(';')
    );
  }
}

export default Compiler;
