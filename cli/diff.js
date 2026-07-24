// diff.js — Compare two ai-catalog.json files and report changes.
// Exposed as: diffCatalogs(oldPath, newPath) -> { report, breaking }

const fs = require('fs');

function indexById(arr) {
  const map = {};
  (arr || []).forEach((item) => {
    if (item && item.id) map[item.id] = item;
  });
  return map;
}

function shallowDiffFields(oldObj, newObj, fields) {
  const changed = [];
  fields.forEach((f) => {
    const a = JSON.stringify(oldObj[f] ?? null);
    const b = JSON.stringify(newObj[f] ?? null);
    if (a !== b) changed.push(f);
  });
  return changed;
}

function diffCatalogs(oldPath, newPath) {
  const oldCat = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
  const newCat = JSON.parse(fs.readFileSync(newPath, 'utf8'));

  const report = {
    version: { old: oldCat.version, new: newCat.version, changed: oldCat.version !== newCat.version },
    name_changed: oldCat.name !== newCat.name,
    tools: { added: [], removed: [], modified: [] },
    capabilities: { added: [], removed: [], modified: [] },
    permissions_changed: JSON.stringify(oldCat.permissions ?? null) !== JSON.stringify(newCat.permissions ?? null),
    breaking_changes: [],
  };

  // Tools
  const oldTools = indexById(oldCat.tools);
  const newTools = indexById(newCat.tools);
  const toolFields = ['name', 'type', 'endpoint', 'inputs', 'outputs', 'auth', 'ai_safe', 'requires_approval', 'rate_limit'];

  Object.keys(newTools).forEach((id) => {
    if (!oldTools[id]) report.tools.added.push(id);
  });
  Object.keys(oldTools).forEach((id) => {
    if (!newTools[id]) {
      report.tools.removed.push(id);
      report.breaking_changes.push(`Tool removed: ${id}`);
    }
  });
  Object.keys(newTools).forEach((id) => {
    if (oldTools[id]) {
      const changed = shallowDiffFields(oldTools[id], newTools[id], toolFields);
      if (changed.length > 0) {
        report.tools.modified.push({ id, fields: changed });
        // Breaking-change heuristics
        if (changed.includes('inputs')) report.breaking_changes.push(`Tool inputs changed: ${id}`);
        if (changed.includes('endpoint')) report.breaking_changes.push(`Tool endpoint changed: ${id}`);
        if (changed.includes('auth')) report.breaking_changes.push(`Tool auth changed: ${id}`);
        const wasSafe = oldTools[id].ai_safe !== false;
        const nowSafe = newTools[id].ai_safe !== false;
        if (wasSafe && !nowSafe) report.breaking_changes.push(`Tool no longer ai_safe: ${id}`);
      }
    }
  });

  // Capabilities
  const oldCaps = indexById(oldCat.capabilities);
  const newCaps = indexById(newCat.capabilities);
  Object.keys(newCaps).forEach((id) => {
    if (!oldCaps[id]) report.capabilities.added.push(id);
  });
  Object.keys(oldCaps).forEach((id) => {
    if (!newCaps[id]) report.capabilities.removed.push(id);
  });
  Object.keys(newCaps).forEach((id) => {
    if (oldCaps[id]) {
      const changed = shallowDiffFields(oldCaps[id], newCaps[id], ['name', 'description', 'category']);
      if (changed.length > 0) report.capabilities.modified.push({ id, fields: changed });
    }
  });

  // Version sanity: if there are breaking changes, major version should bump
  if (report.breaking_changes.length > 0 && report.version.changed) {
    const oldMajor = parseInt((oldCat.version || '0').split('.')[0], 10);
    const newMajor = parseInt((newCat.version || '0').split('.')[0], 10);
    if (newMajor <= oldMajor) {
      report.breaking_changes.push('Breaking changes detected but major version was not bumped');
    }
  } else if (report.breaking_changes.length > 0 && !report.version.changed) {
    report.breaking_changes.push('Breaking changes detected but catalog version is unchanged');
  }

  const hasChanges =
    report.version.changed ||
    report.name_changed ||
    report.permissions_changed ||
    report.tools.added.length > 0 ||
    report.tools.removed.length > 0 ||
    report.tools.modified.length > 0 ||
    report.capabilities.added.length > 0 ||
    report.capabilities.removed.length > 0 ||
    report.capabilities.modified.length > 0;

  return { report, hasChanges, breaking: report.breaking_changes.length > 0 };
}

module.exports = { diffCatalogs };
