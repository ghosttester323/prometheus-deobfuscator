/**
 * String Decoder Layer
 * Decodes obfuscated strings in Prometheus Weak preset
 *
 * Prometheus encodes strings using various techniques:
 * 1. String table lookup: _G['encoded_key'] or table[index]
 * 2. String concatenation: "str" .. "ing"
 * 3. Char function: string.char(65, 66, 67)
 * 4. Base64-like encoding with custom alphabet
 */

import * as t from '../parser/types';
import { DeobfuscationLayer, DeobfuscationResult, LayerInfo } from './base';

export class StringDecoderLayer extends DeobfuscationLayer {
  private stringTable: Map<string, string> = new Map();
  private stringArray: string[] = [];

  get info(): LayerInfo {
    return {
      name: 'StringDecoder',
      description: 'Decodes obfuscated strings from string tables and concatenations',
      priority: 10
    };
  }

  process(ast: t.Program): DeobfuscationResult {
    const changes: string[] = [];
    let modified = false;

    // Step 1: Find and extract string tables
    this.extractStringTables(ast);

    // Step 2: Replace string lookups
    const result = this.transformAST(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 3: Resolve string concatenations
    const concatResult = this.resolveConcatenations(ast, changes);
    if (concatResult.modified) {
      modified = true;
      ast = concatResult.ast;
    }

    // Step 4: Resolve string.char calls
    const charResult = this.resolveCharCalls(ast, changes);
    if (charResult.modified) {
      modified = true;
      ast = charResult.ast;
    }

    return this.createResult(ast, modified, changes);
  }

  private extractStringTables(ast: t.Program): void {
    // Look for patterns like:
    // local strings = {"str1", "str2", ...}
    // local strings = {["key"] = "value", ...}
    // _G["string_table"] = {...}

    for (const stmt of ast.body) {
      if (stmt.type === 'LocalStatement') {
        const localStmt = stmt as t.LocalStatement;
        if (localStmt.init.length === 1 &&
            localStmt.init[0].type === 'TableConstructorExpression') {
          const table = localStmt.init[0] as t.TableConstructorExpression;

          // Check if this looks like a string table
          const isStringTable = table.fields.every(f =>
            f.type === 'TableValue' &&
            (f as t.TableValue).value.type === 'StringLiteral'
          );

          if (isStringTable) {
            this.stringArray = table.fields.map(f =>
              ((f as t.TableValue).value as t.StringLiteral).value
            );
            this.stringTable.set(localStmt.variables[0].name, 'array');
          }

          // Also check for key-value string tables
          const isKVStringTable = table.fields.every(f =>
            (f.type === 'TableKeyString' || f.type === 'TableKey') &&
            ((f as t.TableKey | t.TableKeyString).value.type === 'StringLiteral')
          );

          if (isKVStringTable) {
            for (const field of table.fields) {
              if (field.type === 'TableKeyString') {
                const key = field.key.name;
                const value = (field.value as t.StringLiteral).value;
                this.stringTable.set(key, value);
              }
            }
          }
        }
      }
    }
  }

  private transformAST(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const transform = (node: any): any => {
      // Replace string table lookups: strings[index] or _G["key"]
      if (node.type === 'IndexExpression') {
        const indexExpr = node as t.IndexExpression;

        // Array lookup: strings[1]
        if (indexExpr.base.type === 'Identifier' &&
            this.stringTable.has((indexExpr.base as t.Identifier).name) &&
            indexExpr.index.type === 'NumericLiteral') {
          const idx = (indexExpr.index as t.NumericLiteral).value;
          if (idx >= 1 && idx <= this.stringArray.length) {
            const str = this.stringArray[idx - 1];
            changes.push(`Decoded string at index ${idx}: "${str}"`);
            modified = true;
            return {
              type: 'StringLiteral',
              value: str,
              raw: `"${str}"`
            } as t.StringLiteral;
          }
        }

        // _G["key"] lookup
        if (indexExpr.base.type === 'Identifier' &&
            (indexExpr.base as t.Identifier).name === '_G' &&
            indexExpr.index.type === 'StringLiteral') {
          const key = (indexExpr.index as t.StringLiteral).value;
          const value = this.stringTable.get(key);
          if (value !== undefined) {
            changes.push(`Decoded _G["${key}"] = "${value}"`);
            modified = true;
            return {
              type: 'StringLiteral',
              value,
              raw: `"${value}"`
            } as t.StringLiteral;
          }
        }
      }

      // Recursively transform all nodes
      return this.transformNode(node, transform);
    };

    const newAST = transform(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private transformNode(node: any, transform: (n: any) => any): any {
    // Transform statements
    if ('body' in node && Array.isArray(node.body)) {
      node.body = node.body.map(transform);
    }

    // Transform expressions
    if ('init' in node && Array.isArray(node.init)) {
      node.init = node.init.map(transform);
    }

    if ('variables' in node && Array.isArray(node.variables)) {
      node.variables = node.variables.map(transform);
    }

    if ('arguments' in node && Array.isArray(node.arguments)) {
      node.arguments = node.arguments.map(transform);
    }

    if ('condition' in node) {
      node.condition = transform(node.condition);
    }

    if ('left' in node) {
      node.left = transform(node.left);
    }

    if ('right' in node) {
      node.right = transform(node.right);
    }

    if ('base' in node) {
      node.base = transform(node.base);
    }

    if ('index' in node && node.type === 'IndexExpression') {
      node.index = transform(node.index);
    }

    if ('expression' in node && node.type === 'ParenthesizedExpression') {
      node.expression = transform(node.expression);
    }

    if ('argument' in node && node.type === 'UnaryExpression') {
      node.argument = transform(node.argument);
    }

    return node;
  }

  private resolveConcatenations(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const resolve = (node: any): any => {
      if (node.type === 'BinaryExpression') {
        const binExpr = node as t.BinaryExpression;

        if (binExpr.operator === '..') {
          const left = resolve(binExpr.left);
          const right = resolve(binExpr.right);

          if (left.type === 'StringLiteral' && right.type === 'StringLiteral') {
            const leftStr = (left as t.StringLiteral).value;
            const rightStr = (right as t.StringLiteral).value;
            const combined = leftStr + rightStr;

            changes.push(`Resolved concatenation: "${leftStr}" .. "${rightStr}" = "${combined}"`);
            modified = true;

            return {
              type: 'StringLiteral',
              value: combined,
              raw: `"${combined}"`
            } as t.StringLiteral;
          }

          return { ...binExpr, left, right };
        }
      }

      return this.transformNode(node, resolve);
    };

    const newAST = resolve(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private resolveCharCalls(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const resolve = (node: any): any => {
      // Look for string.char(...) or char(...)
      if (node.type === 'CallExpression') {
        const callExpr = node as t.CallExpression;

        let isCharCall = false;
        if (callExpr.base.type === 'Identifier' &&
            (callExpr.base as t.Identifier).name === 'char') {
          isCharCall = true;
        } else if (callExpr.base.type === 'MemberExpression') {
          const member = callExpr.base as t.MemberExpression;
          if (member.base.type === 'Identifier' &&
              (member.base as t.Identifier).name === 'string' &&
              member.identifier.name === 'char') {
            isCharCall = true;
          }
        }

        if (isCharCall) {
          // Try to resolve if all arguments are numeric literals
          const allNumeric = callExpr.arguments.every(
            arg => arg.type === 'NumericLiteral'
          );

          if (allNumeric) {
            const charCodes = callExpr.arguments.map(
              arg => (arg as t.NumericLiteral).value
            );

            // Validate char codes
            if (charCodes.every(c => Number.isInteger(c) && c >= 0 && c <= 255)) {
              const str = String.fromCharCode(...charCodes);
              changes.push(`Resolved string.char(${charCodes.join(', ')}) = "${str}"`);
              modified = true;

              return {
                type: 'StringLiteral',
                value: str,
                raw: `"${str}"`
              } as t.StringLiteral;
            }
          }
        }
      }

      return this.transformNode(node, resolve);
    };

    const newAST = resolve(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }
}
