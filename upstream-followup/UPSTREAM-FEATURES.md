# 上游新特性盘点

基线：

- 本地上游代码基线：Zashboard `2.8.0`
- 当前 NebulaDash 包版本：`2.8.0-nebula.1`
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

## 高价值功能

### 3.11.0

- sing-box native 后端与代理处理进一步重构（当前 OpenClash 主线不跟）
- USB/IP 面板和服务端组件（当前主线不跟）
- `SegmentedControl` 分段控件及多处 Tab 导航重构
- 连接处理和相关 UI 重构
- iOS 视口平移、输入框、Toggle 和主题对比度修复

### 3.10.0

- sing-box native API 支持
- goroutines tracking（依赖 sing-box native API，当前主线暂不跟）
- 新中性色主题
- Tailscale peer 复制增强

### 3.9.0

- 代理页顶部遮罩效果
- sing-box 连接日志 UI
- 规则卡片展开动画
- 代理页移动端重构

### 3.8.0

- 键盘快捷键 `S`（当前主线不跟）
- 多后端标题显示
- 搜索高亮

### 3.7.0

- 代理文件夹管理
- 文件夹模式相关设置与 UI

### 3.6.0

- 节点搜索模式
- 统一搜索 / regex 匹配增强
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

## 当前建议优先级

### P1

- 节点搜索模式
- provider 搜索增强
- 规则卡片交互增强

### P2

- 代理文件夹管理

### P3

- sing-box native 全量支持
- zashboard@3 全视觉对齐

## 当前不做

- goroutines tracking
  原因：不是 Mihomo 通用能力，主要依赖 sing-box native 状态流
- 快捷键体系
  原因：当前使用场景不需要
