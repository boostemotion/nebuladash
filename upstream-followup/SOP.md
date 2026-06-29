# 上游跟进 SOP

这份文档回答两个问题：

1. 二改作者通常怎么持续跟上游？
2. 工业上有没有更规范的做法？

答案是：有，而且核心思想不是“多勤奋”，而是“把 fork 维护变成可重复流程”。

## 一、推荐的工业化思路

### 1. 把 fork 维护拆成三条线

- `稳定线`
  现在用户正在用的版本，只接必要修复
- `对齐线`
  专门吸收上游更新
- `试验线`
  用来验证大改，不直接进稳定线

这样做的目的，是避免“修一个功能时顺手把半个项目都升级了”。

### 2. 先分类，再决定跟不跟

上游更新通常分 4 类：

- `Bug Fix`
  优先跟，尤其是你本地也踩到的问题
- `独立功能`
  视价值决定是否 cherry-pick
- `架构重构`
  不直接跟，先单独验证
- `纯视觉调整`
  延后处理

工业上不会默认“上游更了就全跟”，而是先做 triage。

### 3. 永远保留 upstream 远程

本仓已经有：

- `origin` = 你的仓库
- `upstream` = 官方仓库

这就是标准做法。

## 二、推荐工作流

### 0. 发布 NebulaDash 版本

NebulaDash 使用独立 Nebula 后缀版本号。只有真正迁移到上游 3.x 基线后，才使用
`3.x.y-nebula.a[.b[.c]]`；常规本地增强继续递增当前基线后缀，例如
`2.8.0-nebula.4.2.0`。

固定流程：

```bash
pnpm release:check
pnpm test
pnpm type-check
pnpm lint
pnpm build
git tag v<package.json version>
git push origin main
git push origin v<package.json version>
```

tag 推送后等待 GitHub Actions Release workflow 完成，并验证：

```bash
gh release view v<package.json version> --repo boostemotion/nebuladash
curl -I -L https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

`latest/download/dist.zip` 必须跳转到刚发布的 tag 后，路由器端“更新 NebulaDash”按钮才应该使用。

### 1. 固定同步命令

```bash
git fetch upstream --tags
git checkout main
git rebase upstream/main
```

如果不适合直接 rebase，就改成只看差异：

```bash
git fetch upstream --tags
git log --oneline main..upstream/main
git diff --stat main..upstream/main
```

### 2. 用功能分支吸收

不要直接在 `main` 上追上游。

推荐：

```bash
git checkout -b feat/upstream-provider-sync
```

只在这个分支里做一类上游同步。

### 3. 尽量使用 cherry-pick / 手动移植

对 fork 项目来说，工业上常见做法不是每次都大 rebase，而是：

- 小改动：`cherry-pick`
- 中改动：手动对照移植
- 大改动：建 spike 分支单独验证

原因很简单：

- fork 一旦加了自己的业务逻辑，整仓 rebase 成本会越来越高

### 4. 每次同步后做回归清单

规范化不是“写文档”，而是每次都跑同一套检查。

推荐至少检查：

- 类型检查
- 构建
- 关键页面打开
- 核心接口加载
- 关键设置是否还能保存

## 三、建议的仓库内规范

### 1. 维护目录

像本次这样，单独建立：

- `upstream-followup/`

专门记录：

- 上游差异
- 决策
- 跟进计划
- 风险

### 2. 提交信息要带“来源”

建议格式：

```text
sync(upstream): cherry-pick provider search improvements from zashboard v3.5.1
```

或者：

```text
adapt(upstream): port proxy folder UI from zashboard v3.7.0
```

这样过几个月回头看，还知道哪些是本地原创，哪些是从上游迁过来的。

### 3. 大功能要记录“不跟的理由”

工业上很重要的一点不是“什么都做”，而是：

> 为什么这次不跟？

比如：

- 风险太大
- 当前没有业务价值
- 和本地改动冲突太强

把“不跟”也记下来，后面就不会重复评估。

### 4. 文档要按职责维护

后续 AI 或维护者接手时，文档比聊天记录更可靠。每次改动后按下面规则落文档：

- `AI-HANDOFF.md`：只写当前状态、接手顺序、不可破坏约束和下一步建议。
- `NEBULADASH-CHANGELOG.md`：只写已经发生的本地改动，包含目的、文件、行为变化、验证和后续注意。
- `NEBULADASH-ITERATION-PLAN.md`：只写后续路线、优先级、验收标准和高冲突文件。
- `UPSTREAM-FEATURES.md`：只写官方上游功能盘点和跟进取舍。
- `README.md`：面向公开用户，避免塞入内部维护细节。
- `README-改动说明.md`：面向理解二改功能，保留可验证的功能说明。
- `router-updater/README.md`：面向路由器安装、更新、回滚和故障排查。
- `PUBLICATION.md`：面向公开发布、Release、更新源和禁止提交内容。

旧计划文件如果已经完成或并入总计划，应删除或归档；删除前必须确认独有信息已进入维护日志或迭代计划。

### 5. 文档验证

纯文档改动至少执行：

```bash
pnpm exec prettier --check README.md README-改动说明.md PUBLICATION.md upstream-followup/*.md
```

如果同时改代码，仍按项目基线执行：

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## 四、你这个项目最适合的跟进模型

### 当前不适合

- 全量 rebase 到 `3.10.x`
- 大规模 UI 对齐

### 当前适合

- 按功能模块小步吸收
- 先解决代理页和 provider 页的真实痛点
- 再考虑体验类增强

## 五、简单判断标准

如果一个上游改动满足下面任意两条，就值得优先跟：

- 你自己也踩到了同类问题
- 改动范围集中在单模块
- 不依赖上游整套新架构
- 有明确用户收益

如果一个上游改动满足下面任意两条，就应该延后：

- 需要同时改很多页面
- 会碰你的本地核心二改
- 只是更好看，没有明显使用收益
- 很难回滚

## 六、推荐节奏

- 每周一次：看 upstream release / changelog
- 每两周一次：做一轮 triage
- 每月一次：吸收 1 到 2 个高价值改动

对个人维护 fork 来说，这已经算比较工业化了。
