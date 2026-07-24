// serve.js — `ai-catalog serve <catalog>`: zero-dependency local web explorer.
// Human-friendly UI: browse capabilities, tools, permissions, plus a live
// token-usage meter showing what the catalog costs an agent's context window.
// Also serves the raw catalog at /ai-catalog.json for agents.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { meterCatalog } = require('./tokens');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function meterColor(pct) {
  if (pct < 40) return '#22c55e';
  if (pct < 75) return '#eab308';
  return '#ef4444';
}

function renderHtml(catalog, meter, filePath) {
  const tools = catalog.tools || [];
  const caps = catalog.capabilities || [];
  const perms = catalog.permissions;
  const maxToolTokens = Math.max(1, ...meter.perTool.map((t) => t.tokens));

  const budgetBars = meter.budgets
    .map((b) => {
      const pct = Math.min(b.percent, 100);
      return `
      <div class="budget">
        <div class="budget-label"><span>${esc(b.window)}</span><span>${b.percent}%</span></div>
        <div class="track"><div class="fill" style="width:${pct}%;background:${meterColor(b.percent)}"></div></div>
      </div>`;
    })
    .join('');

  const toolTokenRows = meter.perTool
    .map((t) => {
      const pct = (t.tokens / maxToolTokens) * 100;
      return `
      <div class="tool-token-row">
        <code>${esc(t.id)}</code>
        <div class="track small"><div class="fill" style="width:${pct}%;background:#6366f1"></div></div>
        <span class="tok">${t.tokens} tok</span>
      </div>`;
    })
    .join('');

  const warningsHtml = meter.warnings.length
    ? `<div class="warnings">${meter.warnings.map((w) => `<div>⚠️ ${esc(w)}</div>`).join('')}</div>`
    : '';
  const suggestionsHtml = meter.suggestions.length
    ? `<div class="suggestions">${meter.suggestions.map((s) => `<div>💡 ${esc(s)}</div>`).join('')}</div>`
    : '';

  const toolCards = tools
    .map((t) => {
      const badges = [
        `<span class="badge type">${esc(t.type)}</span>`,
        t.auth && t.auth !== 'none' ? `<span class="badge auth">🔑 ${esc(t.auth)}</span>` : '',
        t.ai_safe === false ? `<span class="badge unsafe">⛔ not ai-safe</span>` : `<span class="badge safe">✅ ai-safe</span>`,
        t.requires_approval ? `<span class="badge approval">👤 human approval</span>` : '',
        t.rate_limit ? `<span class="badge rate">⏱ ${t.rate_limit.requests_per_minute ? t.rate_limit.requests_per_minute + '/min' : (t.rate_limit.requests_per_hour + '/hr')}</span>` : '',
      ].join(' ');
      const inputs = t.inputs?.properties
        ? `<div class="io"><strong>Inputs:</strong> ${Object.entries(t.inputs.properties)
            .map(([k, v]) => `<code>${esc(k)}${(t.inputs.required || []).includes(k) ? '*' : ''}: ${esc(v.type || 'any')}</code>`)
            .join(' ')}</div>`
        : '';
      const example = t.examples?.[0]
        ? `<details><summary>Example</summary><pre>${esc(JSON.stringify(t.examples[0], null, 2))}</pre></details>`
        : '';
      return `
      <div class="card tool" data-name="${esc((t.id + ' ' + t.name + ' ' + (t.description || '')).toLowerCase())}">
        <div class="card-head"><h3>${esc(t.name)}</h3><code class="id">${esc(t.id)}</code></div>
        <div class="badges">${badges}</div>
        <p>${esc(t.description || '')}</p>
        ${t.endpoint ? `<div class="endpoint"><code>${esc(t.endpoint)}</code></div>` : ''}
        ${inputs}
        ${example}
      </div>`;
    })
    .join('');

  const capCards = caps
    .map(
      (c) => `
      <div class="card cap">
        <h3>${esc(c.name)}</h3>
        <span class="badge type">${esc(c.category || 'other')}</span>
        <p>${esc(c.description || '')}</p>
      </div>`
    )
    .join('');

  const permRows = perms
    ? `
    <div class="card">
      <p>Default access for unknown agents: <span class="badge ${perms.default_access === 'none' ? 'unsafe' : 'type'}">${esc(perms.default_access || 'read')}</span></p>
      ${(perms.agent_rules || [])
        .map(
          (r) => `
        <div class="perm-rule">
          <code>${esc(r.agent_pattern)}</code> →
          <span class="badge ${r.access === 'execute' ? 'approval' : 'type'}">${esc(r.access)}</span>
          ${r.human_approval_required ? '<span class="badge approval">👤 approval required</span>' : ''}
          ${r.allowed_tools?.length ? `<div class="allowed">tools: ${r.allowed_tools.map((t) => `<code>${esc(t)}</code>`).join(' ')}</div>` : '<div class="allowed">tools: all</div>'}
        </div>`
        )
        .join('')}
    </div>`
    : '<p class="muted">No permissions block declared — agents assume defaults.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(catalog.name)} — AI Catalog Explorer</title>
<style>
  :root { --bg:#0b0e14; --panel:#141824; --border:#232a3b; --text:#e2e8f0; --muted:#94a3b8; --accent:#6366f1; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text); font:15px/1.55 -apple-system,'Segoe UI',Roboto,sans-serif; padding:32px 16px 80px; }
  .wrap { max-width:960px; margin:0 auto; }
  header h1 { font-size:26px; }
  header .sub { color:var(--muted); margin:6px 0 2px; }
  header .file { color:var(--muted); font-size:12px; font-family:monospace; }
  .maturity { display:inline-block; margin-left:8px; padding:2px 10px; border-radius:999px; font-size:12px; background:#1e293b; }
  section { margin-top:36px; }
  h2 { font-size:18px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px 18px; margin-bottom:14px; }
  .card-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
  .card h3 { font-size:16px; }
  code { background:#1e2534; padding:2px 6px; border-radius:6px; font-size:12.5px; }
  code.id { color:var(--muted); }
  .badges { margin:8px 0; display:flex; gap:6px; flex-wrap:wrap; }
  .badge { font-size:11.5px; padding:2px 9px; border-radius:999px; background:#1e293b; }
  .badge.safe { background:#052e1a; color:#4ade80; }
  .badge.unsafe { background:#3b0a0a; color:#f87171; }
  .badge.approval { background:#3b2b06; color:#fbbf24; }
  .badge.auth { background:#1e1b3b; color:#a5b4fc; }
  .badge.rate { background:#0c2a33; color:#67e8f9; }
  .endpoint { margin:6px 0; }
  .io { margin:8px 0 4px; font-size:13.5px; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  details { margin-top:8px; } summary { cursor:pointer; color:var(--muted); font-size:13px; }
  pre { background:#0d1117; border:1px solid var(--border); padding:12px; border-radius:8px; overflow:auto; font-size:12px; margin-top:8px; }
  .muted { color:var(--muted); }
  /* Token meter */
  .meter-card { border-color:#31395a; }
  .total-tokens { font-size:34px; font-weight:700; }
  .total-tokens span { font-size:15px; font-weight:400; color:var(--muted); }
  .budget { margin-top:12px; }
  .budget-label { display:flex; justify-content:space-between; font-size:13px; color:var(--muted); margin-bottom:4px; }
  .track { background:#1e2534; border-radius:999px; height:10px; overflow:hidden; }
  .track.small { height:8px; flex:1; }
  .fill { height:100%; border-radius:999px; transition:width .4s; }
  .tool-token-row { display:flex; align-items:center; gap:12px; margin-top:8px; }
  .tool-token-row code { min-width:180px; }
  .tok { color:var(--muted); font-size:12.5px; min-width:64px; text-align:right; }
  .warnings { margin-top:14px; color:#fbbf24; font-size:13.5px; display:grid; gap:4px; }
  .suggestions { margin-top:10px; color:#93c5fd; font-size:13.5px; display:grid; gap:4px; }
  .perm-rule { border-top:1px solid var(--border); padding:10px 0 4px; margin-top:10px; }
  .allowed { color:var(--muted); font-size:13px; margin-top:4px; }
  #search { width:100%; background:var(--panel); border:1px solid var(--border); color:var(--text); padding:10px 14px; border-radius:10px; font-size:14px; margin-bottom:14px; }
  .agent-link { margin-top:8px; font-size:13px; color:var(--muted); }
  .agent-link a { color:#818cf8; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:700px){ .grid2{grid-template-columns:1fr;} .tool-token-row code{min-width:120px;} }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(catalog.name)} <span class="maturity">${esc(catalog.metadata?.maturity || 'stable')}</span></h1>
    <p class="sub">${esc(catalog.description || '')}</p>
    <p class="file">v${esc(catalog.version)} · ${esc(catalog.repository?.url || '')} · serving ${esc(path.basename(filePath))}</p>
    <p class="agent-link">🤖 Agents: fetch the raw catalog at <a href="/ai-catalog.json">/ai-catalog.json</a> · token report at <a href="/tokens.json">/tokens.json</a></p>
  </header>

  <section>
    <h2>🧮 Token Usage Meter</h2>
    <div class="card meter-card">
      <div class="total-tokens">~${meter.total.toLocaleString()} <span>tokens when loaded into an agent's context</span></div>
      ${budgetBars}
      ${warningsHtml}
      ${suggestionsHtml}
    </div>
    ${meter.perTool.length ? `<div class="card"><h3 style="margin-bottom:6px">Per-tool cost</h3>${toolTokenRows}</div>` : ''}
  </section>

  <section>
    <h2>🔧 Tools (${tools.length})</h2>
    <input id="search" placeholder="Filter tools…">
    ${toolCards || '<p class="muted">No tools declared.</p>'}
  </section>

  <section>
    <h2>💡 Capabilities (${caps.length})</h2>
    <div class="grid2">${capCards || '<p class="muted">No capabilities declared.</p>'}</div>
  </section>

  <section>
    <h2>🔒 Permissions</h2>
    ${permRows}
  </section>
</div>
<script>
  var searchBox = document.getElementById('search');
  if (searchBox) {
    searchBox.addEventListener('input', function () {
      var q = this.value.toLowerCase();
      var cards = document.querySelectorAll('.card.tool');
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.display = cards[i].getAttribute('data-name').indexOf(q) !== -1 ? '' : 'none';
      }
    });
  }
</script>
</body>
</html>`;
}

function serveCatalog(filePath, port = 4747) {
  const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const meter = meterCatalog(catalog);
  const html = renderHtml(catalog, meter, filePath);

  const server = http.createServer((req, res) => {
    if (req.url === '/ai-catalog.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(catalog, null, 2));
    } else if (req.url === '/tokens.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(meter, null, 2));
    } else if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found. Try / or /ai-catalog.json');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => resolve({ server, port }));
  });
}

module.exports = { serveCatalog, renderHtml };
