# NebulaDash 后续迭代计划

> 最后更新：2026-11-01。当前基线 Zashboard `v3.30.0`。
> 接手先读 `AI-HANDOFF.md`；能力归属查 `NEBULADASH-FEATURE-INVENTORY.md`。

## 1. 项目定位

面向 OpenClash / Mihomo 的轻量增强分支：

- 浏览器直连后端，不引入 Node / Docker 中转，不引入数据库
- 优先保证低资源路由器上的首屏可用性
- 优先维护代理页、规则页、搜索三条高频路径
- 上游已有的能力一律用上游，只在“上游没有且解决真实痛点”的地方保留本地实现

## 2. 不可破坏的约束

1. 策略组 / 节点组首屏**不得**等待 `/providers/proxies`
2. `/providers/proxies` 只能按需请求，不能恢复为启动即拉
3. Provider 请求失败或超时不得拖死代理页，不得清空已有数据
4. 已有缓存必须能先起屏（按后端 UUID 隔离）
5. 搜索必须保留 NFKC、符号容错、多关键词 AND、域名 label 变体
6. 搜索必须保留“域名 → 规则 → 代理组”反向映射与规则链路感知
7. 规则直通必须保留链路展示、跳转规则与最终代理商尾标
8. 更新源必须指向 `boostemotion/nebuladash` Release，不匹配时禁用面板更新
9. 路由懒加载与 `manualChunks` 拆包不得被上游静态导入覆盖
10. **数据刷新**：`fetchProxies()` 只拉 `/proxies`；凡数据可能变化的操作必须走
    `refreshProxyData()` / `refreshProxyProvider()` / `invalidateProxyProviders()` /
    `scheduleProxyProvidersResync()`

## 3. 当前已完成（可视为稳定能力）

| 能力                                            | 关键位置                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| 代理页三段视图（策略组 / 节点组 / 代理商）      | `helper/proxies.ts`、`constant/index.ts`            |
| 节点组聚类排序（同前缀相邻、故转>手动>自动）    | `helper/node-group-cluster.ts`                      |
| Provider 按需加载 + 缓存 + 降级 + 去重 + 状态机 | `assembly/proxies/*`、`helper/proxy-cache.ts`       |
| 两级 Provider 超时（列表 / 测速更新）           | `api/clash.ts`、`store/settings.ts`                 |
| 搜索规范化与域名变体                            | `helper/search.ts`                                  |
| 域名反向映射、规则链路感知                      | `helper/proxies.ts`、`store/rules.ts`               |
| Provider 元数据搜索（测速 URL / 更新 / 订阅）   | `helper/proxy-provider-search.ts`                   |
| 规则直通 + 代理商尾标 + 跳转规则                | `ProxyGroupHeader/ChainModal/ProxyChainPath`        |
| 更新源保护                                      | `helper/ui-update-source.ts`、`assembly/version.ts` |
| 路由器 A/B 自管理更新器                         | `router-updater/*`                                  |
| 品牌 / 版本治理 / 自动发版                      | `vite.config.ts`、`.github/workflows/*`             |
| 构建拆包（入口约 88 kB）                        | `vite.config.ts`、`router/index.ts`                 |

## 4. 下一步优先级

### P1：真实环境回归（只有你能做）

- 路由器上验证 Provider 超时阈值是否合适（列表 15s / 测速更新 120s）
- 节点组聚类在真实命名下的排序是否符合直觉
- 搜索在真实规则集上的命中率（`google.com`、链路节点名）
- A/B 回滚动作实战一次

### P2：可选增强（有真实需求再做）

- Provider 缓存过期策略（目前 30 分钟切“旧缓存”，无自动清理）
- 多后端标题展示（上游 3.8 已有，确认与三段视图共存）
- 规则直通的“跨标签定位”（现在用上游弹窗内联展示，暂不回到滚动定位）

### P3：跟随上游

- 上游新 tag 出现后按 `SOP.md` 执行 `git merge upstream/main`
- 合并后重点复核：`helper/proxies.ts`、`assembly/proxies/*`、`helper/search.ts`、
  `ProxiesCtrl`、`ProxiesPage`、`vite.config.ts`

## 5. 当前明确不做

- 搜索模式切换（智能搜索已覆盖，上游模式开关可选但不必本地再定制）
- 规则卡片动画、分段控件等纯视觉改动
- sing-box native / dae 深度适配：随上游保留代码，不投入验证
- 后端 uptime 展示：缺少通用 startedAt 来源
- Zashboard 3.x 视觉体系单独迁移：已随基线获得

## 6. 高冲突文件（合并上游时人工审阅）

| 文件                                       | 本地职责                            | 风险 |
| ------------------------------------------ | ----------------------------------- | ---- |
| `src/assembly/proxies/{state,actions}.ts`  | 缓存、去重、按需加载、刷新入口      | 极高 |
| `src/assembly/driver/clash.ts`             | `fetch`/`fetchProviders` 拆分与超时 | 极高 |
| `src/helper/proxies.ts`                    | 三段拆分、聚类、反向映射            | 极高 |
| `src/components/controls/ProxiesCtrl.tsx`  | 三段 Tab、按需拉取、状态徽标        | 极高 |
| `src/views/ProxiesPage.vue`                | 分段渲染、空状态、文件夹 UI         | 高   |
| `src/components/proxies/ProxyProvider.vue` | 更新/健康检查组合动作与锚点         | 高   |
| `src/helper/search.ts`                     | 智能匹配与高亮                      | 高   |
| `src/store/rules.ts`                       | 链路感知搜索                        | 高   |
| `src/store/proxy-folders.ts`               | 移除上游内置文件夹                  | 中   |
| `vite.config.ts`、`router/index.ts`        | 品牌、拆包、懒加载                  | 中   |
| `.github/workflows/*`                      | 发布链路                            | 中   |

原则：不整文件覆盖；先看上游提交意图，再手工融合；一次只同步一个能力。

## 7. 固定回归清单

### 自动

```bash
pnpm test          # 73 项
pnpm type-check
pnpm lint
pnpm build
pnpm release:check

pnpm test:nebula   # 29 项（需 Chrome）
pnpm test:verify   # 14 项（需 Chrome）
```

### 代理页

- 首屏进代理页：Network 中**没有** `/providers/proxies`
- 切“代理商”：只请求 1 次；有状态徽标；慢/超时保留旧数据
- 单个 Provider 更新 / 测速：按钮停止转圈，卡片更新时间/延迟变化
- 改 `Provider 测速/更新超时` 后重试仍生效
- 三个标签各自恢复滚动位置
- 节点组：同前缀相邻，顺序 `故转 > 手动 > 自动`

### 搜索

- `google.com` 能带出对应策略组（反向映射）
- `香港 自动` AND 语义；`香港|故转` 按正则 OR（上游语义）
- 全角字符、标点容错
- 规则页搜下游节点名能筛出上游规则
- 无结果时显示空状态提示，不是白板

### 规则直通

- 链路末尾显示 `代理提供商: xxx`
- 弹窗内“跳转规则”带入当前组名
- Provider 未加载时尾标缺省且不触发请求

### 更新治理

- 后端 UI 下载地址非 NebulaDash Release 时禁用“更新面板”并显示要求地址
- 路由器更新器：检查 / 更新 / 回滚；更新阶段可见
- 更新器下载走 `curl --http1.1`（部分路由器 HTTP/2 会握手失败）

## 8. 性能基线记录模板

```text
设备：
浏览器：
OpenClash / Mihomo 版本：
Provider 数量 / 节点总数 / 规则数量：
/proxies 耗时：
/providers/proxies 耗时（列表）：
单个 Provider 测速耗时：
缓存起屏耗时：
策略组首屏可交互耗时：
```

已知实测（ImmortalWrt-798x-24.10, aarch64）：

- `/providers/proxies` 约 **189 ms**（Provider 数量少）
- 单个 Provider 测速在节点较多时会超过 15 秒 —— 因此重操作超时默认放到 120 秒
