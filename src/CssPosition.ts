/**
 * Store position information for a node
 */
export default class Position {
  start: { line: number; column: number; offset?: number };
  end: { line: number; column: number; offset?: number };
  source?: string;

  constructor(
    start: { line: number; column: number; offset?: number },
    end: { line: number; column: number; offset?: number },
    source: string,
  ) {
    this.start = start;
    this.end = end;
    this.source = source;
  }
}
