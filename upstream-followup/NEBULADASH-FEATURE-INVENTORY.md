# NebulaDash 本地特色清单（重基线用）

本文把 NebulaDash 相对上游 Zashboard 的**全部本地特有行为**整理成可重放的规格。

用途：

- 以官方最新版重建基线时，按本文逐条重放，不依赖聊天记录。
- 判断某项能力是否已被上游覆盖，从而决定「采用上游 / 保留本地 / 舍弃」。
- 上游同步后做回归时，用本文的约束逐条比对。

**基线事实（2026-06-29 记录）**

- 当前包版本：`2.8.0-nebula.4.2.0`
- 本地代码基线：Zashboard `2.8.0`
- 与 `upstream/main` 无 merge-base，不能 merge/rebase
- 本地能力不是「落后于上游」，而是代理页/搜索/Provider/更新治理四条线已经是独立实现

**记录原则**

- 每条都写「不可回归的约束」，重写实现可以不照抄代码，但必须满足约束。
- 标 `[本地独有]` 的是上游没有等价物，必须重做。
- 标 `[上游已有]` 的应优先采用上游实现，本地实现可丢弃。
- 标 `[待核对]` 的必须在拿到上游最新代码后确认，再决定取舍。

---

## 1. 代理页三段视图 `[本地独有]`

**问题**：OpenClash 多 Provider 环境下 `/providers/proxies` 需要 10s~20s 甚至超时，原版把策略组、节点组、Provider 混在同一页，慢接口直接拖死首屏。

**行为**

- 代理页顶部三个 Tab：策略组 / 节点组 / 代理商，替代原版「代理 / 代理提供商」。
- 三个 Tab 只渲染各自的分段，不混排。
- 首屏只请求 `/proxies`；只有切到「代理商」Tab 才请求 `/providers/proxies`。
- 每个 Tab 独立记忆滚动位置。
- Tab 上显示数量；加载中显示 `...`。

**不可回归的约束**

1. 策略组、节点组首屏不得等待 `/providers/proxies`。
2. `/providers/proxies` 不得在应用启动或进入代理页时自动请求。
3. Provider 请求失败/超时不得清空已有代理数据，不得向页面抛未处理 Promise。

**关键文件与实现点**

| 位置                                     | 职责                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/composables/proxies.ts`             | `splitProxyGroupsByRole()`、`proxySections`、`isProxiesPageMounted` 首屏上限 |
| `src/store/proxies.ts`                   | `proxiesTabShow`、Provider 加载状态与缓存                                    |
| `src/components/sidebar/ProxiesCtrl.tsx` | Tab 渲染、数量、Provider 状态徽标、切换 Tab 时触发 `fetchProxyProviders()`   |
| `src/views/ProxiesPage.vue`              | 分段渲染、按 section 选组件、滚动恢复、按需拉 Provider                       |

**分组判定规则（`splitProxyGroupsByRole`）**

- 若 `/rules` 已加载：`rule.proxy` 集合内的组 → 策略组，其余 → 节点组。
- 若 `/rules` 未加载：回退到类型判定，`selector | urltest | fallback | loadbalance | smart` → 策略组，其余 → 节点组。

**首屏渲染上限**

- 页面挂载完成前，`renderGroups` / `proxySections` 只输出前 16 条，避免大配置一次性渲染。
- `onMounted` 后 `setTimeout` 置 `isProxiesPageMounted = true`，随后放开全量。

**与上游冲突点**：上游 3.x 已重构代理页与 Tab 导航（`SegmentedControl`）、移动端布局。重放时应保留「按角色分段 + Provider 独立按需加载」这一行为，视觉/控件层尽量用上游实现。

---

## 2. 节点组聚类排序 `[本地独有]`

**问题**：节点组命名带后缀（`香港-手动` / `香港-自动` / `香港-故转`），上游按原始顺序或名称排序会把同地区拆散。

**行为**

- 同前缀簇自动相邻。
- 簇内顺序固定：`故转 > 手动 > 自动 > 负载均衡 > 其他`。
- 簇间顺序：优先「被策略组引用次数多」的簇，其次按基础名 `localeCompare('zh-Hans-CN', { numeric: true })`。
- 聚类词表可配置。

**实现要点（`src/composables/proxies.ts`）**

- `normalizeNodeGroupBaseKey()`：NFKC → 折叠空白 → 去掉尾部 `【…】` / `（…）` → 去掉分隔符 + 变体词尾巴 → `toLocaleLowerCase('zh-CN')`。
- `getNodeVariantRank()`：fallback=0，manual=1，auto=2，其余按配置词表下标，未命中=9。
- `countNodeGroupUsageInStrategyGroups()`：沿策略组 `now` 链遍历计数（带 visited 防环）。
- 簇代表：优先取簇内 fallback 组，否则取被引用最多的组，用于簇间排序比较。
- 排序稳定性：最终回落到原始下标。

**配置**

- `config/node-cluster-variants`（`string[]`，元素是正则片段，如 `手动|manual`）
- 默认：`['手动|manual', '自动|auto', '故转|故障转移|fallback', '负载均衡|负载|均衡|loadbalance|balance|lb']`

**约束**：聚类不得改变隐藏组过滤、搜索过滤的结果集合，只改变顺序。

---

## 3. Provider 延迟加载 / 缓存 / 降级 / 去重 / 可观测 `[本地独有]`

这是本地最有价值、上游完全没有的一层。

**缓存键（按后端 UUID 隔离）**

```text
cache/proxy-data/<backend-uuid>
cache/proxy-providers/<backend-uuid>
cache/proxy-provider-meta/<backend-uuid>
```

实现：`src/helper/proxyCache.ts` 的 `getProxyCacheKey(kind, uuid)`、`getProxyCacheKeysForBackend()`、`clearProxyCacheForBackend()`。

**元数据**

```ts
type ProviderCacheMeta = {
  fetchedAt: number
  durationMs: number
  status: 'fresh' | 'cached' | 'stale' | 'timeout' | 'error'
}
```

**状态机（`proxyProviderLoadStatus`）**

`idle → loading → fresh | cached | stale | timeout | error`

- 缓存 < 30 分钟 → `cached`；≥ 30 分钟 → `stale`（`getCachedProviderLoadStatus()`，常量 `PROVIDER_CACHE_FRESH_DURATION = 30 * 60 * 1000`）。
- 失败判定：`ECONNABORTED` / `ETIMEDOUT` → `timeout`，其余 → `error`（`getProviderFailureStatus()`）。

**关键行为**

1. `/providers/proxies` 使用独立 15s 超时（`src/api/index.ts` 的 `fetchProxyProviderAPI`）。
2. `fetchProxyProviders(force = false)`：
   - 无 `/proxies` 数据时先 `fetchProxies()`；
   - `hasLoadedProxyProviders && !force` 直接返回；
   - 进行中复用 `proxyProviderLoadingPromise`（并发去重）；
   - `force = true` 用于「刷新全部 Provider」后强制重拉。
3. `fetchGeneration` + `activeUuid` 双校验：切换后端或并发刷新后，过期响应直接丢弃，不污染当前后端。
4. 失败时：保留旧缓存，写入 `status = timeout | error`，**不抛错到页面**。
5. 失败通知 60s 去重（`shouldNotifyProviderFailure()`，`PROVIDER_FAILURE_NOTIFICATION_DEDUPE = 60 * 1000`），通知 key 为 `proxy-provider-load-<uuid>`，文案 `providerLoadTimeoutTip` / `providerLoadErrorTip`。
6. 成功加载或切换后端后重置失败通知窗口。
7. Provider 过滤：丢弃 `name === 'default'` 和 `vehicleType === 'Compatible'`。
8. `applyProxyData()` 合并顺序：先 Provider 节点，再 `/proxies` 覆盖（`/proxies` 优先），随后套用 `iconReflectList` 图标、IPv6 extra、smart 组初始化。
9. 删除后端时同步清理该 UUID 的全部代理缓存（`removeBackend` 调 `clearProxyCacheForBackend`）。
10. `hydrateProxyStateFromCache()` 在 `activeUuid` 变化时（`immediate: true`）先用缓存起屏。

**界面呈现（`ProxiesCtrl.tsx`）**

- Provider Tab 显示状态徽标：`loading/cached/stale/fresh/timeout/error` → `badge-info/success/warning/error`。
- 徽标 `title` 显示请求耗时 `NNN ms` 与最近更新时间。
- 「刷新全部 Provider」按钮：并行 `updateProxyProviderAPI` → `fetchProxies()` → `fetchProxyProviders(true)`。

**i18n key**

`providerStatusCached` `providerStatusStale` `providerStatusFresh` `providerStatusTimeout` `providerStatusError` `providerLoadTimeoutTip` `providerLoadErrorTip`

**约束**：不得为了显示 Provider 尾标而让所有代理卡片反复遍历完整 Provider 列表（用 §5 的映射代替）。

---

## 4. 规则按需加载 `[本地独有]`

**行为**：代理页首次出现非空搜索词时才补拉 `/rules`，用于规则联动搜索；进入代理页本身不请求 `/rules`。

**实现**：`ProxiesCtrl.tsx` 内 `watch(proxiesFilter)`，用 `hasFetchedRulesForSearch` 只触发一次；`fetchRules()` 失败时静默回退为组名/节点名搜索。

**约束**：`/rules` 接口不可用时，搜索必须仍返回组名/节点名命中结果。

---

## 5. 节点 → Provider 预映射 `[本地独有]`

**行为**：`proxyNodeProviderMap`（`computed`）预先建立 `节点名 → Provider 名`，供规则直通尾标和 Provider 分组复用，避免每张卡片遍历 Provider 列表。

**约束**：只能基于已取得的 Provider 数据；未加载时尾标允许缺失，**不得触发阻塞式请求**。

**尾标解析优先级**（`ProxyGroup.vue`）：节点自带 `provider-name` > `proxyNodeProviderMap` > 空。

---

## 6. 统一搜索工具 `[本地独有内核 / 上游已有搜索]` `[待核对]`

`src/helper/search.ts` 提供：

- `normalizeSearchText()`：`NFKC` + 小写 + trim。
- `simplifySearchText()`：再剥掉所有非字母数字（符号容错）。
- `splitSearchTerms()`：按 `空格 / 逗号 / ，、/ |` 切分，丢弃空项。
- `matchesSearchTerm(candidate, term)`：先直匹配，再简化匹配。
- `getSearchTermVariants(term)`：含 `.` 时拆域名 label，过滤 `DOMAIN_LABEL_IGNORE`（com/net/org/cn/top/xyz/cc/co/io/gov/edu/www）、长度 < 2、纯数字。
- `matchesSearchTarget()`：**多关键词 AND**，每个 term 只要任一 variant 命中即可。
- `matchesSearchTargets(parentName, childNames, terms)`：父名或任一子名整体命中。
- `buildHighlightedParts()`：生成高亮分段；先做直接区间扫描，无命中再回退到「简化文本 → 原文区间映射」，最后合并重叠区间。

**约束（搜索不可回归项）**

- 多关键词 AND 语义：`香港 自动`、`香港|故转`、`Gemini,香港-故转` 必须保持 AND。
- 域名 label 变体：`google.com` 能命中含 `google` 的规则/组名。
- 全角与符号容错：`ｇｏｏｇｌｅ`、`google-com` 可命中。
- 高亮必须与实际匹配规则一致（含简化匹配回退路径）。

**与上游关系**：上游 3.6+ 有统一搜索/正则/节点搜索模式，3.8 有搜索高亮。**重基线时应以上游搜索为骨架**，把上面这些语义作为扩展注入；不要长期维护两套搜索。

---

## 7. 代理页搜索的规则联动（反向映射） `[本地独有]`

**行为**：在代理页搜索域名/规则关键词时，若命中某条规则，则把该规则指向的代理组**及其下游链路组**一并显示，即「域名 → 规则 → 策略组/节点链路」反向映射。

**实现（`src/composables/proxies.ts`）**

- `getLinkedGroupsFromRules(terms)`：遍历 `rules`，候选集为 `[rule.type, rule.payload, rule.proxy, ...getProxyGroupChains(rule.proxy)]`，对每个 term 做 variant 匹配，全部 term 命中才计入；命中后把链路组与 `rule.proxy` 加入结果集。
- `getRenderGroups()`：搜索时，`linkedGroups.has(groupName)` 直接通过，否则走组名 + 子节点名匹配。

**约束**：Provider 未加载时该能力仍要工作（只依赖 `/rules` 与 `/proxies`）。

---

## 8. 规则页链路感知搜索 `[本地独有]`

**行为**：规则匹配不只看 `type / payload / proxy`，还匹配规则代理组的**下游链路节点名**。

**实现（`src/store/rules.ts`）**

- `renderRules`：候选集 `[rule.type, rule.payload, rule.proxy, ...getProxyGroupChains(rule.proxy)]`，多关键词 AND，variant 匹配。
- `renderRulesProvider`：候选集 `[name, behavior, vehicleType]`。
- `fetchRules()`：把 `route(xxx)` 形式的 proxy 归一化为 `xxx`。

**约束**：搜索 `香港-故转` / `香港-自动` 能筛出上游 `ChatGPT`、`Gemini` 等规则。

---

## 9. 规则直通 + 链路导航 + Provider 尾标 `[本地独有]`

**行为（策略组卡片内）**

- 「规则直通」按钮：展开完整链路，形如 `ChatGPT → 香港-故转 → 香港-自动 → 代理提供商: xxx`。
- 「跳转规则」按钮：切到规则页并把筛选词设为当前组名。
- 链路节点可点击：折叠（展开）目标组 → 切换到目标分段 → 定位并展开目标卡片。
- 链路末尾显示最终节点所属 Provider。

**实现（`src/components/proxies/ProxyGroup.vue`）**

- `isStrategyGroup`：类型属于 `selector|urltest|fallback|loadbalance|smart`。
- `proxyChains = getProxyGroupChains(name)`（沿 `now` 链，且下一跳必须是代理组）。
- `finalProviderName`：`getNowProxyNodeName()` → `provider-name` → `proxyNodeProviderMap`。
- `handleChainClick(chain)`：`collapseGroupMap[chain] = true` → `skipNextProxiesTabRestore = true` → 先试 `PROXY_TAB_TYPE.NODE`，`querySelector('[data-group-name="..."]')` 命中则 `scrollToGroup()`；否则切 `STRATEGY` 再 `scrollToGroup()`。
- `openRulesShortcut()`：`rulesTabShow = RULES`，`rulesFilter = 组名`，`router.push(rules)`。

**约束**

- Provider 未加载时链路展开与跳转不得阻塞（尾标可缺省）。
- 点击链路节点必须「切换到对应分段 + 展开目标卡片」，不能只滚到分段顶部。

**i18n key**：`ruleShortcut` `goToRules` `fullChain` `proxyProvider`

---

## 10. 搜索高亮 `[上游已有 / 本地已实现]`

**行为**：命中文本高亮，覆盖代理组、节点卡片、Provider、规则卡片、Rule Provider、链路节点、Provider 尾标。

**实现**：`src/components/common/HighlightedText.vue` + `buildHighlightedParts()`；调用方通过 `:query="proxiesFilter | rulesFilter"` 传入查询串。

**与上游关系**：上游 3.8 已有搜索高亮，**重基线时优先采用上游组件**，只需保证简化匹配与域名变体的高亮一致性。

---

## 11. 代理页滚动位置恢复 + 分段懒渲染 `[本地独有]`

**行为**

- 三个 Tab 各自记忆滚动位置，Tab 切换后恢复。
- 链路跳转时可跳过本次恢复（`skipNextProxiesTabRestore`）。
- 恢复采用「等待可滚动高度就绪」策略：`requestAnimationFrame` 轮询，300ms 超时后强制一次。

**实现**

- `useSessionStorage('cache/proxies-scroll-status')`，键为 `PROXY_TAB_TYPE`。
- `helper/viewport.ts` 的 `shouldRestoreProxyScroll(scrollHeight, target, isTimedOut)`。
- `ProxiesPage.vue` 的 `waitTickUntilReady()`、`handleScroll()`。
- 所有 `scrollHeight` / `scrollTop` / `scrollTo()` 访问前必须判空（上游已有同类防护，可复用）。

**注意**：旧文档提到的 `useCalculateMaxProxies`（`src/composables/proxiesScroll.ts`）仍存在，但当前代理页未使用分段懒加载卡片，重放时按上游实际结构决定是否需要。

---

## 12. 设置导入兼容清洗 `[本地独有]`

**行为**：导入设置时过滤历史无效键，且只接受「当前 localStorage 中已存在」的键，避免污染。

**实现（`src/helper/autoImportSettings.ts`）**

```ts
const DEPRECATED_IMPORT_KEYS = new Set([
  'config/icon-size',
  'config/icon-margin-right',
  'config/use-large-proxy-group-icon',
])
const isImportKeyAllowed = (key) =>
  !DEPRECATED_IMPORT_KEYS.has(key) &&
  (key === 'config/import-settings-url' || localStorage.getItem(key) !== null)
```

**约束**：NebulaDash 专用设置键（`config/node-cluster-variants`、`config/router-updater-*`）必须能正常导出并可恢复。

**与上游关系**：上游有更完整的设置同步/导入导出，`[待核对]` 是否已含键白名单；若上游已实现，把本地废弃键清单并入上游白名单即可。

---

## 13. 品牌与版本治理 `[本地独有]`

**行为**

- 面板名统一为 `NebulaDash`：页面标题、运行时路由标题、PWA `manifest.name/short_name`、`description`。
- 版本号采用 Nebula 多级规则：`x.y.z-nebula.a[.b[.c]]`（a=大功能轮次，b=小功能轮次，c=bugfix 计数）。
- 界面显示版本、commit、构建时间（`__APP_VERSION__` / `__COMMIT_ID__` / `__BUILD_TIME__`）。
- `helper/version.ts`：`NEBULADASH_REPOSITORY`、`getLatestReleaseApiUrl()`、`compareReleaseVersion()`、`isNewerReleaseVersion()`、`getReleaseUpdateState()` → `available | current | ahead | unknown`。

**关键文件**

- `vite.config.ts`（manifest + define）
- `src/router/index.ts`（`useTitle('NebulaDash')`、`NebulaDash | <route>`）
- `src/helper/version.ts`
- `src/components/common/BackendVersion.vue`

---

## 14. 更新源保护 `[本地独有]`

**问题**：OpenClash 的 UI 下载地址若指向官方 Zashboard，点「更新面板」会把 NebulaDash 覆盖成官方版。

**行为**

- 更新源固定检查 `boostemotion/nebuladash` 的 GitHub Release。
- 检查后端 `external-ui-download-url` / `external-ui-url`；不是 NebulaDash Release ZIP 时，禁用「更新面板」与自动更新，并在设置页显示要求地址：

```text
https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

- 进入设置页自动检查 Release，有新版本显示红点；「检查更新器」与「检查新版本」是两个独立按钮。

**关键文件**

- `src/api/index.ts`：`fetchIsUIUpdateAvailable()`、`fetchUIUpdateState()`
- `src/helper/version.ts`
- `src/composables/settings.ts`
- `src/components/settings/ZashboardSettings.vue`（`isVisibleUpgradeUI`、`requiredUiDownloadUrl`）

**重基线注意**：仓库名与下载地址是**品牌常量**，必须整体替换，不能沿用上游 `zashboard` 常量。

---

## 15. 路由器端自管理更新器 `[本地独有]`

**行为**

- 前端设置页提供：更新器地址、更新器密钥、检查更新器、更新 NebulaDash、回滚 NebulaDash。
- 更新前检查 latest Release：无法确认版本 / 同版本 / 远端更旧 → 弹出风险确认（`routerUpdaterSameVersionConfirm` / `routerUpdaterDowngradeConfirm` / `routerUpdaterUnknownVersionConfirm`）。
- 更新期间轮询 `status`，显示阶段（下载、解压、切换分区）。

**端约定**

| 项       | 值                                                         |
| -------- | ---------------------------------------------------------- |
| 源码目录 | `router-updater/`                                          |
| 运行目录 | `/usr/share/nebuladash-updater/`                           |
| CGI 入口 | `/www/cgi-bin/nebuladash-updater`                          |
| 面板入口 | `/www/nebuladash`                                          |
| 分区     | `/www/nebuladash-a`、`/www/nebuladash-b`                   |
| 部署策略 | A/B 分区，验证 index.html / assets / manifest 后切 symlink |
| 动作     | 仅 `status` / `update` / `rollback`                        |
| 认证     | header `X-NebulaDash-Token`，缺失回退 query `token`        |

**关键文件**

- `router-updater/updater.sh` `install.sh` `nebuladash-updater.cgi` `smoke-test.sh` `README.md`
- `src/helper/routerUpdater.ts`（`buildRouterUpdaterUrl/Headers`、`parseRouterUpdaterResponse`、`getDefaultRouterUpdaterEndpoint`）
- `src/api/routerUpdater.ts`
- `src/components/settings/ZashboardSettings.vue`
- `src/store/settings.ts`

**约束**

- 不得做成可传任意 shell 命令的入口。
- 更新失败不得切换 active 分区。
- 兼容 CRLF（Windows 打包）与 uHTTPd 不转发自定义 header 的情况。

**与上游关系**：完全独立，不受上游重构影响，重基线时整块搬运。

---

## 16. 构建拆包与路由懒加载 `[本地独有]`

**行为**

- 全部路由页面 `() => import()` 动态导入。
- `manualChunks` 拆出：`echarts`、`zrender`、`table`（`@tanstack`）、`drag`（`vuedraggable/sortablejs`）、`icons`（`@heroicons`）、`vue-vendor`（`vue`/`vue-router`）、其余 `vendor`。

**约束**：重基线后不得恢复为全量静态导入；不得重新出现 >500kB 的 chunk 警告（`echarts` 除外）。

**关键文件**：`src/router/index.ts`、`vite.config.ts`

---

## 17. 发布治理 `[本地独有]`

**行为**

- `pnpm release:check` → `tools/release-preflight.ts` → `src/helper/releasePreflight.ts` 校验：包名 `nebuladash`、版本符合 `x.y.z-nebula.a[.b[.c]]`、`tag === v<version>`。
- `.github/workflows/release.yml` 构建并上传 `dist.zip` 与 `router-updater.zip`。
- `PUBLICATION.md` 规定公开仓库与发布隔离规则。
- 测试基线 `pnpm test` 跑 `src/**/*.spec.ts`（`node --test --experimental-strip-types`）。

**已有测试**：`src/helper/proxyCache.spec.ts`、`search.spec.ts`、`version.spec.ts`、`releasePreflight.spec.ts`

---

## 18. 移动端视口与滚动稳定性 `[上游已有 / 部分本地已做]`

**行为**

- `--app-height` 由 `visualViewport.height` 同步（`getAppViewportHeight()`）。
- 监听 resize / scroll，卸载时清理。
- iOS 垂直边界滚动锁，保留横向手势（`shouldPreventVerticalOverscroll()`）。
- 代理页滚动引用判空、`requestAnimationFrame` 循环在卸载后停止。

**关键文件**：`src/composables/useViewportHeight.ts`、`src/helper/viewport.ts`

**与上游关系**：上游 3.9/3.11 有更完整的 iOS 视口、动态视口高度、软键盘 inset 处理。**重基线时优先采用上游**，本地只保留 `shouldRestoreProxyScroll` 这类被 §11 复用的纯函数。

**待实机验证**：iOS Safari、Android Chrome、OpenClash 内嵌 WebUI、KSU WebUI。

---

## 19. 设置页连接失败体验 `[本地独有]`

**行为**

- 提交后端配置时若不可达，不弹浏览器原生 `TypeError: Failed to fetch`，改为面板通知 `backendConnectionFailed`。
- 401 单独走 `unauthorizedTip`。
- 提交期间按钮显示 `checking` 并禁用（`isSubmitting`）。
- 必填项缺失显示本地化提示。

**关键文件**：`src/views/SetupPage.vue`、`src/i18n/*`

---

## 20. 上游小修复的本地落地（保持同步即可）

- `83dda306`：`.setting-item-label` 宽度、`customGlobalNode` 下拉宽度 → `src/assets/main.css`、`src/components/settings/ProxiesSettings.vue`
- `6f65c3bf`：`@utility select { appearance: none; }` → `src/assets/main.css`

**重基线后**：这两项以上游为准，不再单独维护。

---

## 21. 一键启动脚本 `[本地独有 / 可丢弃]`

- `start-za.ps1`：检查环境 → 首次 `pnpm install` → 打开浏览器 → `pnpm dev`。
- `start-za.cmd`：双击转发 PowerShell。
- `-Check` 仅做环境检查。

**重基线时**：属开发便利脚本，与上游无关，直接搬运，低优先级。

---

## 22. 重复功能取舍表

> 上游 3.x 覆盖本地能力时，默认**采用上游**，只在 OpenClash 慢后端这一不可替代点上保留自有实现。
> 标 `[待核对]` 的项必须拿到上游最新代码后逐条确认。

| #   | 能力                                                     | 上游现状                                   | 本地现状                                        | 决策                                            |
| --- | -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- | ----------------------------------------------- |
| 1   | 代理页分段                                               | 3.9 移动端重构、Tab/SegmentedControl 重构  | 按角色三段（策略/节点/Provider）                | **保留行为，采用上游控件与布局** `[待核对]`     |
| 2   | Provider 按需加载+缓存+降级                              | 无等价物                                   | 完整实现                                        | **必须保留**                                    |
| 3   | Provider 请求去重与代际校验                              | 无                                         | `fetchGeneration` + promise 复用                | **必须保留**                                    |
| 4   | Provider 状态可观测徽标                                  | 3.2 有 Provider 视觉重做，无状态机         | `idle/loading/fresh/cached/stale/timeout/error` | **保留状态机**，视觉用上游 `[待核对]`           |
| 5   | 节点组聚类排序                                           | 无                                         | 完整实现                                        | **必须保留**                                    |
| 6   | 统一搜索内核                                             | 3.6 统一搜索/regex/节点模式                | NFKC+符号容错+AND+域名变体                      | **以上游为骨架**，注入本地语义 `[待核对]`       |
| 7   | 搜索模式切换                                             | 3.6 已有智能/节点/正则模式                 | 不做（智能搜索够用）                            | **采用上游**（不必再自己实现模式开关）          |
| 8   | 搜索高亮                                                 | 3.8 已有                                   | 已实现 `HighlightedText`                        | **采用上游**，保留简化匹配一致性                |
| 9   | 域名→规则→代理组反向映射                                 | 无                                         | 完整实现                                        | **必须保留**                                    |
| 10  | 规则页链路感知搜索                                       | 无                                         | 完整实现                                        | **必须保留**                                    |
| 11  | 规则直通/链路跳转/Provider 尾标                          | 无                                         | 完整实现                                        | **必须保留**                                    |
| 12  | 规则按需加载                                             | 无                                         | 完整实现                                        | **必须保留**                                    |
| 13  | 代理文件夹                                               | 3.7 已有文件夹管理+设置                    | 未做（原计划仅 spike）                          | **直接采用上游**，不做本地 spike                |
| 14  | 多后端标题                                               | 3.8 已有                                   | 未做                                            | **直接采用上游**                                |
| 15  | 设置同步/导入导出增强                                    | 3.5 已有                                   | 仅废弃键清洗                                    | **采用上游** + 并入本地废弃键清单               |
| 16  | 移动端视口/软键盘                                        | 3.9/3.11 更完整                            | 部分实现                                        | **采用上游**，仅保留 `shouldRestoreProxyScroll` |
| 17  | 连接状态延迟统计                                         | `314afebb` 已有                            | 未做                                            | **直接采用上游**                                |
| 18  | 代理图标映射增强                                         | `357a9d52`（面向 sing-box assembly）       | 有 `iconReflectList`                            | **待核对**：能共存就采用上游                    |
| 19  | 后端 uptime                                              | `bed57f21`（依赖 sing-box `GetStartedAt`） | 未做                                            | **不跟进**（Mihomo 无通用 startedAt）           |
| 20  | sing-box native / goroutines / USB-IP / Tailscale / 终端 | 上游已有代码                               | 未跟                                            | **保留上游代码但不主动使用**，不得删除          |
| 21  | 视觉体系（3.x 主题、动画）                               | 上游 3.0/3.9 已重构                        | 2.8 视觉                                        | **采用上游**（用户插件类界面增强挪出主线）      |
| 22  | 品牌/版本/更新源                                         | 指向 zashboard                             | 指向 nebuladash                                 | **必须保留**（整体常量替换）                    |
| 23  | 路由器更新器                                             | 无                                         | 完整实现                                        | **必须保留**（整块搬运）                        |
| 24  | 构建拆包/路由懒加载                                      | 静态导入为主                               | 手动拆包                                        | **必须保留**（除非上游已拆包）`[待核对]`        |
| 25  | 设置导入废弃键清洗                                       | 有更完整导入导出                           | 废弃键 + 存在性白名单                           | **并入上游**                                    |
| 26  | 设置页连接失败提示                                       | 未核对                                     | 已实现                                          | **待核对**：上游若已有则丢弃本地                |
| 27  | 一键启动脚本                                             | 无                                         | `start-za.ps1/.cmd`                             | 搬运，低优先级                                  |

**取舍总原则**

1. 上游有的，优先用上游；本地实现只在**满足本文「不可回归的约束」**时才保留。
2. 上游没有且解决 OpenClash 实际痛点的，全部保留：**§3 Provider 层、§2 聚类排序、§7 §8 §9 搜索与规则直通、§13 §14 §15 品牌与更新治理**。
3. 纯视觉、纯交互增强不再由 NebulaDash 维护。
4. 上游的 sing-box native / 工具链代码不删除，只是本轮不投入适配。

---

## 22.5 上游 v3.30.0 实测核对结果（2026-06-29）

上游已从 `v3.11.0` 推进到 **`v3.30.0`**（相比上次审计点 `9150a53e` 新增 **207** 个提交；`v3.11.0..v3.30.0` 共 369 个文件、+34252/−19586 行）。

对上游代码实测后，原取舍表中所有 `[待核对]` 项已有结论。

### 22.5.1 关键事实（含代码位置）

| 事实                                                  | 证据（`v3.30.0`）                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider 仍与 `/proxies` **同时请求**，无超时、无缓存 | `src/assembly/driver/clash.ts:175-186` `Promise.all([fetchProxiesAPI(), fetchProxyProviderAPI()])`；`src/api/clash.ts:70` `fetchProxyProviderAPI()` 无 `timeout` |
| 代理数据层已重写为多核驱动                            | `src/assembly/driver/{clash,dae}.ts`、`src/assembly/capabilities.ts`；**sing-box 已移除**，新增 dae                                                              |
| `src/store/proxies.ts` 只剩 12 行                     | 仅 `proxiesFilter` / `proxiesTabShow` / `hiddenGroupMap`，数据层全部搬到 `src/assembly/proxies/*`                                                                |
| 代理页只有**两段**                                    | `src/constant/index.ts:140` `PROXY_TAB_TYPE = { PROXIES, PROVIDER }`                                                                                             |
| 已有**虚拟滚动 + 列式渲染**                           | `src/views/ProxiesPage.vue` 用 `VirtualColumn`，`src/helper/proxies.ts` 的 `renderProxiesPageItems()`                                                            |
| 已有**代理文件夹**                                    | `src/store/proxy-folders.ts`、`src/components/proxies/folders/*`                                                                                                 |
| 已有**链路弹窗**（drill-in modal）                    | `src/helper/proxy-group-chain.ts` + `src/components/proxies/ProxyGroupChainModal.vue`                                                                            |
| 节点自带 `provider-name`                              | `src/assembly/proxies/actions.ts`：`proxy['provider-name']                                                                                                       |     | = provider.name` |
| 搜索 = 空白分词的正则 AND                             | `src/helper/search.ts` `toSearchRegexes()`：按 `/\s+/` 切分，每段 `new RegExp(token,'i')`，`regexes.every()`                                                     |
| 搜索有模式切换（组名 / 全局节点）                     | `src/helper/proxy-search.ts`：`PROXY_SEARCH_MODE.GLOBAL/GROUP`，`proxyGroupContainsMatchingNode()`                                                               |
| 搜索高亮已有                                          | `src/helper/search.ts` `getSearchTextParts()`                                                                                                                    |
| **无节点组聚类排序**                                  | 全库 `git grep -i cluster` 在 `src/` 无结果                                                                                                                      |
| **规则搜索无链路感知**                                | `src/store/rules.ts` `renderRules` 只 `testAny([type, payload, proxy])`                                                                                          |
| **无域名 label 变体、无 NFKC、无符号容错**            | `toSearchRegexes()` 无任何规范化预处理                                                                                                                           |
| 滚动恢复已有                                          | `src/helper/proxies-scroll.ts`                                                                                                                                   |
| 启动即拉 `/rules`                                     | `src/assembly/session.ts` 后端变化时直接 `fetchRules()`                                                                                                          |
| 路由**全部静态导入**                                  | `src/router/index.ts` 顶部 import 8 个页面                                                                                                                       |
| **vite.config 无 manualChunks**                       | 上游未做拆包（新增 echarts + three.js 后包体更大）                                                                                                               |
| 构建工具链已升级                                      | `vite ^8.1.5`、`typescript ~6.0.3`、`@types/node ^26`、新增 `eventsource-parser` / `@types/three` / `mmdb-lib`                                                   |
| 自带测试环境                                          | `test/`：`mock-server.mjs`、`mock-dae-server.mjs`、`verify.mjs`、`bench.mjs`                                                                                     |

### 22.5.2 核对后的最终取舍

| #   | 能力                                                                                                             | 上游 v3.30.0                                               | 决策                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | 代理页「策略组/节点组/代理商」三段                                                                               | 只有 PROXIES/PROVIDER 两段                                 | **保留本地行为**，但改成挂在上游 `renderProxiesPageItems` + `VirtualColumn` 上 |
| 2   | 首屏 16 条上限                                                                                                   | 上游用虚拟滚动，更优                                       | **丢弃本地**，采用上游                                                         |
| 3   | Provider 按需加载                                                                                                | 无（`Promise.all` 一起拉）                                 | **必须保留**（最高价值）                                                       |
| 4   | Provider 独立超时                                                                                                | 无                                                         | **必须保留**                                                                   |
| 5   | Provider 缓存起屏 / 旧缓存降级                                                                                   | 无                                                         | **必须保留**                                                                   |
| 6   | Provider 失败通知去重                                                                                            | 无                                                         | **必须保留**（未加载不阻塞）                                                   |
| 7   | Provider 状态机徽标                                                                                              | 无                                                         | **保留**，视觉用上游 badge                                                     |
| 8   | 节点→Provider 映射                                                                                               | 已有 `provider-name`                                       | **丢弃本地 `proxyNodeProviderMap`**，改用上游字段                              |
| 9   | 节点组聚类排序                                                                                                   | 无                                                         | **必须保留**（次高价值）                                                       |
| 10  | 搜索 NFKC / 符号容错                                                                                             | 无                                                         | **保留**：作为上游 `toSearchRegexes` 的预处理层                                |
| 11  | 搜索域名 label 变体                                                                                              | 无                                                         | **保留**：作为上游 search 的变体扩展                                           |
| 12  | 多关键词 AND                                                                                                     | **已有**（正则 every）                                     | 采用上游；`                                                                    | ` 保持上游正则 OR 语义（重基线第④组已定案：空格/逗号/顿号才是 AND 分隔符） |
| 13  | 搜索模式切换                                                                                                     | **已有**（GLOBAL/GROUP）                                   | **采用上游**，删除本地“不做模式”决策                                           |
| 14  | 搜索高亮                                                                                                         | **已有**                                                   | 采用上游 `getSearchTextParts()`                                                |
| 15  | 域名→规则→代理组反向映射                                                                                         | 无                                                         | **必须保留**（依赖上游启动即拉的 rules，实现反而更简单）                       |
| 16  | 规则页链路感知搜索                                                                                               | 无                                                         | **必须保留**                                                                   |
| 17  | 规则直通链路展开                                                                                                 | **已有 modal**                                             | **采用上游 modal**，只在上游 modal 内追加：跳转规则、Provider 尾标             |
| 18  | 链路跨分段定位                                                                                                   | 无分段概念（上游两段）                                     | 随 #1 一起重做                                                                 |
| 19  | 规则按需加载                                                                                                     | 连接就绪后拉取，存在竞态                                   | **保留按需补拉兜底**（重基线第④组实测修正：上游并非稳定在启动阶段拉到规则）    |
| 20  | 滚动位置恢复                                                                                                     | **已有**                                                   | 采用上游                                                                       |
| 21  | 代理文件夹                                                                                                       | **已有**                                                   | 采用上游                                                                       |
| 22  | 移动端视口 / overscroll / 弹窗高度                                                                               | **已有且更完整**                                           | 采用上游                                                                       |
| 23  | 后端可达性诊断 / 会话提示                                                                                        | **已有**（`use-backend-reachability`、`assembly/session`） | 采用上游；本地只补 `backendConnectionFailed` 文案差异                          |
| 24  | 设置导入废弃键清洗                                                                                               | 已有 `auto-import-settings` + 确认弹窗                     | 并入上游（废弃键清单保留）                                                     |
| 25  | 构建拆包 + 路由懒加载                                                                                            | **上游已退化**（全静态导入、无 manualChunks）              | **必须保留**（上游包体因 echarts/three.js 更大）                               |
| 26  | 品牌 / 版本格式 / 更新源保护                                                                                     | 指向 `zashboard`                                           | **必须保留**（常量整体替换）                                                   |
| 27  | 路由器更新器                                                                                                     | 无                                                         | **必须保留**（整块搬运）                                                       |
| 28  | 发布治理（release:check / release.yml）                                                                          | 无                                                         | **必须保留**                                                                   |
| 29  | sing-box native / uptime                                                                                         | **已移除 sing-box**，改为 dae/honk 驱动                    | 本地强制“不跟进”已自然失效，无需处理                                           |
| 30  | 新增上游能力（Earth 地球视图、Taildrop、自定义 CSS、toast、SegmentedControl、规则/日志表格视图、连接分组与过滤） | 已有                                                       | **直接获得**，不投入适配成本                                                   |

### 22.5.3 一句话结论

重基线后**仍需本地重写的只有 7 件事**：

1. 代理页「策略组 / 节点组 / 代理商」三段划分（挂到上游虚拟滚动结构上）
2. 节点组聚类排序
3. Provider 按需加载 + 独立超时 + 缓存降级 + 失败去重 + 状态徽标
4. 搜索的 NFKC / 符号容错 / 域名 label 变体预处理层
5. 域名→规则→代理组的反向映射
6. 规则页链路感知搜索
7. 品牌 + 更新源保护 + 路由器更新器 + 发布治理 + 构建拆包

其余全部采用上游。**本地代码量预计从当前的独立实现下降到上游代码 + 约 2000 行以内的补丁。**

---

## 23. 重放顺序（依赖关系）

> **重基线实测修正（2026-06-29）**
>
> 1. 上游 `/rules` 不稳定在启动阶段就绪（首屏有时拿不到规则），因此代理页搜索仍需
>    “首次搜索补拉一次”的兜底，不能像原计划那样直接丢弃。
> 2. `|` 保持上游正则语义，不再作为 AND 分隔符；否则会破坏上游用户依赖的正则写法。
> 3. 上游确实没有节点组聚类排序、没有规则链路感知、没有域名反向映射，这三项必须重写（已完成）。

**重放顺序已按 §22.5.2 核对结果调整**：

```text
① 基础设施        品牌 + 版本格式 + 构建拆包 + 路由懒加载 + PWA 名称
② Provider 层     upstream api 加 15s 超时 → 拆开 driver.proxies.fetch →
                   helper/proxyCache → assembly/proxies 缓存与去重 → 失败去重与状态机
③ 代理页          在上游 renderProxiesPageItems + VirtualColumn 上做按角色三段划分 →
                   节点组聚类排序
④ 搜索            上游 toSearchRegexes 前挂 NFKC/符号/域名变体预处理 →
                   域名→规则→组反向映射（依赖上游启动即拉的 rules）
⑤ 规则            store/rules 搜索候选集加入 getProxyGroupChains（链路感知）→
                   在上游 ProxyGroupChainModal 内追加“跳转规则”与 Provider 尾标
⑥ 更新治理        helper/version → api 更新检查 → 设置页 UI → releasePreflight + release.yml
⑦ 更新器          router-updater/ 整块 + helper/api + 设置页按钮 + 轮询
⑧ 收尾            设置导入废弃键并入上游白名单 + Setup 文案 + 启动脚本
```

**已从重放清单删除的项**（上游已覆盖，采用上游即可）：首屏 16 条上限（改虚拟滚动）、
`proxyNodeProviderMap`（改 `provider-name`）、规则按需加载（上游启动即拉）、
滚动恢复、搜索高亮、搜索模式切换、移动端视口、后端可达性诊断。

依赖说明：

- ② 是 ③ 的前提（Provider 状态与缓存 API）。
- ④ 依赖 ②（`proxyNodeProviderMap`）与 ③（分组结果）。
- ⑤ 依赖 ③ ④。
- ⑥ ⑦ 相对独立，可并行。

---

## 24. 回归清单（每阶段都要过）

**自动**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

**代理页**

- [ ] 三段数量正确，默认进入策略组时**不请求** `/providers/proxies`
- [ ] 首次切到代理商 Tab 只请求一次；快速连点不并发重复请求
- [ ] Provider 超时后缓存仍在，页面不空白、不报未处理异常
- [ ] 各 Tab 滚动位置独立恢复
- [ ] 节点同簇顺序 `故转 > 手动 > 自动`
- [ ] 首屏渲染条数受控（大配置不卡）

**搜索**

- [ ] `google.com` 反向显示相关策略组
- [ ] `香港 自动` / `香港|故转` / `Gemini,香港-故转` 保持 AND
- [ ] 全角字符、标点容错
- [ ] 规则链路节点名可搜出上游规则
- [ ] 高亮与实际匹配一致

**规则直通**

- [ ] 展开完整链路
- [ ] 跳转规则页并带入筛选词
- [ ] 点击链路节点切换分段并展开目标卡片
- [ ] Provider 已加载显示尾标，未加载不阻塞

**后端与设置**

- [ ] 后端不可达显示面板通知，不是原生 TypeError
- [ ] 多后端切换缓存不串
- [ ] 删除后端清理对应缓存
- [ ] 设置导入忽略废弃键

**更新治理**

- [ ] 下载地址不指向 NebulaDash Release 时禁用「更新面板」
- [ ] 版本比较：新版本/同版本/更旧/未知四种状态正确
- [ ] 更新器 status/update/rollback 动作与 token 兼容路径可用

---

## 25. 维护位置

- 本文：重放规格（唯一依据）
- `REBASELINE-PLAN.md`：重基线执行流程
- `NEBULADASH-ITERATION-PLAN.md`：迭代计划（重基线后需重写第 4/7/8 章）
- `NEBULADASH-CHANGELOG.md`：实际改动日志
- `UPSTREAM-FEATURES.md`：上游差异盘点（重基线后需重置审计点）
