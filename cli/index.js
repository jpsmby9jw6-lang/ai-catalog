#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const readline = require('readline');

const schemaPath = path.join(__dirname, '../schema/ai-catalog.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, formats: { uri: true, 'date-time': true } });
const validate = ajv.compile(schema);

const { diffCatalogs } = require('./diff');
const { lintCatalog } = require('./lint');

// --- Flag parsing (applies to all commands) ---
const rawArgs = process.argv.slice(2);
const flags = {
  json: rawArgs.includes('--json'),
  verbose: rawArgs.includes('--verbose'),
};
const args = rawArgs.filter((a) => !a.startsWith('--'));

// Make validation errors human-actionable
function friendlyError(error) {
  const where = error.instancePath || '(root)';
  switch (error.keyword) {
    case 'required':
      return `${where}: missing required field "${error.params.missingProperty}"`;
    case 'enum':
      return `${where}: value must be one of: ${error.params.allowedValues.join(', ')}`;
    case 'pattern':
      if (where.includes('version')) return `${where}: version must be semantic, like "1.0.0"`;
      if (where.includes('/id')) return `${where}: ids must be lowercase letters, numbers, underscores, or hyphens (e.g., "get_weather")`;
      return `${where}: value does not match required pattern ${error.params.pattern}`;
    case 'additionalProperties':
      return `${where}: unknown field "${error.params.additionalProperty}" — check for typos or see the schema (ai-catalog schema)`;
    case 'type':
      return `${where}: expected ${error.params.type}`;
    default:
      return `${where}: ${error.message}`;
  }
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
  log('\n' + '='.repeat(60), 'cyan');
  log(text, 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
}

async function validateCatalog(filePath) {
  if (!flags.json) header('AI Catalog Validator');

  try {
    if (!fs.existsSync(filePath)) {
      if (flags.json) {
        console.log(JSON.stringify({ valid: false, errors: [`File not found: ${filePath}`] }));
      } else {
        log(`❌ File not found: ${filePath}`, 'red');
      }
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let catalog;

    try {
      catalog = JSON.parse(content);
    } catch (e) {
      if (flags.json) {
        console.log(JSON.stringify({ valid: false, errors: [`Invalid JSON: ${e.message}`] }));
      } else {
        log(`❌ Invalid JSON: ${e.message}`, 'red');
      }
      process.exit(1);
    }

    const valid = validate(catalog);

    if (flags.json) {
      const result = {
        valid,
        file: filePath,
        summary: valid ? {
          name: catalog.name,
          version: catalog.version,
          capabilities: catalog.capabilities?.length || 0,
          tools: catalog.tools?.length || 0,
        } : undefined,
        errors: valid ? [] : validate.errors.map(friendlyError),
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(valid ? 0 : 1);
    }

    if (valid) {
      log('✅ Catalog is valid!', 'green');
      log(`\n📋 Summary:`, 'blue');
      log(`  Name: ${catalog.name}`);
      log(`  Version: ${catalog.version}`);
      log(`  Capabilities: ${catalog.capabilities?.length || 0}`);
      log(`  Tools: ${catalog.tools?.length || 0}`);
      log(`  Repository: ${catalog.repository.url}`);
      log(`  Maturity: ${catalog.metadata?.maturity || 'stable'}`);
      
      if (catalog.tools && catalog.tools.length > 0) {
        log(`\n🔧 Available Tools:`, 'blue');
        catalog.tools.forEach(tool => {
          const auth = tool.auth ? ` [${tool.auth}]` : '';
          const approval = tool.requires_approval ? ' ⚠️ approval' : '';
          log(`  • ${tool.name}${auth}${approval}`);
        });
      }

      if (catalog.capabilities && catalog.capabilities.length > 0) {
        log(`\n💡 Capabilities:`, 'blue');
        catalog.capabilities.forEach(cap => {
          log(`  • ${cap.name}`);
        });
      }

      log('\n✨ Catalog ready for AI discovery!', 'green');
      return { valid: true, catalog };
    } else {
      log('❌ Validation errors found:\n', 'red');
      validate.errors.forEach((error, i) => {
        log(`  ${i + 1}. ${friendlyError(error)}`, 'yellow');
        if (flags.verbose) {
          log(`     raw: ${JSON.stringify(error)}`, 'reset');
        }
      });
      log('\nTip: run "ai-catalog schema" to see the full field reference.', 'blue');
      process.exit(1);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function generateCatalog(outputPath) {
  header('Interactive AI Catalog Generator');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(`${colors.cyan}${query}${colors.reset} `, resolve));

  try {
    log('Answer the following to generate your ai-catalog.json\n', 'blue');

    const name = await question('Project name:');
    const description = await question('Description:');
    const repoUrl = await question('Repository URL (e.g., https://github.com/user/repo):');
    const hasTools = await question('Does this project expose tools/APIs? (yes/no):');
    const hasCaps = await question('Want to define capabilities? (yes/no):');

    const catalog = {
      version: '1.0.0',
      name: name || 'My Project',
      description: description || 'A project with AI integration',
      repository: {
        url: repoUrl || 'https://github.com/user/repo',
        branch: 'main',
      },
      capabilities: [],
      tools: [],
      permissions: {
        default_access: 'read',
        agent_rules: [],
      },
      documentation: {
        main: `${repoUrl}#readme`,
      },
      metadata: {
        maintained: true,
        maturity: 'stable',
        last_updated: new Date().toISOString(),
      },
    };

    if (hasCaps.toLowerCase().startsWith('y')) {
      log('\nAdd capabilities (press Enter with empty name to finish)\n', 'blue');
      let capIndex = 0;
      while (true) {
        const capName = await question(`Capability ${capIndex + 1} name:`);
        if (!capName) break;
        const capDesc = await question('Description:');
        catalog.capabilities.push({
          id: capName.toLowerCase().replace(/\s+/g, '_'),
          name: capName,
          description: capDesc,
          category: 'other',
        });
        capIndex++;
      }
    }

    if (hasTools.toLowerCase().startsWith('y')) {
      log('\nAdd tools (press Enter with empty name to finish)\n', 'blue');
      let toolIndex = 0;
      while (true) {
        const toolName = await question(`Tool ${toolIndex + 1} name:`);
        if (!toolName) break;
        const toolDesc = await question('Description:');
        const toolType = await question('Type (function/api/cli/mcp/webhook/script):');
        const endpoint = await question('Endpoint/URL:');
        catalog.tools.push({
          id: toolName.toLowerCase().replace(/\s+/g, '_'),
          name: toolName,
          description: toolDesc,
          type: toolType || 'function',
          endpoint: endpoint || '',
          inputs: {},
          outputs: {},
          ai_safe: true,
        });
        toolIndex++;
      }
    }

    rl.close();

    const output = JSON.stringify(catalog, null, 2);
    fs.writeFileSync(outputPath, output);

    log('\n✅ Generated ai-catalog.json', 'green');
    log(`📄 Saved to: ${outputPath}\n`, 'green');
    log('Preview:\n', 'blue');
    log(output, 'reset');

    return catalog;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  }
}

function displaySchema() {
  header('AI Catalog Schema Reference');
  log('JSON Schema Definition:', 'blue');
  log(JSON.stringify(schema, null, 2));
}

async function testCatalog(filePath) {
  header('Running Catalog Tests');

  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ File not found: ${filePath}`, 'red');
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const catalog = JSON.parse(content);

    let passed = 0;
    let warnings = 0;

    log('Test 1: Valid JSON structure', 'blue');
    if (validate(catalog)) {
      log('  ✅ Passed', 'green');
      passed++;
    } else {
      log('  ❌ Failed', 'red');
    }

    log('\nTest 2: Essential fields present', 'blue');
    const hasRequired = catalog.name && catalog.repository && catalog.version;
    if (hasRequired) {
      log('  ✅ Passed (name, repository, version)', 'green');
      passed++;
    } else {
      log('  ❌ Failed (missing required fields)', 'red');
    }

    log('\nTest 3: Tools are properly configured', 'blue');
    if (catalog.tools && catalog.tools.length > 0) {
      const allValid = catalog.tools.every(t => t.id && t.name && t.type);
      if (allValid) {
        log(`  ✅ Passed (${catalog.tools.length} tools valid)`, 'green');
        passed++;
      } else {
        log('  ❌ Some tools missing required fields', 'red');
      }
    } else {
      log('  ⚠️  No tools defined (optional)', 'yellow');
      warnings++;
    }

    log('\nTest 4: Capabilities are documented', 'blue');
    if (catalog.capabilities && catalog.capabilities.length > 0) {
      log(`  ✅ Passed (${catalog.capabilities.length} capabilities)`, 'green');
      passed++;
    } else {
      log('  ⚠️  No capabilities defined (recommended)', 'yellow');
      warnings++;
    }

    log('\nTest 5: Documentation links present', 'blue');
    if (catalog.documentation && catalog.documentation.main) {
      log('  ✅ Passed (main documentation URL)', 'green');
      passed++;
    } else {
      log('  ⚠️  No documentation URL (recommended)', 'yellow');
      warnings++;
    }

    log('\nTest 6: Metadata completeness', 'blue');
    const hasMetadata = catalog.metadata && catalog.metadata.contact;
    if (hasMetadata) {
      log('  ✅ Passed (metadata complete)', 'green');
      passed++;
    } else {
      log('  ⚠️  Missing contact info (recommended)', 'yellow');
      warnings++;
    }

    log('\n' + '='.repeat(60), 'cyan');
    log(`Results: ${passed} passed, ${warnings} warnings`, 'cyan');
    log('='.repeat(60) + '\n', 'cyan');

    return { passed, warnings };
  } catch (error) {
    log(`❌ Test error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function runLint(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ File not found: ${filePath}`, 'red');
      process.exit(1);
    }
    const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Lint implies schema validity first
    if (!validate(catalog)) {
      if (flags.json) {
        console.log(JSON.stringify({ ok: false, schema_errors: validate.errors.map(friendlyError) }, null, 2));
      } else {
        log('❌ Catalog fails schema validation — fix these before linting:', 'red');
        validate.errors.forEach((e, i) => log(`  ${i + 1}. ${friendlyError(e)}`, 'yellow'));
      }
      process.exit(1);
    }

    const result = lintCatalog(catalog);

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    header('AI Catalog Linter');

    if (result.errors.length > 0) {
      log('🚫 Errors (fix these):', 'red');
      result.errors.forEach((e) => log(`  • ${e}`, 'red'));
      log('');
    }
    if (result.warnings.length > 0) {
      log('⚠️  Warnings (strongly recommended):', 'yellow');
      result.warnings.forEach((w) => log(`  • ${w}`, 'yellow'));
      log('');
    }
    if (result.info.length > 0) {
      log('💡 Suggestions:', 'blue');
      result.info.forEach((i) => log(`  • ${i}`, 'blue'));
      log('');
    }

    if (result.errors.length === 0 && result.warnings.length === 0 && result.info.length === 0) {
      log('✅ Spotless. No lint findings.', 'green');
    } else {
      log(`Summary: ${result.errors.length} errors, ${result.warnings.length} warnings, ${result.info.length} suggestions`, 'cyan');
    }

    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    log(`❌ Lint error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function runDiff(oldPath, newPath) {
  try {
    if (!oldPath || !newPath) {
      log('Usage: ai-catalog diff <old.json> <new.json>', 'yellow');
      process.exit(1);
    }
    [oldPath, newPath].forEach((p) => {
      if (!fs.existsSync(p)) {
        log(`❌ File not found: ${p}`, 'red');
        process.exit(1);
      }
    });

    const { report, hasChanges, breaking } = diffCatalogs(oldPath, newPath);

    if (flags.json) {
      console.log(JSON.stringify({ hasChanges, breaking, report }, null, 2));
      process.exit(0);
    }

    header('AI Catalog Diff');

    if (!hasChanges) {
      log('✅ No changes detected between catalogs.', 'green');
      process.exit(0);
    }

    if (report.version.changed) {
      log(`📦 Version: ${report.version.old} → ${report.version.new}`, 'blue');
    }
    if (report.name_changed) log('✏️  Project name changed', 'blue');

    const t = report.tools;
    if (t.added.length) log(`\n➕ Tools added: ${t.added.join(', ')}`, 'green');
    if (t.removed.length) log(`➖ Tools removed: ${t.removed.join(', ')}`, 'red');
    t.modified.forEach((m) => log(`🔧 Tool modified: ${m.id} (${m.fields.join(', ')})`, 'yellow'));

    const c = report.capabilities;
    if (c.added.length) log(`\n➕ Capabilities added: ${c.added.join(', ')}`, 'green');
    if (c.removed.length) log(`➖ Capabilities removed: ${c.removed.join(', ')}`, 'red');
    c.modified.forEach((m) => log(`💡 Capability modified: ${m.id} (${m.fields.join(', ')})`, 'yellow'));

    if (report.permissions_changed) log('\n🔒 Permissions changed — review who can execute what', 'yellow');

    if (breaking) {
      log('\n🚨 BREAKING CHANGES:', 'red');
      report.breaking_changes.forEach((b) => log(`  • ${b}`, 'red'));
      log('\nAgents relying on the old catalog may break. Bump the major version.', 'yellow');
    } else {
      log('\n✅ No breaking changes detected.', 'green');
    }

    process.exit(0);
  } catch (error) {
    log(`❌ Diff error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function runTokens(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ File not found: ${filePath}`, 'red');
      process.exit(1);
    }
    const { meterCatalog, bar } = require('./tokens');
    const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const meter = meterCatalog(catalog);

    if (flags.json) {
      console.log(JSON.stringify(meter, null, 2));
      process.exit(0);
    }

    header('Token Usage Meter');
    log(`Catalog: ${catalog.name} v${catalog.version}`, 'blue');
    log(`\n📊 Total: ~${meter.total.toLocaleString()} tokens when loaded into agent context\n`, 'bold');

    log('Context window budget:', 'blue');
    meter.budgets.forEach((b) => {
      const color = b.percent < 40 ? 'green' : b.percent < 75 ? 'yellow' : 'red';
      log(`  ${bar(b.percent)} ${String(b.percent).padStart(6)}%  ${b.window}`, color);
    });

    log('\nBy section:', 'blue');
    Object.entries(meter.sections)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => log(`  ${k.padEnd(14)} ~${v} tokens`));

    if (meter.perTool.length > 0) {
      log('\nHeaviest tools:', 'blue');
      meter.perTool.slice(0, 10).forEach((t) => {
        log(`  ${t.id.padEnd(28)} ~${t.tokens} tokens${t.exampleTokens ? ` (${t.exampleTokens} in examples)` : ''}`);
      });
    }

    if (meter.warnings.length) {
      log('\n⚠️  Warnings:', 'yellow');
      meter.warnings.forEach((w) => log(`  • ${w}`, 'yellow'));
    }
    if (meter.suggestions.length) {
      log('\n💡 Suggestions:', 'blue');
      meter.suggestions.forEach((s) => log(`  • ${s}`, 'blue'));
    }
    if (!meter.warnings.length && !meter.suggestions.length) {
      log('\n✅ Lean catalog. Agents will thank you.', 'green');
    }
    log('');
    process.exit(0);
  } catch (error) {
    log(`❌ Tokens error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function runImport(format, specPath, outPath) {
  try {
    if (format !== 'openapi') {
      log(`❌ Unknown import format "${format}". Supported: openapi`, 'red');
      process.exit(1);
    }
    if (!specPath || !fs.existsSync(specPath)) {
      log(`❌ Spec file not found: ${specPath}`, 'red');
      process.exit(1);
    }
    const { importOpenApi } = require('./convert');
    const { catalog, stats } = importOpenApi(specPath);
    const output = outPath || 'ai-catalog.json';
    fs.writeFileSync(output, JSON.stringify(catalog, null, 2));

    if (flags.json) {
      console.log(JSON.stringify({ ok: true, output, stats }, null, 2));
      process.exit(0);
    }

    header('OpenAPI → AI Catalog Import');
    log(`✅ Imported ${stats.tools} tools and ${stats.capabilities} capabilities from OpenAPI ${stats.source_version}`, 'green');
    log(`📄 Saved to: ${output}`, 'green');
    log('\n⚠️  Review before publishing:', 'yellow');
    log('  • repository.url is a placeholder — set your real repo', 'yellow');
    log('  • DELETE endpoints were marked requires_approval:true and ai_safe:false — adjust as needed', 'yellow');
    log('  • Add examples to your most-used tools (agents learn from them)', 'yellow');
    log(`\nNext: ai-catalog lint ${output}`, 'blue');
    process.exit(0);
  } catch (error) {
    log(`❌ Import error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function runExport(format, catalogPath, outPath) {
  try {
    if (format !== 'openapi') {
      log(`❌ Unknown export format "${format}". Supported: openapi`, 'red');
      process.exit(1);
    }
    if (!catalogPath || !fs.existsSync(catalogPath)) {
      log(`❌ Catalog not found: ${catalogPath}`, 'red');
      process.exit(1);
    }
    const { exportOpenApi } = require('./convert');
    const { spec, stats } = exportOpenApi(catalogPath);
    const output = outPath || 'openapi.json';
    fs.writeFileSync(output, JSON.stringify(spec, null, 2));

    if (flags.json) {
      console.log(JSON.stringify({ ok: true, output, stats }, null, 2));
      process.exit(0);
    }

    header('AI Catalog → OpenAPI Export');
    log(`✅ Exported ${stats.exported} API tools to OpenAPI 3.0.3`, 'green');
    if (stats.skipped.length) {
      log(`⚠️  Skipped non-API tools: ${stats.skipped.join(', ')}`, 'yellow');
    }
    log(`📄 Saved to: ${output}`, 'green');
    log('\nNote: ai-catalog safety fields exported as x-ai-safe / x-requires-approval extensions.', 'blue');
    process.exit(0);
  } catch (error) {
    log(`❌ Export error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function runServe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`❌ File not found: ${filePath}`, 'red');
      process.exit(1);
    }
    const { serveCatalog } = require('./serve');
    const portFlag = rawArgs.find((a) => a.startsWith('--port='));
    const port = portFlag ? parseInt(portFlag.split('=')[1], 10) : 4747;
    const { port: boundPort } = await serveCatalog(filePath, port);

    header('AI Catalog Explorer');
    log(`🌐 Explorer:      http://localhost:${boundPort}/`, 'green');
    log(`🤖 Agent JSON:    http://localhost:${boundPort}/ai-catalog.json`, 'blue');
    log(`🧮 Token report:  http://localhost:${boundPort}/tokens.json`, 'blue');
    log('\nCtrl+C to stop.', 'cyan');
  } catch (error) {
    log(`❌ Serve error: ${error.message}`, 'red');
    process.exit(1);
  }
}

const command = args[0];
const arg = args[1] || 'ai-catalog.json';

switch (command) {
  case 'validate':
    validateCatalog(arg);
    break;
  case 'generate':
    generateCatalog(arg);
    break;
  case 'schema':
    displaySchema();
    break;
  case 'test':
    testCatalog(arg);
    break;
  case 'lint':
    runLint(arg);
    break;
  case 'diff':
    runDiff(args[1], args[2]);
    break;
  case 'tokens':
    runTokens(arg);
    break;
  case 'import':
    runImport(args[1], args[2], args[3]);
    break;
  case 'export':
    runExport(args[1], args[2], args[3]);
    break;
  case 'serve':
    runServe(arg);
    break;
  default:
    log('\n🤖 AI Catalog CLI Tool\n', 'cyan');
    log('Commands:', 'bold');
    log('  validate <path>              Validate an ai-catalog.json file');
    log('  lint <path>                  Safety & style checks beyond schema validation');
    log('  diff <old> <new>             Compare two catalogs; flags breaking changes');
    log('  tokens <path>                Token usage meter — context window cost report');
    log('  import openapi <spec> [out]  Convert an OpenAPI spec to ai-catalog.json');
    log('  export openapi <cat> [out]   Convert ai-catalog.json to an OpenAPI spec');
    log('  serve <path>                 Launch web explorer with visual token meter');
    log('  generate [path]              Interactively generate a new catalog');
    log('  test <path>                  Run quality tests on a catalog');
    log('  schema                       Display the JSON schema\n');
    log('Flags:', 'bold');
    log('  --json                       Machine-readable output (for agents & scripts)');
    log('  --verbose                    Extra detail in error output');
    log('  --port=<n>                   Port for serve (default 4747)\n');
    log('Examples:', 'bold');
    log('  npx ai-catalog import openapi ./openapi.yaml ./ai-catalog.json');
    log('  npx ai-catalog tokens ./ai-catalog.json');
    log('  npx ai-catalog serve ./ai-catalog.json\n');
    process.exit(0);
}
