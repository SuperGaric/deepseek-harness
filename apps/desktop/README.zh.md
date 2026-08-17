# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

dsh Web GUI 的 Electron 桌面外壳：在 `dsh web` 所提供的同一个回环服务器之上开一个原生窗口。外壳本身是 Electron 直接执行的纯 JavaScript——没有 lib 构建。调用 `dsh web --desktop` 时，Web 组合包中的 [`web-desktop`](../../packages/bundle/web-app/README.md) 启动器行会拉起它；在仓库根目录运行 `pnpm run desktop` 效果相同。

## 外壳契约

启动器通过环境变量传递一切；外壳从不自行启动服务器：

| 变量 | 含义 |
|---|---|
| `DSH_DESKTOP_URL` | 要渲染的规范回环 URL（必需）。 |
| `DSH_DESKTOP_OWNER_PID` | 正在提供服务的 dsh 进程；窗口关闭时外壳会停止它。 |
| `DSH_DESKTOP_SMOKE_MS` | 冒烟探测模式：打开窗口，打印 `dsh-desktop: ready <url>`，并在这么多毫秒后退出且不停止宿主进程。 |

外壳与启动器共享同一生命周期：关闭窗口会停止启动器（Windows 上为强制的进程树终止，其余平台为 `SIGTERM`）；每 2 秒一次的宿主进程监视会在启动器先行退出（终端里 Ctrl+C）时关闭窗口。窗口最多等待 URL 应答 30 秒，超时后给出可见的错误并退出；启动器继续在终端中提供服务。

## 开发

```sh
pnpm install        # links electron into apps/desktop (devDependency)
pnpm --filter @deepseek-ai/dsh-desktop start   # needs DSH_DESKTOP_URL in the environment
DSH_DESKTOP_URL=http://127.0.0.1:3080 DSH_DESKTOP_SMOKE_MS=8000 pnpm --filter @deepseek-ai/dsh-desktop start
```

## 已知限制与延期工作

- **没有打包安装器**：外壳从仓库检出目录运行；被服务的 GUI 就是启动器进程，因此 exe 需要捆绑已构建的服务器及其 node_modules。`electron-builder` 打包推迟到该布局存在之后。
- **Electron 是 devDependency**：发布包的使用者不会安装任何二进制；桌面模式是检出目录级功能，缺失时降级为浏览器 URL 并给出警告。
- **没有自定义应用图标或窗口装饰**：目前使用 Electron 默认图标与无菜单栏的标准边框。
