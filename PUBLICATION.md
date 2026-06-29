# NebulaDash 公开发布说明

本文说明公开仓库中允许提交的内容、必须排除的本地文件，以及 GitHub Release 的发布方式。

## 可以提交

- `src/`、`public/` 和构建配置
- `README.md`、`README-改动说明.md`、`upstream-followup/`
- `.github/workflows/` 和 Issue 模板
- `package.json`、`pnpm-lock.yaml`
- Docker、Caddy、启动脚本
- 不包含真实地址、密码和 Token 的示例配置

## 禁止提交

- OpenClash / Mihomo 后端密码
- GitHub Token、API Key、私钥和证书私钥
- `.env`、`.npmrc` 等本地凭据文件
- 浏览器导出的真实面板设置
- OpenClash 实际配置和订阅链接
- `node_modules/`、`.pnpm-store/`、`dist/`
- 本地会话目录 `.omx/`
- 手工生成的 ZIP、TAR、日志、临时文件和备份

## 发布模型

源码仓库可以公开，构建产物通过 GitHub Release 公开下载。

## 版本号策略

NebulaDash 使用独立预发布后缀，不直接冒充 Zashboard 官方版本。

- 常规本地增强发布：沿用当前上游基线并递增 Nebula 后缀，例如 `2.8.0-nebula.4.2.0`
- 推荐语义：
  `nebula.4`
  表示一轮大功能上线编号。
  `nebula.4.2`
  表示该大功能轮次下的第 2 个小功能增量。
  `nebula.4.2.0`
  表示该小功能轮次下当前累计的 bugfix 计数。
- 只有真正迁移到上游 3.x 代码基线后，才使用类似 `3.x.y-nebula.a[.b[.c]]` 的版本号
- 不使用纯 `3.2.0` 这类官方风格版本号，避免用户误判为 Zashboard 官方 3.x
- Release tag 必须等于 `v<package.json version>`，例如 `v2.8.0-nebula.4.2.0`

普通 Push 和 Pull Request 只执行：

```bash
pnpm install --frozen-lockfile
pnpm exec eslint .
pnpm test
pnpm type-check
pnpm build
```

发布前先执行：

```bash
pnpm release:check
```

推送与 `package.json` 版本一致的标签后，例如：

```bash
git tag v2.8.0-nebula.4.2.0
git push origin v2.8.0-nebula.4.2.0
```

GitHub Actions 会自动生成 Release，并上传：

- `dist.zip`
- `dist-no-fonts.zip`
- `dist-cdn-fonts.zip`
- `dist-firasans-only.zip`
- `dist-misans-only.zip`
- `dist-pingfang-only.zip`
- `dist-sarasa-only.zip`
- `router-updater.zip`

Release 工作流只使用 GitHub 自动提供的 `GITHUB_TOKEN`，不需要个人 PAT。

tag 推送后要等待 GitHub Actions 的 Release workflow 完成，并确认：

- Release 页面存在目标 tag。
- `dist.zip` 已上传。
- `router-updater.zip` 已上传。
- `https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip` 跳转到目标 tag。

## OpenClash 更新配置

公开 Release 建立后，可将 OpenClash / Mihomo 的 UI 下载地址配置为：

```yaml
external-ui-download-url: https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

面板中的“检查更新”查询同一仓库的最新 Release；“更新面板”仍由
OpenClash / Mihomo 的 `/upgrade/ui` 接口执行下载。

前端会读取后端 `/configs` 返回的 `external-ui-download-url` 或 `external-ui-url`。
只有该地址指向 `boostemotion/nebuladash` 的 GitHub Release ZIP 时，设置页才允许执行
“更新面板”和自动更新；否则按钮会禁用并提示正确地址。

## NebulaDash 自管理更新器

如果不想依赖 OpenClash LuCI 内置面板按钮，可使用 `router-updater/` 中的可选更新器。

Release 会同时上传 `router-updater.zip`，可通过以下地址下载最新安装包：

```text
https://github.com/boostemotion/nebuladash/releases/latest/download/router-updater.zip
```

发布产物仍来自同一个 NebulaDash Release：

```text
https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

更新器运行在路由器上，默认安装到：

- `/usr/share/nebuladash-updater/`
- `/www/cgi-bin/nebuladash-updater`
- `/www/nebuladash-a`
- `/www/nebuladash-b`
- `/www/nebuladash`

公开仓库只能提交示例配置。不得提交真实 `NEBULADASH_TOKEN`、路由器实际配置、日志、工作目录或构建包。

OpenWrt/uHTTPd 可能不会向 CGI 传递自定义请求头。前端会同时传 `X-NebulaDash-Token` header 和 `token` query 参数，CGI 优先校验 header，缺失时校验 query token。默认安装器生成的是 hex token，不要手动改成包含空格、`&`、`=` 等 URL 特殊字符的值。

## 公开前检查

```bash
git status --short
git ls-files
pnpm release:check
pnpm lint
pnpm test
pnpm type-check
pnpm build
```

注意：`.gitignore` 不能删除历史记录。当前仓库过去曾提交过 `.omx/` 和本地构建压缩包。
虽然现有扫描没有发现凭据，首次公开前仍建议采用以下方式之一：

1. 从当前已清理工作树创建新的公开仓库和干净初始提交
2. 使用 `git filter-repo` 清理历史后，再人工核对并强制推送

第一种方式风险更低，也不会把上游长期历史中的无关大文件带入公开仓库。

还应在 GitHub 仓库设置中启用：

- Secret scanning
- Push protection
- Dependabot alerts
- Branch protection
- Actions workflow approval for external contributions
