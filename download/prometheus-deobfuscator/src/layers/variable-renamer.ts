/**
 * Variable Renamer Layer
 * Restores meaningful variable names from obfuscated names
 *
 * Prometheus renames variables to patterns like:
 * - IlI1lI (confusing characters: I, l, 1)
 * - _G['obfuscated_name']
 * - Random short names like a, b, c
 */

import * as t from '../parser/types';
import { DeobfuscationLayer, DeobfuscationResult, LayerInfo } from './base';

export class VariableRenamerLayer extends DeobfuscationLayer {
  private nameMapping: Map<string, string> = new Map();
  private usedNames: Set<string> = new Set();
  private nameCounter: Map<string, number> = new Map();
  private reservedNames: Set<string>;

  constructor() {
    super();
    this.reservedNames = new Set([
      'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
      'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
      'true', 'until', 'while',
      // Common Lua globals
      '_G', '_VERSION', 'assert', 'collectgarbage', 'dofile', 'error', 'getfenv',
      'getmetatable', 'ipairs', 'load', 'loadfile', 'loadstring', 'module',
      'next', 'pairs', 'pcall', 'print', 'rawequal', 'rawget', 'rawset',
      'require', 'select', 'setfenv', 'setmetatable', 'tonumber', 'tostring',
      'type', 'unpack', 'xpcall', 'coroutine', 'debug', 'io', 'math', 'os',
      'package', 'string', 'table'
    ]);
  }

  get info(): LayerInfo {
    return {
      name: 'VariableRenamer',
      description: 'Renames obfuscated variables to meaningful names',
      priority: 30
    };
  }

  process(ast: t.Program): DeobfuscationResult {
    const changes: string[] = [];
    let modified = false;

    // Step 1: Analyze variable usage to infer semantic names
    this.analyzeVariableUsage(ast);

    // Step 2: Build name mapping
    this.buildNameMapping(ast);

    // Step 3: Apply renames
    const result = this.applyRenames(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    return this.createResult(ast, modified, changes);
  }

  private analyzeVariableUsage(ast: t.Program): void {
    // Analyze how variables are used to infer their purpose
    // This helps in giving them meaningful names

    const usageMap = new Map<string, {
      usedInMath: boolean;
      usedAsString: boolean;
      usedAsTable: boolean;
      usedAsFunction: boolean;
      usedAsIterator: boolean;
      usedAsIndex: boolean;
      assignedFrom: string[];
    }>();

    const analyze = (node: any, context: any = {}): void => {
      if (node.type === 'Identifier') {
        const name = (node as t.Identifier).name;
        if (!usageMap.has(name)) {
          usageMap.set(name, {
            usedInMath: false,
            usedAsString: false,
            usedAsTable: false,
            usedAsFunction: false,
            usedAsIterator: false,
            usedAsIndex: false,
            assignedFrom: []
          });
        }
      }

      // Track variable usage patterns
      if (node.type === 'BinaryExpression') {
        const bin = node as t.BinaryExpression;
        if (['+', '-', '*', '/', '%', '^'].includes(bin.operator)) {
          if (bin.left.type === 'Identifier') {
            const info = usageMap.get((bin.left as t.Identifier).name);
            if (info) info.usedInMath = true;
          }
          if (bin.right.type === 'Identifier') {
            const info = usageMap.get((bin.right as t.Identifier).name);
            if (info) info.usedInMath = true;
          }
        }
      }

      if (node.type === 'CallExpression') {
        const call = node as t.CallExpression;
        if (call.base.type === 'Identifier') {
          const info = usageMap.get((call.base as t.Identifier).name);
          if (info) info.usedAsFunction = true;
        }
      }

      if (node.type === 'IndexExpression') {
        const index = node as t.IndexExpression;
        if (index.index.type === 'Identifier') {
          const info = usageMap.get((index.index as t.Identifier).name);
          if (info) info.usedAsIndex = true;
        }
      }

      if (node.type === 'ForInStatement') {
        const forIn = node as t.ForInStatement;
        for (const variable of forIn.variables) {
          const info = usageMap.get(variable.name);
          if (info) info.usedAsIterator = true;
        }
      }

      if (node.type === 'LocalStatement' || node.type === 'AssignmentStatement') {
        const stmt = node as t.LocalStatement | t.AssignmentStatement;
        for (let i = 0; i < stmt.variables.length; i++) {
          const variable = stmt.variables[i];
          if (variable.type === 'Identifier' && stmt.init[i]) {
            const info = usageMap.get((variable as t.Identifier).name);
            if (info) {
              const initType = stmt.init[i].type;
              if (initType === 'StringLiteral') {
                info.usedAsString = true;
              } else if (initType === 'NumericLiteral') {
                info.usedInMath = true;
              } else if (initType === 'TableConstructorExpression') {
                info.usedAsTable = true;
              } else if (initType === 'FunctionExpression') {
                info.usedAsFunction = true;
              }
            }
          }
        }
      }

      // Recurse
      for (const key in node) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(child => analyze(child, context));
          } else if (value.type) {
            analyze(value, context);
          }
        }
      }
    };

    analyze(ast);
    this.usageMap = usageMap;
  }

  private usageMap: Map<string, {
    usedInMath: boolean;
    usedAsString: boolean;
    usedAsTable: boolean;
    usedAsFunction: boolean;
    usedAsIterator: boolean;
    usedAsIndex: boolean;
    assignedFrom: string[];
  }> = new Map();

  private buildNameMapping(ast: t.Program): void {
    // Collect all variable names
    const allNames = new Set<string>();

    const collectNames = (node: any): void => {
      if (node.type === 'Identifier') {
        allNames.add((node as t.Identifier).name);
      }

      for (const key in node) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(collectNames);
          } else if (value.type) {
            collectNames(value);
          }
        }
      }
    };

    collectNames(ast);

    // Generate new names for obfuscated variables
    for (const name of allNames) {
      if (this.shouldRename(name)) {
        const newName = this.generateNewName(name);
        this.nameMapping.set(name, newName);
        this.usedNames.add(newName);
      }
    }
  }

  private shouldRename(name: string): boolean {
    // Don't rename reserved words or standard library
    if (this.reservedNames.has(name)) {
      return false;
    }

    // Rename names with confusing characters
    if (/[Il1O0]{3,}/.test(name)) {
      return true;
    }

    // Rename very short single-char names (except common ones)
    if (name.length === 1 && !['i', 'j', 'k', 'n', 'x', 'y', 'z', 'v', 't', 'f', 's'].includes(name)) {
      return true;
    }

    // Rename names that look like hashes
    if (/^[a-f0-9]{6,}$/i.test(name)) {
      return true;
    }

    // Rename names with underscores and mixed case like _G access
    if (name.startsWith('_') && /[A-Z]/.test(name) && /[a-z]/.test(name)) {
      return true;
    }

    return false;
  }

  private generateNewName(oldName: string): string {
    // Try to infer a semantic name from usage
    const usage = this.usageMap.get(oldName);

    let baseName = 'var';

    if (usage) {
      if (usage.usedAsFunction) {
        baseName = 'func';
      } else if (usage.usedAsTable) {
        baseName = 'tbl';
      } else if (usage.usedAsString) {
        baseName = 'str';
      } else if (usage.usedInMath) {
        baseName = 'num';
      } else if (usage.usedAsIterator) {
        baseName = 'idx';
      } else if (usage.usedAsIndex) {
        baseName = 'key';
      }
    }

    // Get unique name
    let counter = this.nameCounter.get(baseName) || 0;
    let newName = `${baseName}${counter || ''}`;

    while (this.usedNames.has(newName) || this.reservedNames.has(newName)) {
      counter++;
      newName = `${baseName}${counter}`;
    }

    this.nameCounter.set(baseName, counter + 1);
    return newName;
  }

  private applyRenames(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const rename = (node: any): any => {
      if (node.type === 'Identifier') {
        const name = (node as t.Identifier).name;
        const newName = this.nameMapping.get(name);

        if (newName) {
          changes.push(`Renamed variable: ${name} -> ${newName}`);
          modified = true;
          return { ...node, name: newName } as t.Identifier;
        }
      }

      // Recurse
      for (const key in node) {
        const value = node[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            node[key] = value.map(rename);
          } else if (value.type) {
            node[key] = rename(value);
          }
        }
      }

      return node;
    };

    const newAST = rename(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }
}
