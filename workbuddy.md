# workbuddy.md · 麦麦餐厅-慧眼识人开发记录

## 项目信息

- 项目名称：麦麦餐厅
- 开发环境：WorkBuddy
- 工作区：`C:/Users/Z/WorkBuddy/2026-10-11-19-06-16`
- 主要交付：可双击运行的 `maimai-restaurant.html`

## 开发过程摘要

1. **参考重构**：以用户提供的参考文件 `C:/Users/Z/Documents/Codex/2026-10-11/wo-y/outputs/麦麦餐厅-双击即玩.html` 为基础，重制成项目源码 `src/index.html`，替换此前简陋的 DOM 版实现。
2. **单文件游戏**：Canvas 俯视餐厅场景 + DOM 订单卡悬浮在顾客面前；保留参考文件的视觉与交互，增加固定种子输入、MCP 餐品数据侧栏、整单出餐、推荐优惠等机制。
3. **MCP 真实数据同步**：编写 `scripts/sync-mcd-data.mjs`，使用 `@modelcontextprotocol/sdk@^1.32.1` 的 `StreamableHTTPClientTransport` 连接 `https://mcp.mcd.cn`，通过环境变量 `MCD_MCP_TOKEN` 调用 `list-nutrition-foods` 工具，成功同步 160 条真实餐品营养数据到 `data/mcd-menu.json`。
4. **响应解析**：针对 `list-nutrition-foods` 返回 Markdown 包装 JSON 且 `data` 字段为特殊 CSV 文本的格式，实现 `extractWrappedJson` 与 `parseMcdCsv`；优先 CSV 解析避免 `[160]{...}:` 表头被误当 JSON 数组。
5. **缓存内联构建**：编写 `scripts/build.mjs`，把 `data/mcd-menu.json` 内联进 `src/index.html` 的 `// __INLINE_MCP_CACHE__` 占位处，生成 `dist/maimai-restaurant.html` 与项目根目录 `maimai-restaurant.html`。
6. **Node 可测试**：在 `src/index.html` 中用 `typeof document !== 'undefined'` 守卫浏览器代码，导出 `globalThis.Restaurant`，并在 `tests/game.test.js` 中 mock DOM/Canvas，使单文件游戏能在 Node 下被 `eval` 与测试。
7. **测试覆盖**：`tests/game.test.js` 14 项测试全部通过，覆盖未接单不可出餐、推荐/直接接单/拒单、八种配方、大汉堡不被小配方截断、清材料保留餐品、托盘容量、错误配方投诉、小费按锁定倍率计算、跳过推荐无投诉、多份整盘交付、规模升级阈值、打烊后不可再接等规则。
8. **词条平衡调整**：初版 6 个顾客词条中有 4 个「漏推优惠被投诉」概率 ≥ 55%，平均 catch 率约 56%，玩家体感「所有词条都会发现漏掉优惠」。按用户反馈把 `couponAttention` 统一下调（省钱小能手 96%→85%、探店博主 78%→60%、认真核对客 65%→45%、麦麦熟客 55%→35%、打工赶时间 35%→20%、佛系干饭人 8%→5%），平均降至约 41%，高低风险区分更明显。
9. **收益按钮去歧义**：用户反馈「直接接单和推荐接单好像没差别」，核查后确认逻辑无误（`settle()` 中仅 `decision==='tell'` 才计小费），但两个按钮都叫「接单」容易误解。改为「推荐 +小费」/「直接 无小费」，并在优惠标签与玩法说明中写明「推荐后出餐才有小费」。
10. **结算评分系统**：按用户需求新增关卡结算评分——好评 100 / 普通 50 / 差评 0 计分，换算为百分制服务评分，映射 S/A/B/C/D 评级与称号，打烊弹窗展示评级徽章、评分与好评率进度条，并把本机最高分写入 `localStorage`。
11. **文档**：更新 `README.md`、`MCP_INTEGRATION.md`，记录 Canvas 版玩法、真实 MCP 同步结果与 CSV 解析细节。
12. **参赛整理**：项目定名「麦麦餐厅-慧眼识人」，校对 `CONTEST_DECLARATION.md` 与官方原文逐字节一致（1522 bytes，diff 无差异），清理旧版遗留文件（`src/game.js`、`src/styles.css`），初始化 git 仓库并提交。

## 使用记录（凭据已脱敏）

- Node 版本：22.22.2（managed）
- 包管理器：npm
- MCP SDK：`@modelcontextprotocol/sdk@^1.32.1`
- 关键命令：
  - `npm install`
  - `npm run build` → 生成 `dist/maimai-restaurant.html` 与根目录 `maimai-restaurant.html`
  - `npm test` → 14 passing
  - `MCD_MCP_TOKEN=<用户提供的 Token> npm run mcp:sync` → 成功同步 160 条数据

## 真实 MCP 同步结果

- 服务器：`https://mcp.mcd.cn`
- 工具名：`list-nutrition-foods`（由 `tools/list` 自动匹配含 nutrition 关键词）
- 同步条数：160 条
- 缓存文件：`data/mcd-menu.json`
- 缓存已嵌入构建产物，游戏侧栏显示「已同步 160 条餐品数据」及营养信息

## 说明

- 参考文件著作权归用户/原作者；本次在其基础上做项目化改造、MCP 接入与测试。
- 真实 MCP Token 仅通过环境变量传入本地同步脚本，未写入任何文件、截图、提示词或部署包。
- 本项目为麦当劳 2026 年 1024 程序员创意开发大赛参赛作品。
- 本文件用于 WorkBuddy 专项奖励核验。
