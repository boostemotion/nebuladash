# AI 接手说明

本文是新开对话、其他 AI 或维护者接手 NebulaDash 时的首读入口。目标是快速建立共同上下文，避免重复评估和误删本地二改。

## 当前状态

- **升级策略已变更（2026-06-29）**：不再逐提交选择性移植，改为「以官方最新版本为基线重建 + 按清单重放本地特色」。重放的唯一依据是 `NEBULADASH-FEATURE-INVENTORY.md`，执行流程见 `REBASELINE-PLAN.md`。
- **环境阻塞**：当前开发机未安装 Git for Windows，pi 的 shell 工具只认 Git Bash，`git` / `pnpm` 均无法执行。重基线开始前必须先装 Git。
- 当前包版本：`2.8.0-nebula.4.2.0`
- 上游代码基线：Zashboard `2.8.0`
- 已对照的官方版本：Zashboard `3.11.0`（2026-06-24）
- 已复查的 upstream main：`9150a53e`（2026-06-26 fetch 后无新增）
- 已新增并发布可选路由器端自管理更新器：`router-updater/`
- `v2.8.0-nebula.4.2.0` 已发布，包含更新阶段提示修复和新的 Nebula 多级版本规则
- `latest/download/dist.zip` 已确认跳转到 `v2.8.0-nebula.4.2.0/dist.zip`
- `router-updater.zip` 已由 Release workflow 自动上传到 `v2.8.0-nebula.4.2.0`，latest 下载链路已验证
- 路由器实机已确认可通过 NebulaDash 前端按钮触发更新
- 设置页已拆分“检查更新器”和“检查新版本”；进入设置页会自动检查 NebulaDash Release，并在有新版本时显示红点
- 路由器端更新流程现在会在设置页显示阶段状态，例如下载、解压和切换分区
- 远程约定：
  - `origin`：`boostemotion/nebuladash`，只推送 NebulaDash
  - `upstream`：`Zephyruso/zashboard`，只拉取官方更新
- 当前维护策略（2026-06-29 起）：**以官方最新版为基线重建 + 按清单重放本地特色**。旧的“按价值选择性移植”已停止使用；已完成前的本地代码保留在 `legacy/nebula-2.8.0` tag（重建开始时创建）。
- 当前 `main` 与 `upstream/main` 无可用 merge-base；**重基线完成前**不要直接 `git rebase upstream/main` 或
  `git merge upstream/main`。重基线后可以恢复为普通 `git merge upstream/main`。

## 接手时先做

1. 运行 `git status --short`，确认工作区是否已有用户改动。
2. 阅读 `upstream-followup/NEBULADASH-FEATURE-INVENTORY.md`（本地特色规格 + 重复功能取舍表）。
3. 若本轮涉及上游基线变更，阅读 `upstream-followup/REBASELINE-PLAN.md`。
4. 阅读 `upstream-followup/NEBULADASH-CHANGELOG.md` 最新日期下的条目。
5. 阅读 `upstream-followup/NEBULADASH-ITERATION-PLAN.md` 的“不可破坏的约束”“高冲突文件”和“固定回归清单”。
6. 涉及公开发布或更新源时，再读 `PUBLICATION.md`。
7. 涉及功能说明或用户文档时，再读 `README.md` 和 `README-改动说明.md`。

## 必须保护的本地能力

> 完整规格与验收标准见 `NEBULADASH-FEATURE-INVENTORY.md`。以下为必须重放、不得丢失的清单。

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
- `7f80b09c`：Provider 失败通知去重。
- `07b60048`：发布前检查脚本和 `2.8.0-nebula.2` 版本治理。
- `96410915`、`3c8be8e4`、`dafbae80`、`f19cf352`、`a7433367`：路由器端自管理更新器、A/B 部署脚本、CGI、前端 API 和设置页按钮。
- `1fb54e4e`：更新前增加同版本、旧版本和未知版本风险确认。
- `a445829c`：安装器和 CGI 兼容 CRLF，避免 token 肉眼一致但比较失败。
- `47aae275`：兼容 uHTTPd 不转发自定义 header，前端和 CGI 支持 query token fallback。
- `ca42aedc`：版本推进到 `2.8.0-nebula.3`。
- `4edf421a`：记录 `v2.8.0-nebula.3` 发布日志哈希。
- `36e21a8f`：GitHub Release workflow 自动上传 `router-updater.zip`。
- `efc62d9d`：当前 `v2.8.0-nebula.3` Release 已补上传 `router-updater.zip` 并验证 latest 链接。
- `fc86d6a1`：记录路由器实机前端按钮更新成功。
- `73420c5c`、`f2ea79bd`：设置页独立新版本检查、自动检查与红点提示已发布到 `v2.8.0-nebula.4`。
- `a7b7c67e` 对应的更新器状态轮询与阶段提示修复已随 `v2.8.0-nebula.4.2.0` 发布。
- 设置页新版本检查已独立于 updater status，支持自动检查和红点提示。

## 下一步优先级

1. **安装 Git for Windows**，解除工具链阻塞（当前无法执行 `git` / `pnpm`）。
2. 确认 `REBASELINE-PLAN.md` §3 的三个决策点（公开仓库历史形态、版本号起点、旧线保留方式）。
3. 按 `REBASELINE-PLAN.md` 阶段 0-3 执行重基线。
4. 重基线完成后，在真实 OpenClash / Mihomo 上做 Provider 超时、缓存和后端切换回归。
5. rollback 实测降为低优先级：已有 A/B 和 SSH 手动修复路径，实际使用频率低。

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

代码改动至少执行：

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

> 当前开发机缺少 Git Bash，以上命令暂无法执行；环境修复后必须补跑。

路由器更新器改动还需要在可用 POSIX shell 环境运行：

```bash
sh router-updater/smoke-test.sh
```

纯文档改动至少执行：

```bash
pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md
```

`pnpm lint` 会自动修复文件，运行前后都要检查 `git status --short`。
