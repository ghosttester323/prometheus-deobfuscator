/**
 * Dead Code Remover Layer
 * Removes dead code and unused variables
 */

import * as t from '../parser/types';
import { DeobfuscationLayer, DeobfuscationResult, LayerInfo } from './base';

export class DeadCodeRemoverLayer extends DeobfuscationLayer {
  get info(): LayerInfo {
    return {
      name: 'DeadCodeRemover',
      description: 'Removes dead code and unused variables',
      priority: 40
    };
  }

  process(ast: t.Program): DeobfuscationResult {
    const changes: string[] = [];
    let modified = false;

    // Step 1: Remove unused local variables
    let result = this.removeUnusedLocals(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 2: Remove empty statements
    result = this.removeEmptyStatements(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 3: Remove unreachable code after return/break
    result = this.removeUnreachableCode(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 4: Remove string tables that are no longer used
    result = this.removeUnusedStringTables(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    return this.createResult(ast, modified, changes);
  }

  private removeUnusedLocals(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    // First pass: collect all used identifiers
    const usedIdentifiers = new Set<string>();
    const assignedVariables = new Map<string, { node: t.LocalStatement; used: boolean }>();

    const collectUsage = (node: any, isAssignment: boolean = false): void => {
      if (node.type === 'Identifier') {
        const name = (node as t.Identifier).name;
        usedIdentifiers.add(name);
      }

      // Track local statement assignments
      if (node.type === 'LocalStatement') {
        const localStmt = node as t.LocalStatement;
        for (const variable of localStmt.variables) {
          assignedVariables.set(variable.name, { node: localStmt, used: false });
        }
        // Init expressions are usage
        for (const init of localStmt.init) {
          collectUsage(init, false);
        }
        return;
      }

      // Recurse
      for (const key in node) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(child => collectUsage(child));
          } else if (value.type) {
            collectUsage(value);
          }
        }
      }
    };

    collectUsage(ast);

    // Mark used variables
    for (const [name, info] of assignedVariables) {
      if (usedIdentifiers.has(name)) {
        info.used = true;
      }
    }

    // Remove unused local statements (but keep the init expressions if they have side effects)
    const newBody: t.Statement[] = [];

    for (const stmt of ast.body) {
      if (stmt.type === 'LocalStatement') {
        const localStmt = stmt as t.LocalStatement;
        const info = assignedVariables.get(localStmt.variables[0]?.name);

        if (info && !info.used && !this.hasSideEffects(localStmt)) {
          changes.push(`Removed unused local variable: ${localStmt.variables[0]?.name}`);
          modified = true;
          continue;
        }
      }

      newBody.push(stmt);
    }

    return this.createResult({ ...ast, body: newBody }, modified, changes);
  }

  private hasSideEffects(node: t.LocalStatement): boolean {
    // Check if init expressions have side effects (function calls, etc.)
    for (const init of node.init) {
      if (this.expressionHasSideEffects(init)) {
        return true;
      }
    }
    return false;
  }

  private expressionHasSideEffects(expr: t.Expression): boolean {
    if (expr.type === 'CallExpression' ||
        expr.type === 'TableCallExpression' ||
        expr.type === 'StringCallExpression') {
      return true;
    }

    // Check nested expressions
    for (const key in expr) {
      const value = (expr as any)[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.some(e => e.type && this.expressionHasSideEffects(e))) {
            return true;
          }
        } else if (value.type && this.expressionHasSideEffects(value)) {
          return true;
        }
      }
    }

    return false;
  }

  private removeEmptyStatements(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;
    const newBody: t.Statement[] = [];

    for (const stmt of ast.body) {
      // Remove empty do-end blocks
      if (stmt.type === 'DoStatement') {
        const doStmt = stmt as t.DoStatement;
        if (doStmt.body.length === 0) {
          changes.push('Removed empty do-end block');
          modified = true;
          continue;
        }
      }

      // Keep other statements
      newBody.push(stmt);
    }

    return this.createResult({ ...ast, body: newBody }, modified, changes);
  }

  private removeUnreachableCode(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const removeUnreachable = (body: t.Statement[]): t.Statement[] => {
      const result: t.Statement[] = [];
      let foundTerminal = false;

      for (const stmt of body) {
        if (foundTerminal) {
          changes.push('Removed unreachable code after return/break');
          modified = true;
          continue;
        }

        result.push(stmt);

        if (stmt.type === 'ReturnStatement' || stmt.type === 'BreakStatement') {
          foundTerminal = true;
        }
      }

      return result;
    };

    const process = (node: any): any => {
      if ('body' in node && Array.isArray(node.body)) {
        node.body = removeUnreachable(node.body);
        node.body = node.body.map(process);
      }

      if ('clauses' in node && Array.isArray(node.clauses)) {
        node.clauses = node.clauses.map((clause: any) => {
          clause.body = removeUnreachable(clause.body);
          clause.body = clause.body.map(process);
          return clause;
        });
      }

      return node;
    };

    const newAST = process(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private removeUnusedStringTables(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    // Find string table definitions
    const stringTableNames = new Set<string>();

    for (const stmt of ast.body) {
      if (stmt.type === 'LocalStatement') {
        const localStmt = stmt as t.LocalStatement;
        if (localStmt.init.length === 1 &&
            localStmt.init[0].type === 'TableConstructorExpression') {
          const table = localStmt.init[0] as t.TableConstructorExpression;

          // Check if this is a string table (all values are strings)
          const isStringTable = table.fields.every(f =>
            (f.type === 'TableValue' &&
             (f as t.TableValue).value.type === 'StringLiteral') ||
            (f.type === 'TableKeyString' &&
             ((f as t.TableKeyString).value.type === 'StringLiteral'))
          );

          if (isStringTable) {
            stringTableNames.add(localStmt.variables[0]?.name);
          }
        }
      }
    }

    // Check if string tables are used after other layers have done their work
    // If the table name is only used once (its definition), it can be removed
    const usageCount = new Map<string, number>();

    const countUsage = (node: any): void => {
      if (node.type === 'Identifier') {
        const name = (node as t.Identifier).name;
        usageCount.set(name, (usageCount.get(name) || 0) + 1);
      }

      for (const key in node) {
        const value = node[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(countUsage);
          } else if (value.type) {
            countUsage(value);
          }
        }
      }
    };

    countUsage(ast);

    // Remove string tables that are only referenced once (their definition)
    const newBody: t.Statement[] = [];

    for (const stmt of ast.body) {
      if (stmt.type === 'LocalStatement') {
        const localStmt = stmt as t.LocalStatement;
        const varName = localStmt.variables[0]?.name;

        if (stringTableNames.has(varName) && usageCount.get(varName) === 1) {
          changes.push(`Removed unused string table: ${varName}`);
          modified = true;
          continue;
        }
      }

      newBody.push(stmt);
    }

    return this.createResult({ ...ast, body: newBody }, modified, changes);
  }
}
