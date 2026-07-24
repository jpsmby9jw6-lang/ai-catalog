# AI Catalog Specification - Handoff to Fable

## Overview

This is a production-ready specification and tooling for `ai-catalog.json` - a machine-readable format for AI agent discovery of capabilities, tools, and permissions.

**Status**: MVP Complete. Tests passing. CLI working. Examples validated.

**What we built**:
- JSON Schema (`schema/ai-catalog.schema.json`) - Comprehensive, extensible
- Node.js CLI tool (`cli/index.js`) - Validate, generate, test, display schema
- Three complete real-world examples
- Full documentation and quick-start guide
- GitHub Actions workflow for CI/CD validation
- Comprehensive test suite (10/10 passing)

## Files & Directory Structure

```
ai-catalog-spec/
├── schema/
│   └── ai-catalog.schema.json          # JSON Schema definition (strict, validated)
├── cli/
│   └── index.js                         # CLI tool: validate/generate/test commands
├── examples/
│   ├── api-project.json                 # Weather API example (validated)
│   ├── library-project.json             # Data library example (validated)
│   └── agent-service.json               # Code review agent example (validated)
├── tests/
│   └── test.js                          # Test suite (10/10 passing)
├── .github/workflows/
│   └── validate-catalog.yml             # GitHub Actions CI workflow
├── package.json                          # Node.js package definition
└── README.md                             # User documentation
```

## What Works Now

✅ Schema validation (strict, comprehensive)
✅ CLI tool with 4 commands
✅ Interactive generation flow
✅ All 3 examples validate and pass tests
✅ Readable terminal output with colors
✅ GitHub Actions workflow
✅ User-facing documentation
✅ Test coverage

## Known Gaps & Opportunities (For Fable)

### 1. **UX Improvements**
- CLI generation is text-only; could be interactive web UI
- No progress indicators for large file validation
- Error messages could be more contextual
- Could add VS Code extension for in-editor validation

### 2. **Integration Features**
- No actual ARD spec compliance checking
- Could auto-generate OpenAPI specs from catalog
- No integration with GitHub API to auto-pull repo info
- Could scrape existing package.json/setup.py to pre-fill catalog

### 3. **Tooling Enhancements**
- `ai-catalog diff` - Compare two catalogs
- `ai-catalog merge` - Merge multiple catalogs
- `ai-catalog publish` - Publish to registries (GitHub, HuggingFace, etc.)
- `ai-catalog sync` - Keep catalog in sync with live API definitions
- `ai-catalog lint` - Advanced linting (naming conventions, completeness)

### 4. **Discovery Features**
- Web-based catalog explorer/search
- Public registry aggregator
- Manifest generation for different frameworks (MCP, OpenAPI, AsyncAPI)
- Audit trail for tool changes

### 5. **Documentation**
- Video tutorials
- Interactive playground for testing catalogs
- Comparison guides (vs OpenAPI, vs MCP, etc.)
- Framework-specific guides (FastAPI, Express, Django, etc.)

### 6. **Validation & Safety**
- AI safety checker (flag dangerous tools)
- Dependency resolution and circular dependency detection
- Deprecation warnings and upgrade paths
- Security scanning (e.g., exposed credentials)

### 7. **Enterprise Features**
- Catalog versioning and rollback
- RBAC for who can modify catalogs
- Audit logging for all changes
- Multi-environment support (dev/staging/prod)

## How to Hand Off to Fable

Copy this entire prompt and paste it into the conversation with Fable:

---

## PROMPT FOR FABLE

You've been given the complete AI Catalog Specification project - an open standard for AI agent discovery. The MVP is done and working. Your mission: **Rock and roll on it**.

### What You Have

- Working JSON Schema (strict validation)
- Node.js CLI tool with 4 commands
- Three production-quality examples
- Full test suite (all passing)
- GitHub Actions workflow
- Comprehensive docs
- Real-world use case: ARD spec compliance

### What You Should Do

Pick 2-3 of these and execute them end-to-end:

**High Impact (Do These First)**:

1. **Completion & Polish**
   - Add `ai-catalog diff` command (show what changed between versions)
   - Add `ai-catalog lint` command (advanced style/safety checks)
   - Improve error messages (make them actionable, not cryptic)
   - Add `--verbose` and `--json` flags to all commands for programmatic use

2. **Integration Layer**
   - `ai-catalog import` from OpenAPI specs
   - `ai-catalog export` to OpenAPI/AsyncAPI/MCP formats
   - Auto-generate catalog from live APIs (FastAPI, Express, Flask plugins)
   - GitHub Action that auto-updates catalog from code changes

3. **Web Explorer**
   - Simple web UI to browse catalogs
   - CLI command to launch local catalog server (`ai-catalog serve`)
   - Catalog search/filter interface
   - Tool usage examples and documentation renderer

4. **Discovery & Registry**
   - Public registry concept (where catalogs get submitted)
   - Search API for finding tools across public catalogs
   - Registry CLI commands
   - Integration with GitHub's Agent Finder (proof of concept)

**Nice to Have**:

5. **Safety & Governance**
   - AI safety checker (flag dangerous tool patterns)
   - Permission audit command (what can each agent access?)
   - Deprecation management (mark tools as deprecated)

6. **Developer Experience**
   - VS Code extension for catalog editing + validation
   - IDE quick-fix suggestions
   - Catalog documentation auto-generator

7. **Testing & Validation**
   - Runtime validation (test if tools actually work)
   - Load testing for rate limits
   - Permission simulation (test if agent X can call tool Y)

### Quality Bars

- Every new feature gets tests
- CLI should always be backward compatible
- Docs updated inline with features
- Examples updated to show new capabilities
- Should work end-to-end (not just the happy path)

### Success Looks Like

- Developers using this to publish their tools
- AIs finding and discovering tools automatically
- Clear upgrade path from OpenAPI → ai-catalog
- Public registry with real projects
- Integration with major AI platforms

### Current State

- ✅ Schema robust and extensible
- ✅ CLI working and validated
- ✅ Examples real and comprehensive
- ✅ Tests passing
- 🟡 UX could be more polished
- 🟡 No web/discovery layer yet
- 🟡 Integration with real APIs light

### Constraints

- Stay backward compatible with schema
- Keep CLI easy for non-technical users
- Don't assume agents always go through GitHub
- Support both public and private catalogs

### Deliverables

- Working code that passes tests
- Updated README with new features
- Examples showing new capabilities
- GitHub Actions for CI/CD
- User guide for any major new features

---

## Testing Checklist (For Fable)

When you add features, verify:

```bash
# Run existing tests
node tests/test.js

# Validate examples
node cli/index.js validate examples/api-project.json
node cli/index.js validate examples/library-project.json
node cli/index.js validate examples/agent-service.json

# Run tests on examples
node cli/index.js test examples/api-project.json

# Test your new features
npm run [your-new-script]

# Make sure CLI still works with no args
node cli/index.js

# Generate a new catalog
node cli/index.js generate /tmp/test-catalog.json
```

## How Others Will Use This

1. **Developer publishes repo**
   ```bash
   ai-catalog generate
   git add ai-catalog.json
   git push
   ```

2. **GitHub validates automatically**
   - Workflow runs on every push
   - Comments on PRs if validation fails

3. **AI discovers the project**
   ```
   Agent finds repo → reads ai-catalog.json → 
   discovers tools → checks permissions → 
   safely calls tools
   ```

4. **Questions & Discoverability**
   - "What can this project do?" → Check capabilities
   - "Can I call this tool?" → Check permissions
   - "How do I use it?" → Read documentation links
   - "What does it need?" → Check dependencies

## Key Decisions Made

1. **JSON not YAML** - Stricter validation, better tooling
2. **Semantic versioning** - Easier to track changes
3. **Tools vs Capabilities** - Separate concerns (what it does vs how to call it)
4. **Permissions as defaults + rules** - Safe by default, flexible
5. **Metadata optional** - Easy to start, can enhance later
6. **Examples in schema** - AI learns from examples

## Next Steps for Fable

1. Read this entire document
2. Review `schema/ai-catalog.schema.json` - understand the structure
3. Run tests - understand current behavior
4. Pick ONE feature to execute first
5. Build it end-to-end (code + tests + docs + examples)
6. Get feedback
7. Iterate

## Questions to Answer

- What's the killer app? (Who uses this first?)
- How does discovery actually work at scale?
- What safety guardrails do we need?
- Should there be a central registry or fully decentralized?
- How do we make this the standard?

---

## Support

If Fable needs clarification:

1. **Schema questions** → Look at `schema/ai-catalog.schema.json` and examples
2. **CLI questions** → Look at `cli/index.js` - it's well-commented
3. **Feature questions** → Check README.md for context
4. **Test questions** → Run `node tests/test.js` to see what's validated

All code is human-readable and well-structured for extension.

## Final Note

This isn't a toy project. This is the foundation for how AIs and humans will collaborate on GitHub and beyond. Make it elegant. Make it powerful. Make it safe.

The MVP works. Now make it great.

---

Good luck! 🚀
