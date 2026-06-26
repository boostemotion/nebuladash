# AI 接手说明

本文是新开对话、其他 AI 或维护者接手 NebulaDash 时的首读入口。目标是快速建立共同上下文，避免重复评估和误删本地二改。

## 当前状态

- 当前包版本：`2.8.0-nebula.1`
- 上游代码基线：Zashboard `2.8.0`
- 已对照的官方版本：Zashboard `3.11.0`（2026-06-24）
- 远程约定：
  - `origin`：`boostemotion/nebuladash`，只推送 NebulaDash
  - `upstream`：`Zephyruso/zashboard`，只拉取官方更新
- 当前维护策略：不追版本号，不全量 rebase，按价值选择性移植上游能力

## 接手时先做

1. 运行 `git status --short`，确认工作区是否已有用户改动。
2. 阅读 `upstream-followup/NEBULADASH-CHANGELOG.md` 最新日期下的条目。
3. 阅读 `upstream-followup/NEBULADASH-ITERATION-PLAN.md` 的“不可破坏的约束”“高冲突文件”和“固定回归清单”。
4. 涉及公开发布或更新源时，再读 `PUBLICATION.md`。
5. 涉及功能说明或用户文档时，再读 `README.md` 和 `README-改动说明.md`。

## 必须保护的本地能力

- 代理页三段视图：策略组、节点组、代理商。
- 策略组和节点组首屏不得等待 `/providers/proxies`。
- Provider 数据只能按需加载、缓存、降级，不能恢复启动即请求。
- 搜索必须保留 NFKC、符号容错、多关键词 AND、域名 label 变体、规则链路感知和节点名反查父级组。
- 规则直通必须保留链路展开、跳转规则页、跨分段定位和最终 Provider 尾标。
- 更新源必须指向 `boostemotion/nebuladash` Release，不能误拉官方 Zashboard 覆盖本地版。
- 路由懒加载和构建拆包不能被上游静态导入覆盖。

## 当前已完成的关键改动

- `b28546ab`：公开仓库干净历史初始化。
- `29dd6ff1`：面板更新源保护，Release 地址固定到 NebulaDash。
- `7384f7ab`：节点名反查父级代理组 / Provider 搜索。
- `2ce69469`：同步上游设置页 select / label 小样式修复。
- `a04a355e`、`560c81fb`：公开 README 和维护日志整理。
- `842788ee`：Provider 旧缓存状态。
- 当前工作区：Provider 失败通知去重。

## 下一步优先级

1. 不依赖路由器实测时，优先补后端切换和缓存清理测试。
2. 固化 Release 发布前检查清单或脚本。
3. 路由器空闲后，再做真实 OpenClash / Mihomo Provider 超时、缓存和后端切换回归。
4. 多后端标题、后端 uptime、代理图标映射等非视觉核心信息展示按需评估。

## 当前明确不推进

- 搜索模式切换：当前智能搜索已满足主要使用场景，新增模式会增加 UI 和维护成本。
- 规则卡片动画、分段控件和纯界面交互增强：用户已有插件补界面，NebulaDash 主线优先轻量稳定。
- 代理文件夹：只允许独立 spike，不直接进入 `main`。
- Zashboard 3.x 全套视觉体系：不作为当前主线。

## 文档更新规范

- 每次本地改动完成前，必须追加 `upstream-followup/NEBULADASH-CHANGELOG.md`。
- 改动如果影响后续路线，更新 `NEBULADASH-ITERATION-PLAN.md`。
- 改动如果影响新对话接手路径，更新本文。
- 改动如果影响公开用户用法，更新根目录 `README.md` 或 `README-改动说明.md`。
- 不要把 NebulaDash 本地改动写进根目录 `CHANGELOG.md`，它主要来自官方 Zashboard。
- 删除旧计划前，先确认其独有信息已经合并进维护日志、迭代计划或 SOP。

## 验证基线

代码改动至少执行：

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

纯文档改动至少执行：

```bash
pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md
```

`pnpm lint` 会自动修复文件，运行前后都要检查 `git status --short`。
