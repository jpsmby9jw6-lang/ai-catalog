# AI Catalog Specification

**The missing layer between humans and AI agents.**

Make your repository discoverable to AI agents with a single `ai-catalog.json` file.

## What is This?

An open specification for publishing machine-readable catalogs of your project's capabilities, tools, and APIs. This lets AI agents autonomously discover what your project does, what it can execute, and whether they're allowed to use it—without manual configuration or guesswork.

Think of it as `robots.txt` for AI agents, but for capability discovery instead of crawling.

## Problem

Today, when an AI agent encounters a GitHub repository, it:
- Reads README.md and hopes it's comprehensive
- Guesses which functions are "safe" to call
- Has no idea about rate limits or authentication
- Can't distinguish between public and restricted tools
- Needs human intervention to connect to anything

This breaks down at scale. With millions of repos and agents, we need a standard.

## Solution

Add one file to your repository root:

```json
{
  "version": "1.0.0",
  "name": "My Project",
  "capabilities": [
    { "id": "weather", "name": "Weather Data", "category": "api" }
  ],
  "tools": [
    {
      "id": "get_weather",
      "name": "Get Current Weather",
      "type": "api",
      "endpoint": "https://api.example.com/weather",
      "inputs": { ... },
      "outputs": { ... },
      "ai_safe": true
    }
  ],
  "permissions": { ... },
  "documentation": { ... }
}
```

Now:
- 🤖 AI agents can discover your tools
- 🔒 You control who accesses what
- 📊 Usage is auditable
- 🚀 Integration is instant

## Quick Start

### 1. Install the CLI

```bash
npm install -g ai-catalog
```

### 2. Generate Your Catalog

```bash
ai-catalog generate ai-catalog.json
```

This launches an interactive wizard:

```
Project name: My Weather API
Description: Real-time weather data
Repository URL: https://github.com/user/weather-api
Does this project expose tools/APIs? yes
Add capabilities...
Add tools...
```

### 3. Validate

```bash
ai-catalog validate ai-catalog.json
```

Output:
```
============================================================
AI Catalog Validator
============================================================

✅ Catalog is valid!

📋 Summary:
  Name: My Weather API
  Version: 1.0.0
  Capabilities: 3
  Tools: 5
  Repository: https://github.com/user/weather-api
  Maturity: stable

🔧 Available Tools:
  • Get Current Weather [api_key]
  • Get Forecast
  • Get Historical Data ⚠️ approval

💡 Capabilities:
  • Current Weather Data
  • Weather Forecasts
  • Historical Climate Data

✨ Catalog ready for AI discovery!
```

### 4. Commit to Your Repo

```bash
git add ai-catalog.json
git commit -m "Add AI catalog for agent discoverability"
git push
```

AI agents can now find and use your tools.

## Core Concepts

### Capabilities

High-level things your project can do. Think of these as the "why" someone would use your project.

```json
"capabilities": [
  {
    "id": "weather_forecasting",
    "name": "Weather Forecasting",
    "description": "Predict weather conditions for any location",
    "category": "api"
  }
]
```

### Tools

Specific, executable actions. The "how"—what agents can actually call.

```json
"tools": [
  {
    "id": "get_forecast",
    "name": "Get Weather Forecast",
    "type": "api",
    "endpoint": "https://api.weather.com/forecast",
    "inputs": { "location": "string", "days": "integer" },
    "outputs": { "forecast": "array" },
    "ai_safe": true,
    "requires_approval": false,
    "rate_limit": { "requests_per_minute": 60 }
  }
]
```

### Permissions

Declare who can access what. Default is read-only; you opt into execution.

```json
"permissions": {
  "default_access": "read",
  "agent_rules": [
    {
      "agent_pattern": "claude-*",
      "access": "read",
      "allowed_tools": ["get_forecast", "get_current_weather"]
    },
    {
      "agent_pattern": "copilot",
      "access": "execute",
      "allowed_tools": ["get_current_weather"],
      "human_approval_required": true
    }
  ]
}
```

## Schema Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | ✅ | Semantic version (e.g., "1.0.0") |
| `name` | string | ✅ | Project name |
| `description` | string | ❌ | What this project does |
| `repository` | object | ✅ | GitHub repo URL and default branch |
| `capabilities` | array | ❌ | High-level capabilities |
| `tools` | array | ❌ | Executable tools/functions |
| `permissions` | object | ❌ | Access control rules |
| `dependencies` | array | ❌ | Other projects/services needed |
| `documentation` | object | ❌ | Links to docs, examples, API specs |
| `metadata` | object | ❌ | Maintenance status, maturity, contact |

### Tool Object Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | | Unique machine ID (e.g., "get_weather") |
| `name` | string | | Human-readable name |
| `description` | string | | What it does and when to use it |
| `type` | string | | One of: `function`, `api`, `cli`, `mcp`, `webhook`, `script` |
| `endpoint` | string | | URL, path, or invocation address |
| `inputs` | object | | Expected input parameters |
| `outputs` | object | | Return value schema |
| `examples` | array | | Real usage examples for AI learning |
| `requires_approval` | boolean | `false` | Must humans approve before execution? |
| `rate_limit` | object | | Requests per minute/hour limits |
| `auth` | string | `"none"` | Auth type: `none`, `api_key`, `oauth`, `bearer_token`, `basic` |
| `ai_safe` | boolean | `true` | Safe for autonomous AI calls? |

## Real-World Examples

We've included three complete examples:

### 1. API Project (`examples/api-project.json`)
Weather API with multiple endpoints, rate limiting, and documentation.

### 2. Library Project (`examples/library-project.json`)
Python data library with function signatures, examples, and dependencies.

### 3. Service/Agent (`examples/agent-service.json`)
Autonomous service with permission rules and approval gates.

Run validation on any:
```bash
ai-catalog validate examples/api-project.json
ai-catalog test examples/library-project.json
```

## Usage in GitHub Actions

Add automatic validation to your CI/CD:

```yaml
# .github/workflows/validate-catalog.yml
name: Validate AI Catalog

on:
  push:
    paths: ['ai-catalog.json']
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install ai-catalog
      - run: npx ai-catalog validate ./ai-catalog.json
      - run: npx ai-catalog test ./ai-catalog.json
```

We include a ready-to-use workflow in `.github/workflows/validate-catalog.yml`.

## Best Practices

### 1. Keep It Current

Update `last_updated` in metadata whenever you change tools or permissions:

```json
"metadata": {
  "last_updated": "2026-07-22T15:30:00Z"
}
```

### 2. Document Examples

Real examples help AI agents understand what you expect:

```json
"tools": [{
  "examples": [
    {
      "input": { "location": "San Francisco", "units": "imperial" },
      "output": { "temperature": 72, "condition": "Cloudy" }
    }
  ]
}]
```

### 3. Be Explicit About Safety

Mark tools that require human review:

```json
{
  "id": "delete_user",
  "ai_safe": false,
  "requires_approval": true,
  "description": "Delete a user account. REQUIRES HUMAN APPROVAL."
}
```

### 4. Version Your API

Include API version in endpoints and track breaking changes:

```json
"endpoint": "https://api.example.com/v1/weather"
```

### 5. Provide Contact Info

Let humans reach you if there are issues:

```json
"metadata": {
  "contact": "support@example.com"
}
```

### 6. Use Clear IDs

Machine-readable IDs should be snake_case and descriptive:

```json
"id": "get_current_weather_by_city"  // ✅ good
"id": "weather"                       // ❌ too vague
```

## Permissions Deep Dive

Control precisely what agents can do:

### Default to Read-Only

```json
"permissions": {
  "default_access": "read"
}
```

New agents can discover your tools but can't execute them.

### Allow Specific Agents

```json
"agent_rules": [
  {
    "agent_pattern": "claude-sonnet-5",
    "access": "execute",
    "allowed_tools": ["get_weather", "get_forecast"]
  }
]
```

Patterns support wildcards: `claude-*`, `gpt-*`, `gemini-*`.

### Require Human Approval

```json
{
  "agent_pattern": "*",
  "access": "execute",
  "human_approval_required": true
}
```

All agents can call tools, but only after human review.

### Restrict Specific Tools

```json
{
  "agent_pattern": "copilot",
  "access": "execute",
  "allowed_tools": ["read_only_tool"],
  "denied_tools": ["dangerous_tool"]
}
```

## Integrating with ARD (Agentic Resource Discovery)

This spec is designed to work alongside the ARD specification released by Google and Microsoft. ARD defines how catalogs are *discovered* across the web; this spec defines what's *in* each catalog.

Your `ai-catalog.json` becomes discoverable via:
- GitHub's Agent Finder (Copilot)
- Hugging Face Discovery
- Google Cloud Agent Registry
- Custom internal registries

## Testing Your Catalog

```bash
ai-catalog test ai-catalog.json
```

This validates:
- ✅ Valid JSON structure
- ✅ Required fields present
- ✅ Tools properly configured
- ✅ Capabilities documented
- ✅ Documentation links present
- ✅ Metadata completeness

Output shows pass/fail on each check.

### Token Usage Meter

Catalogs get injected into agent context windows — every token in your catalog is a token an agent pays on every load. `ai-catalog tokens` shows you the bill:

```
📊 Total: ~1,027 tokens when loaded into agent context

Context window budget:
  ███░░░░░░░░░░░░░░░░░░░░░  12.84%  8K (small local models)
  █░░░░░░░░░░░░░░░░░░░░░░░   3.21%  32K (mid-size models)
  ░░░░░░░░░░░░░░░░░░░░░░░░   0.51%  200K (frontier models)

Heaviest tools:
  get_current_weather   ~288 tokens (49 in examples)
  get_forecast          ~231 tokens
```

It warns when a single tool exceeds ~1,000 tokens or the whole catalog exceeds ~4,000, and suggests fixes (trim examples, split catalogs). Estimates are heuristic (~±10% vs real BPE tokenizers) — accurate enough for budgeting.

### OpenAPI Import / Export

Already have an OpenAPI spec? Convert it in one command:

```bash
# OpenAPI (JSON or YAML) → ai-catalog.json
ai-catalog import openapi ./openapi.yaml ./ai-catalog.json

# ai-catalog.json → OpenAPI 3.0.3
ai-catalog export openapi ./ai-catalog.json ./openapi.json
```

Import applies safety defaults automatically: **DELETE endpoints are marked `ai_safe: false` and `requires_approval: true`**, auth schemes are mapped (bearer/oauth/apiKey/basic), and tags become capabilities. Export preserves safety fields as `x-ai-safe` / `x-requires-approval` OpenAPI extensions so nothing is lost round-tripping.

### Web Explorer

```bash
ai-catalog serve ./ai-catalog.json          # default port 4747
ai-catalog serve ./ai-catalog.json --port=8080
```

Launches a zero-dependency local web UI with:

- **Visual token meter** — total cost, context-window budget bars, per-tool cost ranking
- **Tool browser** — searchable cards showing safety badges (✅ ai-safe / ⛔ not / 👤 approval), auth, rate limits, inputs, and examples
- **Permissions view** — who can execute what, at a glance
- **Agent endpoints** — raw catalog at `/ai-catalog.json`, token report at `/tokens.json`

Humans get visibility; agents get machine-readable endpoints. Same server, both audiences.

## CLI Commands

```bash
# Validate an existing catalog
ai-catalog validate <path>

# Safety & style linting (beyond schema validation)
ai-catalog lint <path>

# Compare two catalog versions; flags breaking changes
ai-catalog diff <old.json> <new.json>

# Token usage meter — what does this catalog cost an agent?
ai-catalog tokens <path>

# Convert OpenAPI spec (JSON/YAML) to ai-catalog.json
ai-catalog import openapi <spec> [output]

# Convert ai-catalog.json to OpenAPI 3.0.3
ai-catalog export openapi <catalog> [output]

# Launch local web explorer with visual token meter
ai-catalog serve <path> [--port=4747]

# Interactively generate a new catalog
ai-catalog generate [output-path]

# Run tests on a catalog
ai-catalog test <path>

# Display full JSON schema
ai-catalog schema
```

### Flags (all commands)

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable output — for agents, scripts, and CI pipelines |
| `--verbose` | Extra detail in error output |

### Linting

`ai-catalog lint` runs safety and quality heuristics that schema validation can't catch:

- 🚫 **Errors**: unsafe tools without approval gates, permission rules referencing nonexistent tools, duplicate tool IDs
- ⚠️ **Warnings**: destructive-sounding tools without safety flags, `http://` endpoints, wildcard execute permissions, stale catalogs (>180 days), missing descriptions
- 💡 **Suggestions**: missing examples, missing rate limits, missing tags/contact

Exit code is nonzero on errors — safe to use as a CI gate.

### Diffing

`ai-catalog diff` compares two catalog versions and reports:

- Tools/capabilities added, removed, or modified
- Permission changes
- **Breaking changes**: removed tools, changed inputs/endpoints/auth, tools newly marked unsafe
- Semver hygiene: warns when breaking changes ship without a major version bump

```
📦 Version: 1.0.0 → 1.1.0
➕ Tools added: get_air_quality
➖ Tools removed: get_forecast
🔧 Tool modified: get_current_weather (inputs)

🚨 BREAKING CHANGES:
  • Tool removed: get_forecast
  • Tool inputs changed: get_current_weather
  • Breaking changes detected but major version was not bumped
```

## Troubleshooting

### "Invalid JSON"
Check for trailing commas, missing quotes. Use:
```bash
cat ai-catalog.json | jq .
```

### "Missing required fields"
At minimum you need: `version`, `name`, `repository`.

### "Tool not found by agents"
Ensure:
1. `ai_safe: true` for autonomous calls
2. Tool is in `allowed_tools` for the agent pattern
3. File is named exactly `ai-catalog.json` in repo root
4. Repository is public

### "Rate limits not working"
Agents should respect `rate_limit` in tool definition, but enforcement depends on the agent implementation.

## Contributing

This spec evolves. Found an issue? Want to add a field?

Open an issue: [GitHub Issues](https://github.com/example/ai-catalog-spec)

## License

MIT

## Questions?

- 📖 Read the schema: `ai-catalog schema`
- 👀 See examples: `ls examples/`
- 🧪 Test your catalog: `ai-catalog test`
- 💬 Ask questions: Open a GitHub issue

---

**Made for humans. Built for AI. Specified for both.**
