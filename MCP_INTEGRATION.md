# 麦麦餐厅 · MCP 集成说明

## 接入目标

通过麦当劳官方 MCP Server 获取真实餐品营养数据，经校验、标准化、脱敏后生成公开缓存，供游戏侧栏展示。同步脚本在开发/数据同步阶段运行，浏览器端不持有 Token，也不实时请求 MCP。

## 服务器与认证

- MCP Server：`https://mcp.mcd.cn`
- 传输协议：Streamable HTTP
- 认证方式：`Authorization: Bearer <TOKEN>`
- Token 来源：环境变量 `MCD_MCP_TOKEN`（仅本地脚本使用）

## 调用流程

```
scripts/sync-mcd-data.mjs
    │
    ├─ 读取 MCD_MCP_TOKEN
    ├─ 连接 https://mcp.mcd.cn（StreamableHTTPClientTransport）
    ├─ initialize
    ├─ tools/list（读取真实工具名与参数）
    ├─ 匹配含 nutrition 关键词的餐品营养工具
    ├─ tools/call（空参数调用）
    ├─ 解析文本/JSON 返回
    ├─ 标准化字段（保留原始单位，缺失值填 null）
    ├─ 写入 data/mcd-menu.json.tmp
    └─ 原子重命名为 data/mcd-menu.json
```

## 数据如何进入游戏

1. `npm run mcp:sync` 更新 `data/mcd-menu.json`。
2. `npm run build` 读取缓存并内嵌为 `window.MCD_MENU_CACHE`。
3. 游戏启动屏展示缓存更新时间、来源工具与状态。
4. 侧栏「今日真实餐品参考」按名称匹配游戏菜单，展示真实名称及营养字段（能量、蛋白质、脂肪、碳水、钠等）。

## 标准化规则

- 原始单位、每份/每 100 克等计量口径保持不变。
- 缺失字段不猜测，统一标为 `null`。
- MCP 返回为 JSON 字符串或文本时正确解析。
- 未匹配到的游戏餐品标记为「未匹配」，不伪造营养值。

## 当前缓存示例字段

本次真实同步后的缓存（`data/mcd-menu.json`）示例：

```json
{
  "updatedAt": "2026-10-11T12:21:08.096Z",
  "tool": "list-nutrition-foods",
  "status": "synced",
  "source": "https://mcp.mcd.cn",
  "itemCount": 160,
  "items": [
    {
      "id": "巨无霸",
      "name": "巨无霸",
      "category": null,
      "energyKcal": 513,
      "proteinG": 27,
      "fatG": 26,
      "carbsG": 42,
      "sodiumMg": 961,
      "perServing": null,
      "per100g": null,
      "raw": { "productName": "巨无霸", ... }
    }
  ]
}
```

`list-nutrition-foods` 返回 `data` 字段为 CSV 文本，脚本按 `[N]{col1,col2,...}:\n  名称,...` 格式解析，保留原始单位与字段，缺失值标为 `null`。

## 业务价值

- 让玩家在配餐练习中看到真实餐品名称与营养信息，增强餐品认知。
- 将官方 MCP 数据作为「参考面板」，与游戏内的模拟价格/优惠明确区分。
- 演示 MCP 数据如何以缓存形式安全地进入前端，避免 Token 泄漏。

## 复现命令

```bash
# 1. 配置 Token
cp .env.example .env
# 编辑 .env，填入 MCD_MCP_TOKEN

# 2. 同步真实数据
npm run mcp:sync

# 3. 构建并打开游戏
npm run build
# 双击 maimai-restaurant.html
```

## 失败处理

- **无 Token**：脚本跳过实时同步，保留旧缓存；游戏显示「离线练习」状态。
- **网络失败/SDK 异常**：脚本保留旧缓存，退出码非 0，不会覆盖有效数据。
- **返回解析失败**：记录错误，保留旧缓存。
- **工具未找到**：抛出错误并保留旧缓存。

## 安全与合规

- Token 仅存在于 `.env` 与本机环境变量，不进入前端、GitHub、截图、提示词或部署包。
- 公开缓存只含允许公开的餐品数据，不含个人券、手机号、门店位置、Trace 身份或账户资料。
- 不进行自动领券、下单、支付、兑换积分或写入用户账户。

## 真实 MCP 验证结果

已使用环境变量 `MCD_MCP_TOKEN` 执行真实同步，结果如下：

```text
Connected to MCP server: https://mcp.mcd.cn
Available tools: query-survey-coupon, query-my-account, query-party-city, ... list-nutrition-foods, ...
Using nutrition tool: list-nutrition-foods
Synced 160 items to data/mcd-menu.json
```

- 工具名以 `tools/list` 返回为准，脚本自动匹配含 `nutrition` 关键词的工具。
- `list-nutrition-foods` 返回 Markdown 包装的 JSON，其中 `data` 为 CSV 字符串；脚本已正确解析并标准化。
- 缓存已嵌入 `maimai-restaurant.html`，游戏侧栏显示「已同步 160 条餐品数据」及营养信息。
- Token 仅用于本地同步脚本，未写入前端、GitHub、截图、提示词或部署包。
