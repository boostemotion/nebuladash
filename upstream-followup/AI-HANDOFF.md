# AI 接手说明

本文是新开对话、其他 AI 或维护者接手 NebulaDash 时的首读入口。目标是快速建立共同上下文，避免重复评估和误删本地二改。

## 当前状态

- 代码基线：官方 Zashboard **`v3.30.0`**（`bf4f00b`），**与上游共享提交历史**
- 本地形态：上游代码 + 约 3000 行补丁（19 个新文件）
- 发布：推 `main` 即自动发版（`auto-release.yml`）；面板与路由器更新器都读 `releases/latest`
- 版本号：`<上游版本>-nebula.<轮次>[.<功能>[.<修复>]]`，**由 tag 决定**
  - 构建时注入 `APP_VERSION`，CI **不**把版本号写回 `package.json`
  - 因此发版不会让本地与远端分叉，推完不需要 `git pull`
  - `package.json` 的版本允许落后，`release:check` 只告警
- 旧版独立实现保留在 tag `legacy/nebula-2.8.0`，可随时回退
- 远程约定：`origin` 只推、`upstream` 只拉（push URL 已设为 `DISABLED`）
- 上游跟进：`git merge upstream/main`（共享历史，见 `SOP.md`）

## 重基线重放记录（已归档）

> 仅为追溯用。当前能力清单以 `NEBULADASH-FEATURE-INVENTORY.md` 为准。

| 组  | 内容                                                    | 提交      |
| --- | ------------------------------------------------------- | --------- |
| ①   | 品牌 / 版本治理 / 构建拆包 / 路由懒加载 / 更新源保护    | `06e7544` |
| ②   | Provider 按需加载 / 15s 超时 / 缓存起屏 / 降级 / 状态机 | `e197910` |
| ③   | 代理页三段视图 + 节点组聚类排序                         | `bd7b540` |
| ④   | 搜索规范化 / 域名变体 / 反向映射 / 链路感知             | `88cd2d8` |
| ⑤   | 规则直通入口 / 代理商尾标 / 跳转规则                    | `9ca2fe9` |
| ⑥⑦  | 发布工作流 + 路由器端自管理更新器                       | `17f53ea` |
| ⑧   | 设置导入废弃键清洗 + 启动脚本                           | `ae0339f` |

相对上游 `v3.30.0`：`49 files changed, +2886 / -147`（`src/` 范围）。

## 上游直接覆盖、不再本地重写的项

- Setup 页连接失败提示（`describeProbeFailure`）
- 移动端视口 / overscroll lock / 弹窗高度
- 代理页滚动位置恢复（`helper/proxies-scroll.ts`）
- 搜索模式切换与搜索高亮
- 代理文件夹、链路弹窗本体、虚拟滚动
- 节点图标映射改用节点自带 `provider-name`

## 接手时先做

1. 运行 `git status --short`，确认工作区是否已有用户改动。
2. 阅读 `upstream-followup/NEBULADASH-FEATURE-INVENTORY.md`（本地特色规格 + 重复功能取舍表）。
3. 若本轮涉及上游基线变更，阅读 `upstream-followup/REBASELINE-PLAN.md`。
4. 阅读 `upstream-followup/NEBULADASH-CHANGELOG.md` 最新日期下的条目。
5. 阅读 `upstream-followup/NEBULADASH-ITERATION-PLAN.md` 的“不可破坏的约束”“高冲突文件”和“固定回归清单”。
6. 涉及公开发布或更新源时，再读 `PUBLICATION.md`。
7. 涉及功能说明或用户文档时，再读 `README.md` 和 `README-改动说明.md`。

## 必须保护的本地能力

> 完整规格与验收标准见 `NEBULADASH-FEATURE-INVENTORY.md`。以下为已重放、不得丢失的清单。

- 代理页三段视图：策略组 / 节点组 / 代理商（`PROXY_TAB_TYPE` 含 `STRATEGY`/`NODE`/`PROVIDER`）。
- 策略组和节点组首屏不得等待 `/providers/proxies`；Provider 只在切到“代理商”时请求。
- Provider 必须有：15s 独立超时、按后端 UUID 隔离缓存、缓存起屏、失败降级、并发去重、
  代际校验、失败通知 60s 去重、`idle/loading/fresh/cached/stale/timeout/error` 状态机。
- 节点组聚类排序：同前缀簇相邻，簇内 `故转 > 手动 > 自动 > 负载均衡`。
- 搜索保留 NFKC、符号容错、域名 label 变体、多关键词 AND、规则反向映射、链路感知与高亮一致。
- 规则直通保留链路代理商尾标、跳转规则；Provider 未加载时尾标允许缺省且不得触发请求。
- 更新源必须指向 `boostemotion/nebuladash` Release，下载地址不匹配时禁用面板更新。
- 路由器端更新器动作仅 `status/update/rollback`，A/B 分区，失败不切换。
- 路由懒加载与 `manualChunks` 拆包不得被上游静态导入覆盖（上游入口 chunk 达 2.1 MB）。
- `test/nebula-verify.mjs`（`pnpm test:nebula`）必须持续通过：它是上述约束的可执行规格。
- **数据刷新硬规则**：`fetchProxies()` 只拉 `/proxies`。凡“数据可能已变化”的场景
  （更新订阅、健康检查、测速、配置重载、内核重启、后端代际变化）必须走
  `refreshProxyData()` / `refreshProxyProvider()` / `scheduleProxyProvidersResync()`，
  只调 `fetchProxies()` 会导致界面静默不更新（请求成功但数据源没换）。

## 下一步优先级

1. **真实环境回归**：Provider 两级超时是否合适（列表 15s / 测速更新 120s）、
   节点组聚类是否符合直觉、搜索命中率、A/B 回滚实战一次。
2. **上游跟进**：上游出新 tag 后按 `SOP.md` 执行 `git merge upstream/main`，
   合并后必须过 `test:nebula` 与 `test:verify`。
3. **可选增强**：Provider 缓存过期策略、多后端标题与三段视图共存。

## 当前明确不推进

> 重基线后以下多数能力会由上游直接带进来，不需要再单独投入。

- 搜索模式切换：重基线后直接采用上游 3.6+ 实现，不再自己设计。
- 规则卡片动画、分段控件和纯界面交互增强：重基线后随上游 3.x 视觉体系一并获得，不再单独维护。
- 代理文件夹：重基线后随上游 3.7 获得，不再需要本地 spike。
- 后端 uptime 展示：上游 `bed57f21` 依赖 sing-box native gRPC `GetStartedAt`，当前
  OpenClash / Mihomo 主线没有通用 startedAt 来源，不做空 UI 移植。
- sing-box native / goroutines / USB-IP / Tailscale / 终端：随上游保留代码，但不投入适配与验证。
- Zashboard 3.x 全套视觉体系：重基线后自动对齐，不再作为独立项目。

## 文档更新规范

- 每次本地改动完成前，必须追加 `upstream-followup/NEBULADASH-CHANGELOG.md`。
- 改动如果影响后续路线，更新 `NEBULADASH-ITERATION-PLAN.md`。
- 改动如果影响新对话接手路径，更新本文。
- 改动如果影响公开用户用法，更新根目录 `README.md` 或 `README-改动说明.md`。
- 改动如果影响路由器部署或更新路径，更新 `router-updater/README.md` 和 `PUBLICATION.md`。
- 如果更新器认证在 OpenWrt 上失败，先区分三层：脚本直跑、HTTP header、HTTP query token。
- 不要把 NebulaDash 本地改动写进根目录 `CHANGELOG.md`，它主要来自官方 Zashboard。
- 删除旧计划前，先确认其独有信息已经合并进维护日志、迭代计划或 SOP。

## 验证基线

```bash
pnpm test          # 73 项单元测试（node:test）
pnpm type-check
pnpm lint
pnpm build
pnpm release:check

# 需要本机 Chrome，或用 CHROME_BIN 指定
pnpm test:nebula   # 29 项：三段视图 / Provider 按需加载 / 更新与测速按钮 /
                   # 反向映射 / 链路感知 / 规则直通 / 空状态 / 更新源保护
pnpm test:verify   # 14 项：上游虚拟滚动与交互回归
```

`test/nebula-verify.mjs` 依赖这些 DOM 锚点，改结构时同步更新脚本：
`[role="tab"]`、`[data-proxy-page-item]`、`[data-proxy-group-now]`、
`[data-proxy-rule-shortcut]`、`[data-proxy-search]`、`[data-provider-update]`、
`[data-provider-healthcheck]`、`[data-router-updater-section]`、
`.modal.modal-open .modal-box`、`.badge`。

`pnpm lint` 会自动修复文件，运行前后都要检查 `git status --short`。
