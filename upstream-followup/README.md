# NebulaDash 维护文档入口

本目录是 NebulaDash 维护、上游同步与 AI 接手的固定入口。
根目录 `CHANGELOG.md` 来自官方 Zashboard，**不**记录本地二改。

## 建议阅读顺序

| 顺序 | 文档                              | 什么时候读                                      |
| ---- | --------------------------------- | ----------------------------------------------- |
| 1    | `AI-HANDOFF.md`                   | 新开对话 / 接手时必读：当前状态、硬规则、下一步 |
| 2    | `NEBULADASH-CHANGELOG.md`         | 看最新日期的小节，了解最近改了什么              |
| 3    | `NEBULADASH-FEATURE-INVENTORY.md` | 判断某项能力属于“本地独有”还是“上游已有”        |
| 4    | `NEBULADASH-ITERATION-PLAN.md`    | 决定下一步做什么、不做什么                      |
| 5    | `SOP.md`                          | 上游同步与发布的可重复流程                      |
| 6    | `UPSTREAM-FEATURES.md`            | 上游能力盘点与取舍理由                          |
| 7    | `REBASELINE-PLAN.md`              | 想了解“为什么以 v3.30.0 为基线”的历史背景       |

## 文档职责

- `AI-HANDOFF.md`：接手者的短入口，只写当前事实、硬规则、下一步，不写历史。
- `NEBULADASH-CHANGELOG.md`：按时间记录**已发生**的改动，含验证方式与后续注意。
- `NEBULADASH-FEATURE-INVENTORY.md`：本地特色规格（含“不可回归的约束”）与重复功能取舍表。
- `NEBULADASH-ITERATION-PLAN.md`：当前路线、优先级、验收标准与固定回归清单。
- `SOP.md`：上游同步、发布、文档更新的可重复步骤。
- `UPSTREAM-FEATURES.md`：上游差异审计与下次审计方法。
- `REBASELINE-PLAN.md`：重基线方案与执行记录（已完成，保留作背景）。

## 当前背景

- 代码基线：官方 Zashboard `v3.30.0`（`bf4f00b`），**与上游共享提交历史**
- 本地形态：上游代码 + 约 3000 行补丁（19 个新文件）
- 发布：推 `main` 自动发版（`auto-release.yml`），面板与路由器更新器都读 `releases/latest`
- 版本号：`<上游版本>-nebula.<轮次>[.<功能>[.<修复>]]`，**由 tag 决定**
- 旧版独立实现：tag `legacy/nebula-2.8.0`（可回退）

## 维护约定（强制）

1. 每次本地改动完成前，追加 `NEBULADASH-CHANGELOG.md`。
2. 影响路线的改动，同步 `NEBULADASH-ITERATION-PLAN.md`。
3. 影响接手路径的改动，同步 `AI-HANDOFF.md`。
4. 影响用户用法的改动，同步根目录 `README.md` / `README-改动说明.md`。
5. 影响路由器部署或更新的改动，同步 `router-updater/README.md` 与 `PUBLICATION.md`。
6. 文档改动至少跑 `pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md`。
