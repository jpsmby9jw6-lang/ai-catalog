// convert.js — OpenAPI <-> ai-catalog conversion.
// import: OpenAPI 3.x spec (JSON or YAML) -> ai-catalog.json
// export: ai-catalog.json -> OpenAPI 3.0 spec (api-type tools only)

const fs = require('fs');
const yaml = require('js-yaml');

function loadSpec(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return yaml.load(raw);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Fall back to YAML — some specs are YAML with .txt/.json-adjacent names
    return yaml.load(raw);
  }
}

function toSnakeId(str) {
  return String(str)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function detectAuth(operation, spec) {
  const security = operation.security ?? spec.security;
  if (!security || security.length === 0) return 'none';
  const schemes = spec.components?.securitySchemes || {};
  const firstReq = security[0];
  const schemeName = Object.keys(firstReq || {})[0];
  const scheme = schemes[schemeName];
  if (!scheme) return 'api_key';
  if (scheme.type === 'apiKey') return 'api_key';
  if (scheme.type === 'oauth2') return 'oauth';
  if (scheme.type === 'http' && scheme.scheme === 'bearer') return 'bearer_token';
  if (scheme.type === 'http' && scheme.scheme === 'basic') return 'basic';
  return 'api_key';
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function importOpenApi(specPath) {
  const spec = loadSpec(specPath);
  if (!spec || !spec.openapi || !spec.paths) {
    throw new Error('Not a valid OpenAPI 3.x spec (missing "openapi" or "paths")');
  }

  const baseUrl = spec.servers?.[0]?.url || 'https://example.com';
  const tools = [];
  const seenIds = new Set();

  Object.entries(spec.paths).forEach(([pathKey, pathItem]) => {
    ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
      const op = pathItem[method];
      if (!op) return;

      let id = op.operationId ? toSnakeId(op.operationId) : toSnakeId(`${method}_${pathKey}`);
      // De-dupe
      let candidate = id;
      let n = 2;
      while (seenIds.has(candidate)) candidate = `${id}_${n++}`;
      id = candidate;
      seenIds.add(id);

      // Build inputs from parameters + requestBody
      const properties = {};
      const required = [];
      (op.parameters || []).concat(pathItem.parameters || []).forEach((p) => {
        if (!p || !p.name) return;
        properties[p.name] = {
          type: p.schema?.type || 'string',
          description: p.description || `${p.in} parameter`,
        };
        if (p.required) required.push(p.name);
      });
      const bodySchema = op.requestBody?.content?.['application/json']?.schema;
      if (bodySchema?.properties) {
        Object.entries(bodySchema.properties).forEach(([k, v]) => {
          properties[k] = { type: v.type || 'object', description: v.description || 'request body field' };
        });
        (bodySchema.required || []).forEach((r) => required.push(r));
      }

      // Outputs from 200/201 response
      const okResponse = op.responses?.['200'] || op.responses?.['201'];
      const outputSchema = okResponse?.content?.['application/json']?.schema || {};

      const mutating = MUTATING_METHODS.has(method);
      tools.push({
        id,
        name: op.summary || `${method.toUpperCase()} ${pathKey}`,
        description: op.description || op.summary || `${method.toUpperCase()} ${pathKey}`,
        type: 'api',
        endpoint: `${baseUrl}${pathKey}`,
        inputs: Object.keys(properties).length
          ? { type: 'object', required: [...new Set(required)], properties }
          : {},
        outputs: outputSchema.type ? outputSchema : {},
        requires_approval: method === 'delete', // destructive ops gate on humans by default
        auth: detectAuth(op, spec),
        ai_safe: !mutating || method === 'post' ? !MUTATING_METHODS.has(method) || method === 'post' : false,
      });
      // Simplify: GET/POST default ai_safe true; PUT/PATCH true; DELETE false
      const tool = tools[tools.length - 1];
      tool.ai_safe = method !== 'delete';
    });
  });

  const catalog = {
    version: '1.0.0',
    name: spec.info?.title || 'Imported API',
    description: (spec.info?.description || '').slice(0, 1024) || `Imported from OpenAPI spec: ${spec.info?.title || specPath}`,
    repository: { url: 'https://github.com/CHANGE-ME/CHANGE-ME', branch: 'main' },
    capabilities: (spec.tags || []).map((t) => ({
      id: toSnakeId(t.name),
      name: t.name,
      description: t.description || t.name,
      category: 'api',
    })),
    tools,
    permissions: { default_access: 'read', agent_rules: [] },
    documentation: spec.externalDocs?.url ? { main: spec.externalDocs.url } : { main: 'https://CHANGE-ME.example.com/docs' },
    metadata: {
      maintained: true,
      maturity: 'stable',
      last_updated: new Date().toISOString(),
      tags: (spec.tags || []).map((t) => toSnakeId(t.name)),
    },
  };

  return { catalog, stats: { tools: tools.length, capabilities: catalog.capabilities.length, source_version: spec.openapi } };
}

function exportOpenApi(catalogPath) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const apiTools = (catalog.tools || []).filter((t) => t.type === 'api' && t.endpoint);
  const skipped = (catalog.tools || []).filter((t) => t.type !== 'api' || !t.endpoint).map((t) => t.id);

  const paths = {};
  apiTools.forEach((t) => {
    let url;
    try {
      url = new URL(t.endpoint);
    } catch {
      url = { pathname: `/${t.id}`, origin: 'https://example.com' };
    }
    const p = url.pathname || `/${t.id}`;
    if (!paths[p]) paths[p] = {};
    // Heuristic: tools with object inputs and requires_approval/destructive names lean POST; default GET
    const method = t.inputs && t.inputs.properties && Object.keys(t.inputs.properties).length > 2 ? 'post' : 'get';
    paths[p][method] = {
      operationId: t.id,
      summary: t.name,
      description: t.description || t.name,
      ...(method === 'get'
        ? {
            parameters: Object.entries(t.inputs?.properties || {}).map(([name, schema]) => ({
              name,
              in: 'query',
              required: (t.inputs?.required || []).includes(name),
              schema: { type: schema.type || 'string' },
              description: schema.description || '',
            })),
          }
        : {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: t.inputs || { type: 'object' } } },
            },
          }),
      responses: {
        200: {
          description: 'Success',
          content: { 'application/json': { schema: t.outputs && Object.keys(t.outputs).length ? t.outputs : { type: 'object' } } },
        },
      },
      'x-ai-safe': t.ai_safe !== false,
      'x-requires-approval': t.requires_approval === true,
      ...(t.rate_limit ? { 'x-rate-limit': t.rate_limit } : {}),
    };
  });

  const spec = {
    openapi: '3.0.3',
    info: {
      title: catalog.name,
      description: catalog.description || '',
      version: catalog.version,
      ...(catalog.metadata?.contact ? { contact: { email: catalog.metadata.contact.includes('@') ? catalog.metadata.contact : undefined, name: catalog.metadata.contact } } : {}),
    },
    servers: apiTools.length
      ? [...new Set(apiTools.map((t) => { try { return new URL(t.endpoint).origin; } catch { return null; } }).filter(Boolean))].map((u) => ({ url: u }))
      : [{ url: 'https://example.com' }],
    tags: (catalog.capabilities || []).map((c) => ({ name: c.name, description: c.description || '' })),
    paths,
    ...(catalog.documentation?.main ? { externalDocs: { url: catalog.documentation.main } } : {}),
  };

  return { spec, stats: { exported: apiTools.length, skipped } };
}

module.exports = { importOpenApi, exportOpenApi };
