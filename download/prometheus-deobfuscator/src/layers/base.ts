/**
 * Base Layer Interface
 * All deobfuscation layers must implement this interface
 */

import * as t from '../parser/types';

export interface DeobfuscationResult {
  ast: t.Program;
  modified: boolean;
  changes: string[];
}

export interface LayerInfo {
  name: string;
  description: string;
  priority: number; // Lower = runs first
}

export abstract class DeobfuscationLayer {
  abstract get info(): LayerInfo;

  abstract process(ast: t.Program): DeobfuscationResult;

  protected createResult(ast: t.Program, modified: boolean, changes: string[]): DeobfuscationResult {
    return { ast, modified, changes };
  }

  protected cloneAST(ast: t.Program): t.Program {
    return JSON.parse(JSON.stringify(ast));
  }
}
