# 上游新特性盘点

基线：

- 本地上游代码基线：Zashboard `2.8.0`
- 当前 NebulaDash 包版本：`2.8.0-nebula.3`
- 上游最新发布：`3.11.0`
- 已拉取的 `upstream/main`：`9150a53e`

## `v3.11.0` 之后的上游变更

当前 `upstream/main` 相比 `v3.11.0` 多出 11 个提交。

### 可选择跟进

- 设置项 label/select 宽度修复
- select 默认外观修复
- 后端 uptime 展示
- 连接状态延迟统计

### 需要适配再跟进

- 代理图标映射增强
- 连接快照接口
- 连接处理和日志订阅分层

### 暂不跟进

- sing-box Native gRPC 流共享
- sing-box 连接关闭判断
- 统一日志流累积器

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

## 当前建议优先级

### P1

- 真实 OpenClash / Mihomo Provider 超时、缓存和后端切换回归
- 路由器更新器 rollback 实测
- 后端 uptime / 多后端标题等非视觉核心信息展示，按需评估

### P2

- 代理图标映射增强，需与本地 `iconReflectList` 融合

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
