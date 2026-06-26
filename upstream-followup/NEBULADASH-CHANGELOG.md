# NebulaDash 维护更新日志

本文件记录 NebulaDash 分支的实际维护改动，作为后续继续迭代、对比上游和排查回归的固定入口。

根目录 `CHANGELOG.md` 主要来自官方 Zashboard，不用于记录本分支的本地优化。

## 记录规则

每次修改后都必须在本文追加一条记录，至少包含：

- 日期
- 提交哈希或当前工作状态
- 修改目的
- 涉及文件
- 行为变化
- 验证命令
- 后续注意事项

涉及 OpenClash 慢接口、代理页、规则页、搜索、缓存、更新源和发布流程的改动，必须写清楚约束，避免后续同步上游时误删本地优化。

---

## 2026-06-26

### 本地二改基线：OpenClash 环境特化优化

- 提交：历史二改整合，已包含在公开仓库初始提交 `b28546ab`
- 类型：本地功能基线 / 上游同步保护
- 目的：记录 NebulaDash 相比官方 Zashboard 的核心本地改动，后续同步上游时不得误删。

核心约束：

- 不引入 Node / Docker 中转服务或 SQLite 持久化。
- 浏览器继续直连 OpenClash / Mihomo API。
- 优先保障低资源路由器上的首屏可用性。
- 代理页、规则页、搜索是本分支优先维护路径。
- `/providers/proxies` 在多 provider OpenClash 环境下很慢，不能让它阻塞策略组 / 节点组首屏。

#### 代理页三段视图

涉及文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/composables/proxies.ts`

行为：

- 代理页拆分为“策略组 / 节点组 / 代理商”三段。
- 三类内容独立渲染，不再混排。
- 节点组按命名变体聚类排序，例如“香港手动 / 香港自动 / 香港故转”相邻。
- 节点聚类词表通过 `config/node-cluster-variants` 配置。

后续注意：

- 不能直接用官方 3.x 的代理页结构覆盖本地三段视图。
- 上游代理文件夹 / Provider 重构只能手动融合。

#### Provider 慢接口隔离

涉及文件：

- `src/views/ProxiesPage.vue`
- `src/components/sidebar/ProxiesCtrl.tsx`
- `src/store/proxies.ts`

行为：

- 初次进入代理页只依赖 `/proxies`。
- 只有切换到“代理商”标签时才调用 `fetchProxyProviders()`。
- Provider 请求失败、超时或仍在加载时，不影响策略组 / 节点组使用。
- “全部更新 Provider”后会强制刷新 Provider 数据，但普通搜索和普通切 tab 不重复打慢接口。

后续注意：

- 任何上游同步都不能恢复“页面启动即请求 `/providers/proxies`”。
- 搜索 Provider 内节点时也只能使用已有缓存 / 已加载数据，不能主动触发 Provider 慢请求。

#### 代理数据与 Provider 缓存

涉及文件：

- `src/store/proxies.ts`
- `src/helper/proxyCache.ts`
- `src/helper/proxyCache.spec.ts`

行为：

- 使用 `cache/proxy-data` 缓存 `/proxies`。
- 使用 `cache/proxy-providers` 缓存 `/providers/proxies`。
- 先用缓存快速起屏，再后台刷新。
- 缓存按后端 UUID 隔离，避免不同后端之间复用错误数据。
- Provider 状态记录加载状态、最后更新时间和请求耗时。

后续注意：

- 不同后端的缓存隔离不能移除。
- Provider 缓存可以用于展示，但不能作为触发阻塞式请求的理由。

#### Provider 请求去重与强制刷新

涉及文件：

- `src/store/proxies.ts`

行为：

- `hasLoadedProxyProviders` 避免已加载后重复请求。
- `proxyProviderLoadingPromise` 避免并发重复请求。
- `force` 参数用于用户主动刷新 Provider 后重新拉取。

后续注意：

- 上游 provider 相关改动必须保留请求去重和 `force` 语义。

#### 节点到 Provider 的预映射

涉及文件：

- `src/store/proxies.ts`
- `src/components/proxies/ProxyGroup.vue`

行为：

- `proxyNodeProviderMap` 预先建立“节点名 -> Provider 名”映射。
- 策略组规则直通末尾可以显示最终节点所属 Provider。
- 界面层不再为每个卡片反复遍历完整 provider 列表。

后续注意：

- Provider 尚未加载时，Provider 尾标允许暂时缺失，不能因此阻塞加载。

#### 统一搜索增强

涉及文件：

- `src/helper/search.ts`
- `src/store/rules.ts`
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`

行为：

- 搜索支持 NFKC 规范化。
- 支持符号容错。
- 支持空格、逗号、竖线等多分隔符。
- 多关键词使用 AND 匹配。
- 域名关键词会拆 label 变体，例如 `google.com` 可命中 `google`。
- 规则搜索会匹配 `type / payload / proxy` 和规则代理组下游链路。
- 代理页搜索会通过规则 payload / 规则链路反向映射到策略组。
- 代理页首次输入有效搜索词时才按需拉取 `/rules`。

后续注意：

- 官方正则搜索或节点搜索模式不能直接覆盖本地 `src/helper/search.ts`。
- 新搜索能力必须扩展公共 helper，保留域名反向映射和链路感知能力。

#### 规则直通、链路导航和规则页优化

涉及文件：

- `src/components/proxies/ProxyGroup.vue`
- `src/views/ProxiesPage.vue`
- `src/views/RulesPage.vue`
- `src/store/rules.ts`
- `src/store/proxies.ts`

行为：

- 策略组卡片支持“规则直通”展开完整链路。
- 支持一键跳转规则页并带入筛选词。
- 点击链路节点后自动切换到对应代理分段。
- 自动定位并展开目标卡片。
- 规则页列表渲染去掉逐项 `indexOf` 的低效写法。

后续注意：

- 不得移除链路点击定位、规则页跳转和最终 Provider 尾标。

#### 搜索高亮

涉及文件：

- `src/components/common/HighlightedText.vue`
- `src/components/proxies/ProxyName.vue`
- `src/components/proxies/ProxyGroup.vue`
- `src/components/proxies/ProxyNodeCard.vue`
- `src/components/proxies/ProxyProvider.vue`
- `src/components/rules/RuleCard.vue`
- `src/components/rules/RuleProvider.vue`
- `src/helper/search.ts`

行为：

- 代理组名、当前节点、最终出口、规则链路、Provider 名、节点卡片、规则卡片和 Rule Provider 接入搜索高亮。
- 高亮复用统一搜索分词和符号容错逻辑。

后续注意：

- 如果调整搜索分词，必须同时检查高亮是否仍能对应命中项。

#### 设置导入兼容清洗

涉及文件：

- `src/helper/autoImportSettings.ts`
- `src/components/common/ImportSettings.vue`

行为：

- 导入设置时过滤历史遗留图标配置键：
  - `config/icon-size`
  - `config/icon-margin-right`
  - `config/use-large-proxy-group-icon`
- 降低旧二改配置直接导入导致设置污染的风险。

后续注意：

- 设置同步 / 导入导出增强时，要保留兼容清洗。

#### 品牌与启动体验

涉及文件：

- `src/router/index.ts`
- `index.html`
- `vite.config.ts`
- `start-za.ps1`
- `start-za.cmd`

行为：

- 面板名称统一为 NebulaDash。
- 页面标题、运行时路由标题和 PWA manifest 使用 NebulaDash。
- Windows 下提供一键启动脚本，支持首次安装依赖、启动 dev server 和打开浏览器。

后续注意：

- 上游同步后检查品牌名是否被恢复为 Zashboard。

#### 设置页连接失败体验

涉及文件：

- `src/views/SetupPage.vue`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

行为：

- 首次进入设置页仍可静默尝试默认后端 `127.0.0.1:9090`。
- 手动提交后端不可达时，不再弹浏览器原生 `TypeError: Failed to fetch`。
- 改为面板内错误通知。
- 提交检测期间按钮显示检查状态并临时禁用。
- 必填项缺失有本地化提示。

后续注意：

- 后端连接流程重构时不能恢复原生 alert。

#### 构建体积与首包优化

涉及文件：

- `src/router/index.ts`
- `vite.config.ts`

行为：

- 路由页面动态导入。
- Vite/Rollup 手动拆分 `vue-vendor`、`vendor`、`echarts`、`zrender`、`table`、`drag`、`icons` 等 chunk。
- 避免首屏一次加载所有视图和大依赖。

后续注意：

- 上游同步不能恢复全部页面静态导入。
- 新增重依赖时要检查首包大小和 chunk 归属。

### feat: match proxy parents by node search

- 提交：`7384f7ab`
- 类型：搜索增强
- 目的：补齐“节点名反查父级组 / Provider”的搜索缺口，避免搜索节点名时父级代理组先被过滤掉。

涉及文件：

- `src/helper/search.ts`
- `src/helper/search.spec.ts`
- `src/composables/proxies.ts`
- `src/composables/renderProxies.ts`
- `upstream-followup/NODE-PARENT-SEARCH-PLAN.md`

行为变化：

- 搜索词命中代理组名时，保持原有行为。
- 搜索词命中组内节点名时，父级策略组 / 节点组也会显示。
- 搜索词命中已加载 Provider 内节点名时，对应 Provider 会显示。
- Provider 搜索只使用已有 `proxyProviederList` 数据，不会主动触发 `/providers/proxies`。
- 继续复用本地增强搜索能力：NFKC、符号容错、多关键词 AND、域名 label 变体。
- 规则链路 / 规则 payload 反向关联搜索保留，避免规则命中后出现空卡片。

验证：

- `pnpm test`：26/26 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- 不能直接用官方 Zashboard 3.x 的 `proxySearch.ts` 覆盖本地搜索逻辑。
- 后续如果加正则搜索，应扩展 `src/helper/search.ts`，不要绕过本地统一搜索 helper。

### fix: guard dashboard upgrade source

- 提交：`29dd6ff1`
- 类型：更新源保护 / 发布流程
- 目的：确保面板内“检查更新 / 更新面板”只指向 NebulaDash 自己的 release，避免误拉官方 Zashboard 覆盖本地改版。

涉及文件：

- `src/helper/uiUpdateSource.ts`
- `src/helper/uiUpdateSource.spec.ts`
- `src/helper/version.ts`
- `src/helper/version.spec.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/composables/settings.ts`
- `src/types/index.d.ts`
- `src/i18n/en.ts`
- `src/i18n/zh.ts`
- `src/i18n/zh-tw.ts`
- `src/i18n/ru.ts`
- `README.md`
- `PUBLICATION.md`
- `upstream-followup/NEBULADASH-ITERATION-PLAN.md`
- `upstream-followup/UPSTREAM-FEATURES.md`

行为变化：

- 版本检查仓库改为 `boostemotion/nebuladash`。
- 默认 UI 下载地址改为 `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip`。
- 面板更新按钮会检查后端配置中的 `external-ui-download-url` / `external-ui-url`。
- 如果配置仍指向官方 `Zephyruso/zashboard`，面板内更新会被禁用。
- 自动更新同样加保护，不会自动拉官方版本。

发布状态：

- 已推送 tag：`v2.8.0-nebula.1`
- Release 已生成：`https://github.com/boostemotion/nebuladash/releases/tag/v2.8.0-nebula.1`
- `latest/download/dist.zip` 已验证可访问。

验证：

- `pnpm test`：21/21 pass
- `pnpm type-check`：pass
- `pnpm lint`：pass
- `pnpm build`：pass

后续注意：

- OpenClash / 后端配置必须使用 NebulaDash release 地址，否则面板内更新按钮会按设计禁用。
- 新发布版本时，`package.json` 版本必须和 tag `v<version>` 完全匹配，否则 release workflow 会失败。

### chore: initialize NebulaDash public history

- 提交：`b28546ab`
- 类型：仓库公开化 / 历史清理
- 目的：清除旧历史后，以干净公开仓库重新发布 NebulaDash。

涉及内容：

- 远程仓库：`https://github.com/boostemotion/nebuladash`
- `origin` 指向 `boostemotion/nebuladash`
- `upstream` 指向 `Zephyruso/zashboard`
- 清理公开仓库风险文件，保留项目源码和维护文档。

后续注意：

- 从官方同步时只 fetch / compare `upstream`。
- 推送只推 `origin`。
- 发布前继续检查 `.env`、密钥、生成包、缓存目录和本地临时文件不得进入 Git。
