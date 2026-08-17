# Agent Note: Web GUI 通过 --desktop 获得原生桌面外壳

Status: implemented

[English](2026-08-14-desktop-shell-for-web-gui.md) | 中文

## Problem

`dsh web` 在回环端口上提供浏览器 GUI 并打印 URL；想要桌面程序的用户得到的却是终端加浏览器标签页。把 GUI 变成独立应用无法从浏览器一侧实现：服务器进程就是表层——它的会话、它的 HMR、它的 URL 行——桌面形态必须挂接到同一个服务器，而不是另起一个服务器替代它。

## Decision

`dsh web --desktop`（也包括 `--profile web --desktop`，以及仓库根目录的 `pnpm run desktop`）在同一个回环服务器之上用原生 Electron 窗口打开 GUI。该改动分三层：

- **外壳** — 新的 `apps/desktop` 包（`@deepseek-ai/dsh-desktop`）持有一个纯 JavaScript 的 Electron main（`electron/main.js`，无 lib 构建）。它完全由环境驱动：`DSH_DESKTOP_URL`（要渲染的 URL）、`DSH_DESKTOP_OWNER_PID`（正在提供服务的 dsh 进程）与 `DSH_DESKTOP_SMOKE_MS`（有界的冒烟模式，退出时不停止宿主）。窗口轮询 URL 最长 30 秒，超时后给出可见错误；`setWindowOpenHandler` 把链接交给默认浏览器；渲染器以沙箱 + 上下文隔离运行，无 Node 集成。
- **启动器行** — `packages/bundle/web-app/src/desktop.ts` 导出 `web-desktop` 函数插件（`{enabled}` 配置，注入 `webServer`），以 `web-desktop` 行加入 Web 组合包补丁，配置为 `enabled: !!js ctx.webStartup.desktop ?? false`。它通过自己声明的 `@deepseek-ai/dsh-desktop` 依赖解析外壳（应用目录来自包清单，Electron 二进制来自其中链接的 `electron` 包），等待与 URL 行相同的 Loader 结算，然后用运行中服务器的回环 URL 和自己的 pid 启动外壳。解析失败降级为警告加浏览器 URL——桌面模式永不导致启动失败。行被处置时会杀掉已启动的外壳，任何孤儿窗口都不会比其组合活得久。
- **flag** — `web-startup` 把 `--desktop` 解析进 `webStartup.desktop`，与 `--host`/`--port`/`--trusted-host` 完全同构；启动器其余部分不变。

外壳与启动器按 pid 契约共享同一生命周期：关闭窗口会停止启动器（Windows 上是强制的 `taskkill /T /F` 进程树终止——那里没有优雅的 SIGTERM；其余平台是 `SIGTERM`）；外壳里每 2 秒一次的宿主进程监视会在启动器先行退出（Ctrl+C）时关闭窗口。因为启动器进程为同一 URL 上的所有会话和浏览器标签页提供服务，关闭桌面窗口会把它们一并结束——这正是 Ctrl+C 原本就拥有的生命周期。

## Alternatives considered

- **打包成自带服务器子进程的独立 Electron 应用** — 本次改动拒绝：启动器在一切未经验证前就会退出，外壳还必须重新实现服务器就绪（解析 stdout 里的 URL）与每个启动器 flag 的透传。挂接到已启动的服务器保持单一进程模型、单一就绪信号，并保留降级到浏览器的路径。
- **与 web 家族并列的 `electron` 产品家族**（每个产品各配能力包）— 拒绝；[GUI 分层决策](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md)已经裁定产品共享 host/client 能力，而这个外壳没有新增任何能力包：它渲染的就是同一个被服务的表层。
- **Chromium WebView / Neutralino / Tauri** — 拒绝：Electron 是带 npm 安装二进制的维护中默认选项，因此整个桌面模式只是一个 devDependency 加一个纯 JS 文件。
- **只结束窗口对应的会话，或关闭时不停止启动器** — 拒绝：桌面程序语义要求关窗即退出程序，而启动器就是程序；按会话拆除在表层没有生命周期所有者。

## Consequences

- `dsh web --desktop` 在 Windows、macOS、Linux 上是真正的桌面程序；服务器进程未被触动，终端输出（`dsh web:` URL 行）、HMR 与会话保持不变。
- 外壳需要检出目录中已安装 Electron（`pnpm install`）；缺失时桌面模式只警告并继续提供浏览器 URL。已发布的 `@deepseek-ai/dsh-desktop` 包不带二进制（Electron 是 devDependency），因此在安装器打包把已构建服务器装进去之前，桌面模式是检出目录级功能。
- Windows 上的关窗是强制进程树终止：该路径没有优雅的 Cordis 处置（与机器关机的保证相同），POSIX 关窗仍会运行启动器的 SIGTERM 拆除。
- Web 组合中新增一行（`web-desktop`）和一个新发布应用包；会话日志、线上与持久化格式均无变化。

## Deferred

- 用 `electron-builder` 打包成可双击的 exe/安装器：需要把已构建的服务器及其 node_modules 装进应用镜像；外壳的环境契约（URL + 宿主 pid）仍是未来打包要喂给的接缝。
- 自定义图标与窗口装饰。
