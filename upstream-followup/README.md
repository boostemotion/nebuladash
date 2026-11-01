# NebulaDash 维护文档入口

这个目录是 NebulaDash 后续维护、上游同步和 AI 接手的固定窗口。根目录
`CHANGELOG.md` 主要来自官方 Zashboard，不记录本分支二改。

## 建议阅读顺序

1. `AI-HANDOFF.md`
   新开对话或其他 AI 接手时先读。它只保留当前状态、不可破坏约束、下一步建议和文档维护规则。
2. `NEBULADASH-CHANGELOG.md`
   实际维护日志。每次本地改动必须追加记录，优先看最新日期和最新小节。
3. `NEBULADASH-ITERATION-PLAN.md`
   后续迭代总计划，包含性能根因、已完成能力、上游差异、高冲突文件和回归清单。
4. `UPSTREAM-FEATURES.md`
   官方 Zashboard 新功能盘点。只用于判断“哪些上游能力值得选择性移植”。
5. `SOP.md`
   长期维护流程，包括上游同步、分支策略、文档更新和回归验证。

## 文档职责

- `AI-HANDOFF.md`：面向接手者的短入口，只写当前事实、读文档顺序、禁止事项和下一步。
- `NEBULADASH-CHANGELOG.md`：按时间记录已经发生的本地改动，不写未来愿望。
- `NEBULADASH-ITERATION-PLAN.md`：维护后续路线和验收标准，计划变化时更新这里。
- `UPSTREAM-FEATURES.md`：记录官方上游功能差异和取舍理由。
- `SOP.md`：记录可重复的操作流程和文档规范。

## 当前背景

- 本地上游代码基线：Zashboard `2.8.0`
- 当前 NebulaDash 包版本：`2.8.0-nebula.4.2.0`
- 已确认对照的上游版本：Zashboard `3.11.0`（2026-06-24）
- 当前仓库是叠加了 OpenClash / Mihomo 本地优化的公开 fork，不是纯净上游镜像
- `v2.8.0-nebula.4.2.0` 已发布；Release latest/download/dist.zip 已确认指向该版本
- NebulaDash 自管理更新器已在真实路由器上完成 status/update 链路验证，使用 A/B 分区和 token 认证

后续策略是选择性跟进上游：

1. 先保护代理页、规则页、搜索和 Provider 慢接口隔离。
2. 再按实际价值小步移植上游修复。
3. 大规模 UI、设置页或代理页重构必须单独分支验证。

## 已合并或删除的旧文档

- `PLAN.md` 已合并进 `NEBULADASH-ITERATION-PLAN.md` 和 `SOP.md`。
- `NODE-PARENT-SEARCH-PLAN.md` 对应功能已完成，并已记录在 `NEBULADASH-CHANGELOG.md` 的
  `feat: match proxy parents by node search` 小节。
- `docs/superpowers/plans/2026-06-26-nebuladash-router-updater.md` 对应功能已完成并发布到
  `v2.8.0-nebula.4.2.0`。当前安装、发布和故障排查信息已合并到 `router-updater/README.md`、
  `PUBLICATION.md`、`AI-HANDOFF.md` 和 `NEBULADASH-CHANGELOG.md`。
