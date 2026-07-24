#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const schemaPath = path.join(__dirname, '../schema/ai-catalog.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, formats: { uri: true, 'date-time': true } });
const validate = ajv.compile(schema);

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

function runTests() {
  let passed = 0;
  let failed = 0;

  log('\n' + '='.repeat(60), 'cyan');
  log('AI Catalog Specification Tests', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  // Test 1: Schema is valid JSON Schema
  log('Test 1: Schema is valid JSON Schema', 'blue');
  try {
    const schemaValidator = new Ajv({ formats: { uri: true, 'date-time': true } }).compile(schema);
    log('  ✅ Passed', 'green');
    passed++;
  } catch (e) {
    log(`  ❌ Failed: ${e.message}`, 'red');
    failed++;
  }

  // Test 2: Validate minimal catalog
  log('\nTest 2: Minimal catalog validation', 'blue');
  const minimal = {
    version: '1.0.0',
    name: 'Test Project',
    repository: {
      url: 'https://github.com/test/repo',
    },
  };
  if (validate(minimal)) {
    log('  ✅ Passed', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
    failed++;
  }

  // Test 3: Validate full catalog (API example)
  log('\nTest 3: Full API catalog validation', 'blue');
  try {
    const apiCatalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../examples/api-project.json'), 'utf8')
    );
    if (validate(apiCatalog)) {
      log('  ✅ Passed', 'green');
      passed++;
    } else {
      log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
      failed++;
    }
  } catch (e) {
    log(`  ❌ Failed: ${e.message}`, 'red');
    failed++;
  }

  // Test 4: Validate library catalog
  log('\nTest 4: Library catalog validation', 'blue');
  try {
    const libraryCatalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../examples/library-project.json'), 'utf8')
    );
    if (validate(libraryCatalog)) {
      log('  ✅ Passed', 'green');
      passed++;
    } else {
      log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
      failed++;
    }
  } catch (e) {
    log(`  ❌ Failed: ${e.message}`, 'red');
    failed++;
  }

  // Test 5: Validate agent/service catalog
  log('\nTest 5: Agent/Service catalog validation', 'blue');
  try {
    const agentCatalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../examples/agent-service.json'), 'utf8')
    );
    if (validate(agentCatalog)) {
      log('  ✅ Passed', 'green');
      passed++;
    } else {
      log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
      failed++;
    }
  } catch (e) {
    log(`  ❌ Failed: ${e.message}`, 'red');
    failed++;
  }

  // Test 6: Reject invalid version
  log('\nTest 6: Reject invalid version format', 'blue');
  const invalidVersion = {
    version: 'not-a-version',
    name: 'Test',
    repository: { url: 'https://github.com/test/repo' },
  };
  if (!validate(invalidVersion)) {
    log('  ✅ Passed (correctly rejected)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed (should have rejected)`, 'red');
    failed++;
  }

  // Test 7: Reject missing required fields
  log('\nTest 7: Reject missing required fields', 'blue');
  const missingName = {
    version: '1.0.0',
    repository: { url: 'https://github.com/test/repo' },
  };
  if (!validate(missingName)) {
    log('  ✅ Passed (correctly rejected)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed (should have rejected)`, 'red');
    failed++;
  }

  // Test 8: Validate tool with all fields
  log('\nTest 8: Validate tool with complete fields', 'blue');
  const completeTool = {
    version: '1.0.0',
    name: 'Complete Tool Test',
    repository: { url: 'https://github.com/test/repo' },
    tools: [
      {
        id: 'complete_tool',
        name: 'Complete Tool',
        type: 'api',
        endpoint: 'https://example.com/tool',
        inputs: { type: 'object', properties: { input: { type: 'string' } } },
        outputs: { type: 'object' },
        examples: [{ input: { input: 'test' }, output: {} }],
        requires_approval: false,
        rate_limit: { requests_per_minute: 60 },
        auth: 'api_key',
        ai_safe: true,
      },
    ],
  };
  if (validate(completeTool)) {
    log('  ✅ Passed', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
    failed++;
  }

  // Test 9: Validate permissions structure
  log('\nTest 9: Validate permissions structure', 'blue');
  const withPermissions = {
    version: '1.0.0',
    name: 'Permissions Test',
    repository: { url: 'https://github.com/test/repo' },
    permissions: {
      default_access: 'read',
      agent_rules: [
        {
          agent_pattern: 'claude-*',
          access: 'execute',
          allowed_tools: ['tool1', 'tool2'],
          human_approval_required: false,
        },
      ],
    },
  };
  if (validate(withPermissions)) {
    log('  ✅ Passed', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
    failed++;
  }

  // Test 10: Metadata and documentation
  log('\nTest 10: Validate metadata and documentation', 'blue');
  const withMetadata = {
    version: '1.0.0',
    name: 'Metadata Test',
    repository: { url: 'https://github.com/test/repo' },
    documentation: {
      main: 'https://example.com/docs',
      quickstart: 'https://example.com/docs/quickstart',
      api_spec: 'https://example.com/api',
      examples_dir: 'examples/',
    },
    metadata: {
      maintained: true,
      maturity: 'stable',
      last_updated: new Date().toISOString(),
      contact: 'support@example.com',
      tags: ['api', 'data', 'tools'],
    },
  };
  if (validate(withMetadata)) {
    log('  ✅ Passed', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(validate.errors)}`, 'red');
    failed++;
  }

  // --- New feature tests: lint & diff ---
  const { lintCatalog } = require('../cli/lint');
  const { diffCatalogs } = require('../cli/diff');

  // Test 11: Lint catches unsafe tool without approval gate
  log('\nTest 11: Lint flags ai_safe:false without requires_approval', 'blue');
  const unsafeCatalog = {
    version: '1.0.0',
    name: 'Unsafe Test',
    repository: { url: 'https://github.com/test/repo' },
    tools: [{ id: 'delete_everything', name: 'Delete', type: 'api', ai_safe: false, requires_approval: false, description: 'Deletes all the things immediately' }],
  };
  const lintResult1 = lintCatalog(unsafeCatalog);
  if (lintResult1.errors.some((e) => e.includes('ai_safe:false'))) {
    log('  ✅ Passed (correctly flagged)', 'green');
    passed++;
  } else {
    log('  ❌ Failed (should flag unsafe tool)', 'red');
    failed++;
  }

  // Test 12: Lint catches permission rules referencing unknown tools
  log('\nTest 12: Lint flags permission rules with unknown tool refs', 'blue');
  const badPermCatalog = {
    version: '1.0.0',
    name: 'Bad Perms',
    repository: { url: 'https://github.com/test/repo' },
    tools: [{ id: 'real_tool', name: 'Real', type: 'function', description: 'A tool that actually exists here' }],
    permissions: {
      default_access: 'read',
      agent_rules: [{ agent_pattern: 'claude-*', access: 'execute', allowed_tools: ['ghost_tool'] }],
    },
  };
  const lintResult2 = lintCatalog(badPermCatalog);
  if (lintResult2.errors.some((e) => e.includes('ghost_tool'))) {
    log('  ✅ Passed (correctly flagged)', 'green');
    passed++;
  } else {
    log('  ❌ Failed (should flag unknown tool reference)', 'red');
    failed++;
  }

  // Test 13: Lint passes clean catalog with no errors
  log('\nTest 13: Lint gives no errors on valid API example', 'blue');
  const apiCat = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/api-project.json'), 'utf8'));
  const lintResult3 = lintCatalog(apiCat);
  if (lintResult3.errors.length === 0) {
    log('  ✅ Passed (no lint errors)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(lintResult3.errors)}`, 'red');
    failed++;
  }

  // Test 14: Diff detects added/removed/modified tools + breaking changes
  log('\nTest 14: Diff detects tool changes and breaking changes', 'blue');
  const oldCat = {
    version: '1.0.0',
    name: 'Diff Test',
    repository: { url: 'https://github.com/test/repo' },
    tools: [
      { id: 'keep_me', name: 'Keep', type: 'function' },
      { id: 'remove_me', name: 'Remove', type: 'function' },
    ],
  };
  const newCat = {
    version: '1.1.0',
    name: 'Diff Test',
    repository: { url: 'https://github.com/test/repo' },
    tools: [
      { id: 'keep_me', name: 'Keep', type: 'api', endpoint: 'https://x.com' },
      { id: 'add_me', name: 'Add', type: 'function' },
    ],
  };
  fs.writeFileSync('/tmp/diff-old.json', JSON.stringify(oldCat));
  fs.writeFileSync('/tmp/diff-new.json', JSON.stringify(newCat));
  const diffResult = diffCatalogs('/tmp/diff-old.json', '/tmp/diff-new.json');
  const r = diffResult.report;
  const diffOk =
    r.tools.added.includes('add_me') &&
    r.tools.removed.includes('remove_me') &&
    r.tools.modified.some((m) => m.id === 'keep_me') &&
    diffResult.breaking === true;
  if (diffOk) {
    log('  ✅ Passed (added, removed, modified, breaking all detected)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(r)}`, 'red');
    failed++;
  }

  // Test 15: Diff reports no changes for identical catalogs
  log('\nTest 15: Diff detects identical catalogs', 'blue');
  const sameDiff = diffCatalogs('/tmp/diff-old.json', '/tmp/diff-old.json');
  if (!sameDiff.hasChanges && !sameDiff.breaking) {
    log('  ✅ Passed (no changes)', 'green');
    passed++;
  } else {
    log('  ❌ Failed (should detect no changes)', 'red');
    failed++;
  }

  // --- New feature tests: tokens, convert, serve ---
  const { estimateTokens, meterCatalog } = require('../cli/tokens');
  const { importOpenApi, exportOpenApi } = require('../cli/convert');
  const { renderHtml } = require('../cli/serve');

  // Test 16: Token estimation is sane
  log('\nTest 16: Token estimation produces sane numbers', 'blue');
  const est = estimateTokens('The quick brown fox jumps over the lazy dog.');
  if (est >= 8 && est <= 16 && estimateTokens('') === 0) {
    log(`  ✅ Passed (~${est} tokens for 9-word sentence, 0 for empty)`, 'green');
    passed++;
  } else {
    log(`  ❌ Failed (got ${est}, expected 8-16)`, 'red');
    failed++;
  }

  // Test 17: Meter produces breakdown consistent with total
  log('\nTest 17: Token meter sections + per-tool breakdown', 'blue');
  const meterCat = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/api-project.json'), 'utf8'));
  const meter = meterCatalog(meterCat);
  const sectionSum = Object.values(meter.sections).reduce((a, b) => a + b, 0);
  const meterOk =
    meter.total > 0 &&
    meter.perTool.length === meterCat.tools.length &&
    meter.budgets.length === 3 &&
    Math.abs(sectionSum - meter.total) <= meter.total * 0.15; // sections ≈ total
  if (meterOk) {
    log(`  ✅ Passed (total ~${meter.total}, ${meter.perTool.length} tools metered)`, 'green');
    passed++;
  } else {
    log(`  ❌ Failed: total=${meter.total} sectionSum=${sectionSum}`, 'red');
    failed++;
  }

  // Test 18: Meter warns on heavy catalogs
  log('\nTest 18: Token meter warns on heavy catalogs', 'blue');
  const bloated = {
    version: '1.0.0',
    name: 'Bloated',
    repository: { url: 'https://github.com/test/repo' },
    tools: [{ id: 'huge_tool', name: 'Huge', type: 'function', description: 'x'.repeat(8000) }],
  };
  const bloatMeter = meterCatalog(bloated);
  if (bloatMeter.warnings.length > 0) {
    log('  ✅ Passed (heavy catalog flagged)', 'green');
    passed++;
  } else {
    log('  ❌ Failed (should warn on 8000-char tool)', 'red');
    failed++;
  }

  // Test 19: OpenAPI import produces a valid catalog with safety heuristics
  log('\nTest 19: OpenAPI import → valid catalog with safety defaults', 'blue');
  const miniSpec = {
    openapi: '3.0.3',
    info: { title: 'Mini API', version: '1.0.0' },
    servers: [{ url: 'https://mini.example.com' }],
    paths: {
      '/things': {
        get: { operationId: 'listThings', summary: 'List things', responses: { 200: { description: 'ok' } } },
        delete: { operationId: 'deleteThings', summary: 'Delete all things', responses: { 200: { description: 'ok' } } },
      },
    },
  };
  fs.writeFileSync('/tmp/mini-spec.json', JSON.stringify(miniSpec));
  const imported = importOpenApi('/tmp/mini-spec.json');
  const delTool = imported.catalog.tools.find((t) => t.id === 'delete_things');
  const importOk =
    validate(imported.catalog) &&
    imported.catalog.tools.length === 2 &&
    delTool &&
    delTool.ai_safe === false &&
    delTool.requires_approval === true;
  if (importOk) {
    log('  ✅ Passed (valid catalog, DELETE gated on approval)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(validate.errors || delTool)}`, 'red');
    failed++;
  }

  // Test 20: OpenAPI export round-trip preserves tool identity
  log('\nTest 20: Catalog → OpenAPI export round-trip', 'blue');
  const exported = exportOpenApi(path.join(__dirname, '../examples/api-project.json'));
  const opIds = Object.values(exported.spec.paths).flatMap((m) => Object.values(m).map((op) => op.operationId));
  const exportOk =
    exported.spec.openapi === '3.0.3' &&
    exported.stats.exported === 2 &&
    opIds.includes('get_current_weather') &&
    opIds.includes('get_forecast');
  if (exportOk) {
    log('  ✅ Passed (2 tools exported with matching operationIds)', 'green');
    passed++;
  } else {
    log(`  ❌ Failed: ${JSON.stringify(exported.stats)}`, 'red');
    failed++;
  }

  // Test 21: Serve renders explorer HTML with token meter
  log('\nTest 21: Web explorer renders with token meter', 'blue');
  const serveCat = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/agent-service.json'), 'utf8'));
  const html = renderHtml(serveCat, meterCatalog(serveCat), 'agent-service.json');
  const htmlOk =
    html.includes('Token Usage Meter') &&
    html.includes('CodeReview Agent') &&
    html.includes('/ai-catalog.json') &&
    html.includes('review_pull_request') &&
    !html.includes('<script src='); // no external deps
  if (htmlOk) {
    log('  ✅ Passed (meter, tools, agent link, zero external deps)', 'green');
    passed++;
  } else {
    log('  ❌ Failed (missing expected sections in HTML)', 'red');
    failed++;
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log(`Results: ${passed} passed, ${failed} failed`, 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  if (failed === 0) {
    log('✅ All tests passed!', 'green');
    process.exit(0);
  } else {
    log('❌ Some tests failed', 'red');
    process.exit(1);
  }
}

runTests();
