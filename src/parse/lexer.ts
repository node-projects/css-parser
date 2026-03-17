/**
 * A simple lexer (scanner) for CSS input.
 *
 * Instead of repeatedly slicing the input string and matching regexes
 * anchored at `^`, the Lexer keeps an index (`pos`) into the original
 * input.  Simple token types (whitespace, braces, colons, semicolons,
 * commas) are scanned character-by-character, avoiding regular
 * expressions for those cases.  For complex patterns the `matchRegex`
 * helper still uses a regex, but applies it to a slice of the
 * remaining input so the rest of the codebase can stay familiar.
 */
export class Lexer {
  /** The complete CSS source string. */
  readonly input: string;

  /** Current read position (index into `input`). */
  pos: number;

  /** Current source line (1-based). */
  lineno: number;

  /** Current source column (1-based). */
  column: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
    this.lineno = 1;
    this.column = 1;
  }

  // ─── Lookahead helpers ────────────────────────────────────────────────────

  /** Returns `true` when there is still input to consume. */
  get hasMore(): boolean {
    return this.pos < this.input.length;
  }

  /**
   * Returns the character at `pos + offset` without advancing, or an
   * empty string when past the end of input.
   */
  charAt(offset = 0): string {
    return this.input[this.pos + offset] ?? '';
  }

  /**
   * Returns the remaining input from the current position.
   *
   * This creates a new string (same cost as the old `css.slice(…)` approach)
   * and is provided for compatibility with the bracket/quote-aware search
   * utilities that accept a plain string.
   */
  get remaining(): string {
    return this.input.slice(this.pos);
  }

  // ─── Consumption helpers ──────────────────────────────────────────────────

  /**
   * Advance `pos` by `n` characters, updating line/column tracking.
   * Returns the consumed slice.
   */
  consume(n: number): string {
    const str = this.input.slice(this.pos, this.pos + n);
    this._advance(str);
    return str;
  }

  /**
   * Advance `pos` up to (but not including) `absolutePos`, updating
   * line/column tracking.  Returns the consumed slice.
   */
  consumeTo(absolutePos: number): string {
    return this.consume(absolutePos - this.pos);
  }

  /**
   * Apply `re` (which must be anchored with `^`) against the remaining
   * input.  If the regex matches, the matched text is consumed and the
   * `RegExpExecArray` is returned; otherwise `null` is returned and `pos`
   * is not changed.
   */
  matchRegex(re: RegExp): RegExpExecArray | null {
    const m = re.exec(this.remaining);
    if (m) {
      this._advance(m[0]);
    }
    return m;
  }

  // ─── Character-based token scanners ──────────────────────────────────────

  /**
   * Consume zero or more whitespace characters (space, tab, CR, LF,
   * form-feed) without using a regular expression.
   */
  skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\n') {
        this.lineno++;
        this.column = 1;
        this.pos++;
      } else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f') {
        this.column++;
        this.pos++;
      } else {
        break;
      }
    }
  }

  /**
   * If the current character is `{`, consume it and any following
   * whitespace, then return `true`.  Otherwise return `false`.
   */
  tryOpenBrace(): boolean {
    if (this.input[this.pos] !== '{') {
      return false;
    }
    this.pos++;
    this.column++;
    this.skipWhitespace();
    return true;
  }

  /**
   * If the current character is `}`, consume it and return `true`.
   * Otherwise return `false`.
   */
  tryCloseBrace(): boolean {
    if (this.input[this.pos] !== '}') {
      return false;
    }
    this.pos++;
    this.column++;
    return true;
  }

  /**
   * If the current character is `:`, consume it and any following
   * whitespace, then return `true`.  Otherwise return `false`.
   */
  tryColon(): boolean {
    if (this.input[this.pos] !== ':') {
      return false;
    }
    this.pos++;
    this.column++;
    this.skipWhitespace();
    return true;
  }

  /**
   * Consume any leading semicolons and whitespace characters without
   * using a regular expression.
   */
  skipSemicolonAndWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\n') {
        this.lineno++;
        this.column = 1;
        this.pos++;
      } else if (
        ch === ';' ||
        ch === ' ' ||
        ch === '\t' ||
        ch === '\r' ||
        ch === '\f'
      ) {
        this.column++;
        this.pos++;
      } else {
        break;
      }
    }
  }

  /**
   * If the current character is `,`, consume it and any following
   * whitespace, then return `true`.  Otherwise return `false`.
   */
  tryCommaAndWhitespace(): boolean {
    if (this.input[this.pos] !== ',') {
      return false;
    }
    this.pos++;
    this.column++;
    this.skipWhitespace();
    return true;
  }

  // ─── Position snapshot ────────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current source position as an object
   * suitable for use in `Position` nodes.
   */
  getPosition(): { line: number; column: number } {
    return { line: this.lineno, column: this.column };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** Update `lineno`, `column`, and `pos` for a string that has been consumed. */
  private _advance(str: string): void {
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\n') {
        this.lineno++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
    this.pos += str.length;
  }
}
