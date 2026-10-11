import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cachePath = path.join(root, 'data', 'mcd-menu.json');
const tempPath = cachePath + '.tmp';

const SERVER_URL = 'https://mcp.mcd.cn';
const TOKEN = process.env.MCD_MCP_TOKEN;

function nowIso() {
  return new Date().toISOString();
}

function writeCache(payload) {
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tempPath, cachePath);
}

function loadOldCache() {
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function extractWrappedJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) { try { return JSON.parse(block[1]); } catch {} }
  const match = text.match(/Original Response\s*([\s\S]*?)(?:\n##|\n---|$)/);
  if (match) { try { return JSON.parse(match[1].trim()); } catch {} }
  const loose = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (loose) { try { return JSON.parse(loose[1]); } catch {} }
  return null;
}

function parseMcdCsv(dataText) {
  // list-nutrition-foods 返回 data 字段为 CSV 文本，格式：
  // [N]{col1,col2,...}:\n  名称,desc,kj,kcal,...
  if (!dataText || typeof dataText !== 'string') return [];
  const lines = dataText.split(/\r?\n/).filter(l => l.trim());
  const headerIdx = lines.findIndex(l => l.startsWith('[') && l.includes('{') && l.includes('}'));
  if (headerIdx < 0) return [];
  const headerMatch = lines[headerIdx].match(/\{([^}]*)\}/);
  if (!headerMatch) return [];
  const cols = headerMatch[1].split(',').map(c => c.trim());
  const out = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // 简单 CSV 拆分：data 字段本身不含逗号，但 productName 可能有引号
    const cells = line.split(',');
    if (cells.length < cols.length) continue;
    const row = {};
    for (let j = 0; j < cols.length; j++) {
      let v = cells[j]?.trim();
      if (v === 'null') v = null;
      row[cols[j]] = v;
    }
    out.push(row);
  }
  return out;
}

function normalizeItems(raw) {
  // 支持数组或对象；不猜测缺失字段，保留原始单位
  if (!raw) return [];
  if (typeof raw === 'string') raw = extractWrappedJson(raw);
  if (!raw) return [];
  // 如果顶层有 data 字段，data 可能是 JSON 字符串或 CSV 文本
  if (raw.data != null) {
    let data = raw.data;
    if (typeof data === 'string') {
      // list-nutrition-foods 返回特殊 CSV：先尝试按该格式解析
      const csv = parseMcdCsv(data);
      if (csv.length) {
        data = csv;
      } else {
        try { data = JSON.parse(data); } catch {
          data = extractWrappedJson(data);
        }
      }
    }
    raw = data ?? raw;
  }
  let list = Array.isArray(raw) ? raw : [raw];
  // 某些 MCP 返回 {foods: [...]}
  if (list.length === 1 && list[0] && typeof list[0] === 'object' && !list[0].name && !list[0].id) {
    const keys = Object.keys(list[0]);
    for (const k of keys) {
      if (Array.isArray(list[0][k])) {
        list = list[0][k];
        break;
      }
    }
  }

  return list
    .filter(it => it && typeof it === 'object')
    .map((it, idx) => ({
      id: it.id ?? it.productId ?? it.code ?? `unknown-${idx}`,
      name: it.name ?? it.productName ?? it.title ?? null,
      category: it.category ?? it.type ?? null,
      energyKcal: it.energyKcal ?? it.energy ?? it.calories ?? it.kcal ?? null,
      proteinG: it.proteinG ?? it.protein ?? null,
      fatG: it.fatG ?? it.fat ?? null,
      carbsG: it.carbsG ?? it.carbohydrates ?? it.carbohydrate ?? null,
      sodiumMg: it.sodiumMg ?? it.sodium ?? null,
      perServing: it.perServing ?? it.servingSize ?? it.serving ?? null,
      per100g: it.per100g ?? it.per100Grams ?? null,
      raw: it
    }));
}

async function sync() {
  if (!TOKEN) {
    console.warn('MCD_MCP_TOKEN not set, skipping live sync.');
    const old = loadOldCache();
    if (old) {
      console.log('Keeping existing cache:', cachePath);
    } else {
      writeCache({
        updatedAt: nowIso(),
        tool: 'none',
        status: 'offline-no-token',
        source: SERVER_URL,
        items: []
      });
    }
    process.exit(0);
  }

  let Client, StreamableHTTPClientTransport;
  try {
    const clientModule = await import('@modelcontextprotocol/sdk/client/index.js');
    Client = clientModule.Client;
    const transportModule = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    StreamableHTTPClientTransport = transportModule.StreamableHTTPClientTransport;
  } catch (e) {
    console.error('Failed to import MCP SDK. Did you run npm install?', e.message);
    process.exit(1);
  }

  const transport = new StreamableHTTPClientTransport(new URL(SERVER_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    }
  });

  const client = new Client({ name: 'maimai-restaurant-sync', version: '1.0.0' });

  try {
    await client.connect(transport);
    console.log('Connected to MCP server:', SERVER_URL);

    const toolsResult = await client.listTools();
    const tools = toolsResult?.tools ?? [];
    console.log('Available tools:', tools.map(t => t.name).join(', '));

    // 常见餐品营养工具名：list-nutrition-foods，以实际 tools/list 为准
    const nutritionTool = tools.find(t => /nutrition/i.test(t.name));
    if (!nutritionTool) {
      throw new Error('No nutrition tool found in tools/list');
    }
    console.log('Using nutrition tool:', nutritionTool.name);

    const callResult = await client.callTool({ name: nutritionTool.name, arguments: {} });
    const content = callResult?.content ?? [];
    const textItem = content.find(c => c.type === 'text');
    let rawData = null;
    if (textItem) {
      // textItem.text 可能是 Markdown 包装的 JSON 或 CSV，由 extractWrappedJson / parseMcdCsv 处理
      try {
        rawData = JSON.parse(textItem.text);
      } catch (e) {
        console.warn('Tool returned non-JSON text, treating as raw string');
        rawData = textItem.text;
      }
    } else if (content.length > 0) {
      rawData = content;
    } else {
      rawData = callResult;
    }

    const items = normalizeItems(rawData);
    const payload = {
      updatedAt: nowIso(),
      tool: nutritionTool.name,
      status: 'synced',
      source: SERVER_URL,
      itemCount: items.length,
      items
    };

    writeCache(payload);
    console.log(`Synced ${items.length} items to ${cachePath}`);
  } catch (e) {
    console.error('MCP sync failed:', e.message);
    const old = loadOldCache();
    if (old) {
      console.log('Keeping previous cache due to sync failure.');
    } else {
      writeCache({
        updatedAt: nowIso(),
        tool: 'unknown',
        status: 'error',
        source: SERVER_URL,
        error: e.message,
        items: []
      });
    }
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch (e) {}
  }
}

sync();
