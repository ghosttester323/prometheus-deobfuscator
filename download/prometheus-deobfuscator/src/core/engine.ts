/**
 * Deobfuscation Engine
 * Orchestrates all deobfuscation layers
 */

import * as t from '../parser/types';
import { parse, generate } from '../parser';
import {
  DeobfuscationLayer,
  DeobfuscationResult,
  StringDecoderLayer,
  ControlFlowCleanerLayer,
  VariableRenamerLayer,
  ConstantFoldingLayer,
  DeadCodeRemoverLayer
} from '../layers';

export interface DeobfuscationOptions {
  verbose?: boolean;
  maxIterations?: number;
  layers?: string[];
}

export interface DeobfuscationReport {
  original: string;
  deobfuscated: string;
  iterations: number;
  layersApplied: string[];
  changes: string[];
  success: boolean;
  error?: string;
}

export class Deobfuscator {
  private layers: DeobfuscationLayer[];
  private options: DeobfuscationOptions;

  constructor(options: DeobfuscationOptions = {}) {
    this.options = {
      verbose: false,
      maxIterations: 5,
      ...options
    };

    // Initialize layers in priority order
    this.layers = [
      new ConstantFoldingLayer(),
      new StringDecoderLayer(),
      new ControlFlowCleanerLayer(),
      new VariableRenamerLayer(),
      new DeadCodeRemoverLayer()
    ].sort((a, b) => a.info.priority - b.info.priority);

    // Filter layers if specified
    if (options.layers && options.layers.length > 0) {
      this.layers = this.layers.filter(layer =>
        options.layers!.includes(layer.info.name)
      );
    }
  }

  deobfuscate(source: string): DeobfuscationReport {
    const report: DeobfuscationReport = {
      original: source,
      deobfuscated: source,
      iterations: 0,
      layersApplied: [],
      changes: [],
      success: false
    };

    try {
      // Parse the source
      let ast = parse(source);

      // Run deobfuscation passes until no more changes
      let modified = true;
      let iterations = 0;

      while (modified && iterations < this.options.maxIterations!) {
        modified = false;
        iterations++;

        for (const layer of this.layers) {
          const result = layer.process(ast);

          if (result.modified) {
            modified = true;
            ast = result.ast;
            report.layersApplied.push(layer.info.name);
            report.changes.push(...result.changes);

            if (this.options.verbose) {
              console.log(`[${layer.info.name}] ${result.changes.length} changes`);
            }
          }
        }
      }

      // Generate deobfuscated code
      report.deobfuscated = generate(ast);
      report.iterations = iterations;
      report.success = true;

    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
      report.success = false;
    }

    return report;
  }

  getLayerInfo(): { name: string; description: string; priority: number }[] {
    return this.layers.map(layer => ({
      name: layer.info.name,
      description: layer.info.description,
      priority: layer.info.priority
    }));
  }
}

/**
 * Quick deobfuscation function
 */
export function deobfuscate(source: string, options?: DeobfuscationOptions): string {
  const deobfuscator = new Deobfuscator(options);
  const report = deobfuscator.deobfuscate(source);
  return report.deobfuscated;
}

/**
 * Full deobfuscation with report
 */
export function deobfuscateWithReport(
  source: string,
  options?: DeobfuscationOptions
): DeobfuscationReport {
  const deobfuscator = new Deobfuscator(options);
  return deobfuscator.deobfuscate(source);
}
