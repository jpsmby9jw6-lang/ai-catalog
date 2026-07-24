// lint.js — Advanced linting for ai-catalog.json.
// Goes beyond schema validation: style, safety, and completeness heuristics.
// Exposed as: lintCatalog(catalog) -> { errors, warnings, info }

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const STALE_DAYS = 180;

function lintCatalog(catalog) {
  const errors = [];   // Should fix — likely to cause real problems for agents
  const warnings = []; // Recommended fixes
  const info = [];     // Suggestions

  const tools = catalog.tools || [];
  const caps = catalog.capabilities || [];

  // --- ID conventions ---
  tools.forEach((t) => {
    if (t.id && !SNAKE_CASE.test(t.id)) {
      warnings.push(`Tool id "${t.id}" is not snake_case (e.g., "get_current_weather")`);
    }
  });
  caps.forEach((c) => {
    if (c.id && !SNAKE_CASE.test(c.id)) {
      warnings.push(`Capability id "${c.id}" is not snake_case`);
    }
  });

  // --- Duplicate IDs ---
  const seen = new Set();
  tools.forEach((t) => {
    if (seen.has(t.id)) errors.push(`Duplicate tool id: "${t.id}"`);
    seen.add(t.id);
  });

  // --- Descriptions ---
  tools.forEach((t) => {
    if (!t.description) {
      warnings.push(`Tool "${t.id}" has no description — agents rely on this to decide when to use it`);
    } else if (t.description.length < 20) {
      info.push(`Tool "${t.id}" description is very short (${t.description.length} chars); more detail helps agents`);
    }
  });

  // --- Safety checks ---
  tools.forEach((t) => {
    if (t.ai_safe === false && t.requires_approval !== true) {
      errors.push(`Tool "${t.id}" is marked ai_safe:false but requires_approval is not true — unsafe tools should gate on human approval`);
    }
    const dangerWords = ['delete', 'destroy', 'drop', 'remove_all', 'wipe', 'purge', 'shutdown'];
    if (t.id && dangerWords.some((w) => t.id.includes(w))) {
      if (t.ai_safe !== false || t.requires_approval !== true) {
        warnings.push(`Tool "${t.id}" looks destructive — consider ai_safe:false and requires_approval:true`);
      }
    }
    if (t.type === 'api' && t.endpoint && t.endpoint.startsWith('http://')) {
      warnings.push(`Tool "${t.id}" uses http:// endpoint — use https:// for agent-callable APIs`);
    }
    if (t.type === 'api' && t.auth === 'none' && t.ai_safe !== false) {
      info.push(`Tool "${t.id}" is an unauthenticated API marked ai_safe — confirm this is intended`);
    }
    if (!t.examples || t.examples.length === 0) {
      info.push(`Tool "${t.id}" has no examples — examples significantly improve agent accuracy`);
    }
    if (t.type === 'api' && !t.rate_limit) {
      info.push(`Tool "${t.id}" is an API with no rate_limit declared — agents can't self-throttle`);
    }
  });

  // --- Permissions ---
  const perms = catalog.permissions;
  if (!perms) {
    warnings.push('No permissions block — agents will assume defaults; declare intent explicitly');
  } else {
    (perms.agent_rules || []).forEach((rule) => {
      if (rule.agent_pattern === '*' && rule.access === 'execute' && rule.human_approval_required !== true) {
        warnings.push('Wildcard agent rule grants execute to ALL agents without human approval — confirm this is intended');
      }
      // Referenced tools must exist
      (rule.allowed_tools || []).forEach((toolId) => {
        if (!tools.find((t) => t.id === toolId)) {
          errors.push(`Permission rule for "${rule.agent_pattern}" references unknown tool: "${toolId}"`);
        }
      });
    });
  }

  // --- Metadata freshness ---
  const meta = catalog.metadata || {};
  if (meta.last_updated) {
    const updated = new Date(meta.last_updated);
    const ageDays = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    if (isNaN(ageDays)) {
      warnings.push('metadata.last_updated is not a valid date');
    } else if (ageDays > STALE_DAYS) {
      warnings.push(`Catalog last updated ${Math.round(ageDays)} days ago — agents may distrust stale catalogs`);
    }
  } else {
    info.push('No metadata.last_updated — freshness signals help agents rank catalogs');
  }
  if (!meta.contact) info.push('No metadata.contact — humans need a way to reach you about tool issues');
  if (!meta.tags || meta.tags.length === 0) info.push('No metadata.tags — tags improve discoverability');
  if (meta.maturity === 'deprecated') {
    warnings.push('Catalog is marked deprecated — consider pointing to a successor in the description');
  }

  // --- Documentation ---
  if (!catalog.documentation || !catalog.documentation.main) {
    warnings.push('No documentation.main URL — both humans and agents need somewhere to learn more');
  }

  // --- Description quality ---
  if (!catalog.description) {
    warnings.push('No top-level description — this is the first thing agents read');
  }

  return { errors, warnings, info, ok: errors.length === 0 };
}

module.exports = { lintCatalog };
