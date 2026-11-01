# NebulaDash 二改说明（相对上游 Zashboard v3.30.0）

本文件说明当前版本相对官方 Zashboard 的具体改动，供审阅与回归使用。

- 当前版本：`3.30.0-nebula.3`
- 上游基线：Zashboard `v3.30.0`（`bf4f00b`）
- 本地补丁规模：`src/` 范围约 2900 行改动 / 19 个新文件
- 旧实现（基线 2.8.0 的独立版本）：tag `legacy/nebula-2.8.0`

---

## 1. 代理页三段视图

上游只有“代理 / 代理提供商”两段，策略组与节点组混排。

- `PROXY_TAB_TYPE` 拆为 `STRATEGY` / `NODE` / `PROVIDER`，旧持久化值 `proxies` 自动迁移。
- 拆分规则：`/rules` 已加载时按“规则目标”判定策略组，否则回退到代理类型
  （`selector / urltest / fallback / loadbalance / smart`）。
- 每个标签独立记忆滚动位置；沿用上游虚拟滚动与列式布局。
- 代理文件夹 UI 只在策略组 / 节点组显示。

关键文件：`src/constant/index.ts`、`src/helper/proxies.ts`、`src/store/proxies.ts`、
`src/views/ProxiesPage.vue`、`src/components/controls/ProxiesCtrl.tsx`

## 2. Provider 加载优化

上游 `assembly/driver/clash.ts` 用 `Promise.all([/proxies, /providers/proxies])`，
且 `fetchProxyProviderAPI` 没有超时。

- `fetchProxyProviderAPI` 增加 15 秒独立超时。
- `ProxiesDriver.fetch(options)` 默认只取 `/proxies`；新增可选 `fetchProviders()`。
- 新增 `fetchProxyProviders(force)`：按需加载、并发去重、代际校验、失败降级、
  60 秒通知去重。
- 新增 `hydrateProxiesFromCache()` / `resetProxyState()`：切后端先用缓存起屏。
- 缓存键按后端 UUID 隔离：`cache/proxy-data|proxy-providers|proxy-provider-meta/<uuid>`，
  删除后端时联动清理。
- 状态机 `idle / loading / fresh / cached / stale / timeout / error`，
  界面上有徽标（含请求耗时与最近更新时间）。

关键文件：`src/api/clash.ts`、`src/assembly/driver/{types,clash}.ts`、
`src/assembly/proxies/{state,actions}.ts`、`src/assembly/session.ts`、
`src/helper/proxy-cache.ts`、`src/store/setup.ts`

## 3. 节点组聚类排序

上游没有聚类相关实现。

- 同前缀簇相邻，簇内 `故转 > 手动 > 自动 > 负载均衡 > 其他`。
- 簇间优先被策略组引用次数多的簇，其次按基础名自然排序（`zh-Hans-CN`, numeric）。
- 聚类词表可在代理页设置对话框编辑，存储键 `config/node-cluster-variants`。

关键文件：`src/helper/node-group-cluster.ts`、`src/store/settings.ts`

## 4. 搜索增强

上游搜索 = 空白分词 + 每段当正则 + AND，没有任何文本规范化。

- 新增 `toSmartSearchMatcher()`：每个关键词按 **正则 → NFKC 规范化包含 → 符号容错包含**
  三级匹配，并展开域名 label 变体。
- `toSearchRegex()` 保持上游严格正则语义，仅供“快速过滤正则”这类显式正则入口使用。
- 主搜索入口（代理页 / 规则页 / 连接页 / 日志页）改用智能匹配。
- 规则搜索候选集加入下游链路组名与最终出口节点名（链路感知）。
- 代理页搜索支持“域名 → 规则 → 代理组”反向映射，首次搜索时补拉一次 `/rules`。
- 高亮先按原文直接匹配，无命中再回退到符号容错区间映射，保证高亮与匹配原因一致。

关键文件：`src/helper/search.ts`、`src/helper/proxy-search.ts`、
`src/helper/proxy-provider-search.ts`、`src/helper/proxies.ts`、`src/store/rules.ts`

**注意**：`|` 不作为关键词分隔符，沿用上游“每段当正则”的语义（`香港|故转` 是正则 OR）。
空格 / 逗号 / 顿号 才是 AND 分隔符。

## 5. Provider 搜索字段

上游“代理商”标签只按 Provider 名或节点名过滤。

- 组名模式下额外匹配：测试 URL、更新时间、Provider 类型、订阅流量与到期日期。
- 只使用已加载的 Provider 数据，不触发 `/providers/proxies`。

关键文件：`src/helper/proxy-provider-search.ts`、`src/helper/proxy-search.ts`

## 6. 规则直通与代理商尾标

上游有链路弹窗（drill-in modal），但没有“跳转规则”，也没有代理商尾标。

- 策略组卡片新增“规则直通”按钮，打开上游链路弹窗。
- 链路末尾显示 `代理提供商: xxx`，取自节点自带 `provider-name`；
  Provider 未加载时缺省且不触发请求。
- 弹窗内新增“跳转规则”，带入当前组名跳转规则页。
- 规则卡片的链路同样显示代理商尾标。

关键文件：`src/components/proxies/ProxyGroupHeader.vue`、
`src/components/proxies/ProxyGroupChainModal.vue`、
`src/components/common/ProxyChainPath.vue`、`src/components/rules/RuleCard.vue`

## 7. 品牌与版本治理

- 包名 `nebuladash`，版本 `<上游版本>-nebula.<轮次>[.<功能>[.<修复>]]`。
- 页面标题、路由标题、PWA manifest 统一为 NebulaDash。
- `src/helper/release-version.ts`：版本比较与更新状态（available / current / ahead / unknown）。
- `src/helper/release-preflight.ts` + `tools/release-preflight.ts`：`pnpm release:check`。
- 界面显示版本、commit、构建时间。

## 8. 更新源保护

上游更新源指向 `Zephyruso/zashboard`，会导致把 NebulaDash 覆盖成官方版。

- 更新检查固定查询 `boostemotion/nebuladash` Release。
- 后端 `external-ui-download-url` 不指向 NebulaDash Release ZIP 时：
  隐藏“更新面板 / 自动更新面板”，并在设置页显示要求地址。
- `checkUIUpdate()` 在更新源不可信时不触发自动升级。

关键文件：`src/helper/ui-update-source.ts`、`src/assembly/version.ts`、
`src/components/settings/general/{GeneralSettings,ZashboardSettings}.vue`

## 9. 路由器端自管理更新器

- 源码 `router-updater/`，运行 `/usr/share/nebuladash-updater/`，
  CGI `/www/cgi-bin/nebuladash-updater`，面板入口 `/www/nebuladash`。
- A/B 分区部署（`/www/nebuladash-a|b`），校验 `index.html` / `assets/` / `manifest.webmanifest`
  后才切 symlink，失败不切换，支持回滚。
- 动作仅 `status / update / rollback`，需 token；
  同时发送 header `X-NebulaDash-Token` 与 query `token`，兼容 uHTTPd 不转发自定义 header。
- 下载使用 `curl -L --http1.1`：部分路由器上 HTTP/2 + TLS 会话复用到
  `release-assets.githubusercontent.com` 会握手失败。
- 前端更新前做版本风险确认（同版本 / 更旧 / 无法确认需二次确认），更新中轮询阶段。

关键文件：`router-updater/*`、`src/helper/router-updater.ts`、
`src/api/router-updater.ts`、`src/components/settings/general/RouterUpdaterSettings.vue`

## 10. 构建与首包

上游路由全静态导入、`vite.config` 没有 `manualChunks`，入口 chunk 约 2167 kB。

- 路由页面全部动态导入。
- `manualChunks` 拆出 `three` / `echarts` / `zrender` / `table` / `drag` / `icons` / `vue-vendor`。
- 入口 chunk 降至约 **88 kB**。

关键文件：`src/router/index.ts`、`vite.config.ts`

## 11. 设置导入键清洗

- 导入 / 从内核同步设置时忽略历史无效键：
  `config/icon-size`、`config/icon-margin-right`、`config/use-large-proxy-group-icon`、
  `config/singbox-channel`、`config/use-singbox`。
- NebulaDash 自有键（`config/node-cluster-variants`、`config/router-updater-*`）可正常导入。

关键文件：`src/helper/settings-keys.ts`、`src/helper/utils.ts`

## 12. 工程与回归

- 新增 `pnpm test`（`node:test`，覆盖版本比较、发布预检、更新源、缓存、
  聚类排序、搜索、Provider 搜索、设置键），共 71 项。
- 新增 `pnpm test:nebula`（headless Chrome 行为回归，22 项）：
  三段视图、首屏 0 次 Provider 请求、切换后恰好 1 次、状态徽标、
  域名反向映射、角色拆分、链路弹窗与代理商尾标、跳转规则、设置页更新源保护。
- 新增 `pnpm zip:dist`：无 `zip` 命令环境下的本地打包。
- 新增 `start-za.ps1` / `start-za.cmd`（要求 Node.js 22+）。

---

## 未移植 / 由上游覆盖的旧特色

以下能力上游已提供且更完善，因此**不再保留本地实现**：

| 旧本地实现                                | 现在                                        |
| ----------------------------------------- | ------------------------------------------- |
| 首屏只渲染前 16 条分组                    | 上游虚拟滚动（`VirtualColumn`）             |
| `proxyNodeProviderMap` 节点→Provider 映射 | 上游在 `applyProxyData` 打 `provider-name`  |
| 规则按需加载（进入代理页不拉规则）        | 上游会拉；本地仅在搜索时补拉兜底            |
| 代理页滚动位置恢复                        | 上游 `helper/proxies-scroll.ts`             |
| 搜索高亮、搜索模式切换                    | 上游 `helper/search.ts` + `proxy-search.ts` |
| 移动端视口 / overscroll / 弹窗高度        | 上游 `use-overscroll-lock` 等               |
| Setup 连接失败提示                        | 上游 `describeProbeFailure()` 更细          |
| 规则卡片展开动画 / 分段控件               | 上游 3.x 视觉体系                           |

## 行为差异（有意为之）

- 旧版“规则直通”在卡片内**内联展开**链路；现在用上游**链路弹窗**，
  并在弹窗内直接切换下游组面板（虚拟滚动下比“切分段+滚动定位”更稳）。
- 旧版“跳转规则”按钮在卡片上；现在在链路弹窗内。
- 聚类词表从“设置页 → 代理”移到了“代理页右上角设置对话框”。

## 关键实现文件索引

- 三段视图与聚类：`src/helper/proxies.ts`、`src/helper/node-group-cluster.ts`
- Provider 层：`src/assembly/proxies/*`、`src/helper/proxy-cache.ts`
- 搜索：`src/helper/search.ts`、`src/helper/proxy-search.ts`、`src/helper/proxy-provider-search.ts`
- 规则直通：`src/components/proxies/ProxyGroupHeader.vue`、`ProxyGroupChainModal.vue`、`ProxyChainPath.vue`
- 更新治理：`src/helper/release-version.ts`、`src/helper/ui-update-source.ts`、`.github/workflows/release.yml`
- 更新器：`router-updater/*`、`src/components/settings/general/RouterUpdaterSettings.vue`

## 验证

```bash
pnpm test          # 71 项
pnpm type-check
pnpm lint
pnpm build
pnpm release:check
pnpm test:nebula   # 22 项（需 Chrome）
```

以上在 `3.30.0-nebula.3` 上全部通过。

## 手动实测清单（建议，路由器实机）

### A. 代理页三段

1. 打开代理页，确认顶部为 `策略组 / 节点组 / 代理商`
2. 默认进入策略组时，打开开发者工具 Network，确认**没有** `/providers/proxies`
3. 切到“代理商”，确认只请求一次；网络慢时显示“加载中 / 超时”徽标且旧数据仍在

**预期**：策略组首屏不被 Provider 拖慢；超时后页面仍可用。

### B. 节点组聚类

确认 `香港-手动 / 香港-自动 / 香港-故转` 相邻，且顺序为 `故转 → 手动 → 自动`。

### C. 搜索

- 规则页：`ChatGPT`、`香港-故转`、`香港-自动`、`Gemini,香港-故转`
- 代理页：`香港 自动`、`google.com`
- 全角输入、标点容错

**预期**：能命中上游规则（链路感知）；`google.com` 能显示相关策略组（反向映射）。

### D. 规则直通

1. 策略组卡片点“规则直通”
2. 观察链路末尾是否有 `代理提供商: xxx`
3. 点弹窗内“跳转规则”，确认规则页已带入该组名

### E. 更新治理

1. 设置 → 面板：确认显示“路由器更新器”区块
2. 填入更新器 token 后点“检查更新器”
3. 点“更新 NebulaDash”，观察阶段提示与成功刷新

## 路由器实测记录（2026-11-01）

- 设备：ImmortalWrt-798x-24.10（aarch64），OpenClash
- 现象：`updater.sh update` 在 302 跳转到 `release-assets.githubusercontent.com` 后
  TLS 握手失败（`curl: (35)`）
- 处理：下载改为 `curl -L --http1.1`，更新成功，`active` 切到 `a` 分区
- 结果：`three-*.js` 存在、`interactive-widget` 存在、`assets` 350 个，
  面板显示 `NebulaDash 3.30.0-nebula.2`
