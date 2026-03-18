import type { CssStylesheetAST } from '../type.js';
import Compiler, { type CompilerOptions } from './compiler.js';

export type { CompilerOptions };

export default (node: CssStylesheetAST, options?: CompilerOptions) => {
  const compiler = new Compiler(options || {});
  return compiler.compile(node);
};
