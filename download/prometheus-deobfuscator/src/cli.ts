#!/usr/bin/env node

/**
 * Prometheus Deobfuscator CLI
 * Command-line interface for deobfuscating Lua code
 */

import * as fs from 'fs';
import * as path from 'path';
import { Deobfuscator, DeobfuscationReport } from './core';
import { program } from 'commander';

const VERSION = '1.0.0';

program
  .name('prometheus-deobf')
  .description('Deobfuscator for Prometheus Lua Obfuscator (Weak preset)')
  .version(VERSION)
  .argument('<input>', 'Input Lua file or directory')
  .option('-o, --output <path>', 'Output file or directory')
  .option('-v, --verbose', 'Show detailed output', false)
  .option('-i, --iterations <n>', 'Maximum deobfuscation iterations', '5')
  .option('-l, --layers <names>', 'Comma-separated list of layers to use')
  .option('-r, --report', 'Generate deobfuscation report', false)
  .option('-w, --overwrite', 'Overwrite input files', false)
  .option('--list-layers', 'List available deobfuscation layers', false)
  .action(main);

function main(input: string, options: any) {
  // List layers mode
  if (options.listLayers) {
    listLayers();
    return;
  }

  // Check input exists
  if (!fs.existsSync(input)) {
    console.error(`Error: Input path does not exist: ${input}`);
    process.exit(1);
  }

  // Parse options
  const deobfOptions = {
    verbose: options.verbose,
    maxIterations: parseInt(options.iterations, 10),
    layers: options.layers ? options.layers.split(',').map((l: string) => l.trim()) : undefined
  };

  const deobfuscator = new Deobfuscator(deobfOptions);

  // Process single file
  if (fs.statSync(input).isFile()) {
    processFile(input, options.output, deobfuscator, options);
  }
  // Process directory
  else if (fs.statSync(input).isDirectory()) {
    processDirectory(input, options.output, deobfuscator, options);
  }
}

function processFile(
  inputPath: string,
  outputPath: string | undefined,
  deobfuscator: Deobfuscator,
  options: any
): void {
  console.log(`Processing: ${inputPath}`);

  // Read input
  const source = fs.readFileSync(inputPath, 'utf-8');

  // Deobfuscate
  const report = deobfuscator.deobfuscate(source);

  if (!report.success) {
    console.error(`Error: Deobfuscation failed: ${report.error}`);
    process.exit(1);
  }

  // Determine output path
  const finalOutputPath = outputPath || (
    options.overwrite ? inputPath : getOutputPath(inputPath)
  );

  // Write output
  fs.writeFileSync(finalOutputPath, report.deobfuscated);
  console.log(`Output: ${finalOutputPath}`);

  // Show summary
  console.log(`\nSummary:`);
  console.log(`  Iterations: ${report.iterations}`);
  console.log(`  Layers applied: ${report.layersApplied.length}`);
  console.log(`  Total changes: ${report.changes.length}`);

  // Verbose output
  if (options.verbose && report.changes.length > 0) {
    console.log(`\nChanges:`);
    report.changes.slice(0, 20).forEach(change => {
      console.log(`  - ${change}`);
    });
    if (report.changes.length > 20) {
      console.log(`  ... and ${report.changes.length - 20} more`);
    }
  }

  // Generate report file
  if (options.report) {
    const reportPath = finalOutputPath.replace(/\.lua$/i, '.report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${reportPath}`);
  }
}

function processDirectory(
  inputDir: string,
  outputDir: string | undefined,
  deobfuscator: Deobfuscator,
  options: any
): void {
  const files = findLuaFiles(inputDir);

  if (files.length === 0) {
    console.log('No Lua files found in directory.');
    return;
  }

  console.log(`Found ${files.length} Lua file(s)`);

  const finalOutputDir = outputDir || (
    options.overwrite ? inputDir : inputDir + '_deobfuscated'
  );

  // Create output directory
  if (!fs.existsSync(finalOutputDir)) {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const relativePath = path.relative(inputDir, file);
      const outputFilePath = path.join(finalOutputDir, relativePath);
      const outputDirPath = path.dirname(outputFilePath);

      if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
      }

      processFile(file, outputFilePath, deobfuscator, { ...options, verbose: false });
      successCount++;
    } catch (error) {
      console.error(`Failed: ${file}`);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} success, ${errorCount} errors`);
}

function findLuaFiles(dir: string): string[] {
  const results: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.lua')) {
        results.push(fullPath);
      }
    }
  }

  traverse(dir);
  return results;
}

function getOutputPath(inputPath: string): string {
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  return path.join(dir, `${base}_deobfuscated${ext}`);
}

function listLayers(): void {
  const deobfuscator = new Deobfuscator();
  const layers = deobfuscator.getLayerInfo();

  console.log('Available deobfuscation layers:\n');
  console.log('  Name                 Priority  Description');
  console.log('  ' + '-'.repeat(60));

  for (const layer of layers) {
    console.log(`  ${layer.name.padEnd(20)}  ${String(layer.priority).padEnd(8)}  ${layer.description}`);
  }
}

program.parse();
