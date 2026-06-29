# 上游新特性盘点

基线：

- 本地上游代码基线：Zashboard `2.8.0`
- 当前 NebulaDash 包版本：`2.8.0-nebula.4`
- 上游最新发布：`3.11.0`
- 已拉取的 `upstream/main`：`9150a53e`
- 最近审计：2026-06-26，`git fetch upstream --tags` 后确认无新增 upstream commit

## `v3.11.0` 之后的上游变更

当前 `upstream/main` 相比 `v3.11.0` 多出 11 个提交。

### 已落地

- `83dda306`：设置项 label/select 宽度修复，本地已在 `2ce694691` 落地，对应
  `src/assets/main.css` 的 `.setting-item-label` 和 `src/components/settings/ProxiesSettings.vue`
  的 `customGlobalNode` 下拉宽度。
- `6f65c3bf`：select 默认外观修复，本地已在 `2ce694691` 落地，对应
  `src/assets/main.css` 的 `@utility select { appearance: none; }`。

### 可选择跟进

- `314afebb`：连接状态延迟统计

### 需要适配再跟进

- `bed57f21`：后端 uptime 展示。上游实现依赖 sing-box native gRPC
  `GetStartedAt` 和 `assembly/version.ts`，当前 OpenClash / Mihomo 主线没有通用 startedAt 来源；
  不做空 UI 移植，除非后续明确接入 sing-box native 或发现 Mihomo 可用的启动时间字段。
- `357a9d52`：代理图标映射增强，仅影响 sing-box assembly，若迁移需与本地 `iconReflectList` 和 Mihomo 代理页融合
- `30825bd6`：连接快照接口，依赖上游 `assembly/connections/*` 分层，不能整文件覆盖
- `7fa7c5b3` / `87182973`：日志订阅和日志等级处理分层，涉及 `store/logs.ts` 和 assembly 层，需单独评估

### 暂不跟进

- `f3e22af2`：sing-box Native gRPC 流共享
- `9150a53e`：sing-box 连接关闭判断
- USB/IP、Tailscale、终端、工具页等 3.x 工具链能力

## 上游功能取舍

### 3.11.0

- sing-box native 后端与代理处理进一步重构（当前 OpenClash 主线不跟）
- USB/IP 面板和服务端组件（当前主线不跟）
- `SegmentedControl` 分段控件及多处 Tab 导航重构（当前主线不跟，已有插件补界面）
- 连接处理和相关 UI 重构（当前主线不跟）
- iOS 视口平移、输入框、Toggle 和主题对比度修复（仅保留稳定性修复评估，不跟视觉重构）

### 3.10.0

- sing-box native API 支持
- goroutines tracking（依赖 sing-box native API，当前主线暂不跟）
- 新中性色主题
- Tailscale peer 复制增强

### 3.9.0

- 代理页顶部遮罩效果
- sing-box 连接日志 UI
- 规则卡片展开动画（当前主线不跟，界面交互收益不足）
- 代理页移动端重构

### 3.8.0

- 键盘快捷键 `S`（当前主线不跟）
- 多后端标题显示
- 搜索高亮

### 3.7.0

- 代理文件夹管理
- 文件夹模式相关设置与 UI

### 3.6.0

- 节点搜索模式（当前智能搜索够用，暂不做模式切换）
- 统一搜索 / regex 匹配增强（暂不做显式搜索模式）
- speedtest mode 设置

### 3.5.x

- provider 搜索优化
- 设置同步 / 导入导出增强
- 仪表板设置页重构
- 连接搜索元数据增强

### 3.4.0

- 可配置快捷键
- 后端切换快捷键
- 禁用代理页文本选择

### 3.2.0

- provider / rule provider 视觉重做
- sidebar 统计结构优化

### 3.0.0

- zashboard@3 主题体系
- 重置设置
- Apple 风格全新设计语言

## 不应优先追的内容

- 纯视觉微调
- 主题数量扩充
- 与当前 OpenClash 使用无直接收益的动画细节
- 必须大范围改动才可落地的重构
- 已由用户插件覆盖的界面体验类能力
- 需要新增模式开关但当前智能搜索已满足使用的搜索功能

## 同步方式结论

- 当前 NebulaDash `main` 与 `upstream/main` 没有可用 merge-base，不能把 `git rebase upstream/main`
  或 `git merge upstream/main` 作为默认同步方式。
- 上游差异应以 tag 和单个 commit 为边界审计：先看 `v2.8.0...v3.11.0`，再看
  `v3.11.0..upstream/main`。
- 可移植内容优先手工补丁或小范围 cherry-pick；代理页、设置页、搜索、Provider、更新源和发布链路禁止整文件覆盖。
- 因用户已明确搜索模式和界面插件类能力目前够用，审计时默认把这两类放入“不跟进/仅记录”。

## 当前建议优先级

### P1

- 真实 OpenClash / Mihomo Provider 超时、缓存和后端切换回归
- 多后端标题等非视觉核心信息展示，按需评估

### P2

- 路由器更新器 rollback 实测。已有 A/B 与手动修复路径，实际使用频率低，后续改更新器核心逻辑时再做破坏性实测。
- 代理图标映射增强，需与本地 `iconReflectList` 融合
- 后端 uptime 展示，需先确认 OpenClash / Mihomo 是否存在可靠启动时间来源；上游 `bed57f21`
  只适用于 sing-box native startedAt。

### P3

- sing-box native 全量支持
- zashboard@3 全视觉对齐

## 当前不做

- goroutines tracking
  原因：不是 Mihomo 通用能力，主要依赖 sing-box native 状态流
- 快捷键体系
  原因：当前使用场景不需要
- 搜索模式切换
  原因：当前 NebulaDash 智能搜索已覆盖主要场景，新增模式会增加 UI 和维护成本
- 规则卡片动画、分段控件和界面类交互增强
  原因：用户已有插件补界面，NebulaDash 主线优先保持轻量稳定
