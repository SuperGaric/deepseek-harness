# @deepseek-ai/dsh-client-ui-appearance

[English](README.md) | 中文

外观插件:承载"背景与外观"设置页背后的持久化墙纸与面板透明偏好。它持有 `ui-appearance` settings 命名空间(墙纸的 kind/value/fit/dim 与面板模式)、墙纸 DOM 层、半透明表面 token 层,以及 id 为 `appearance` 的 `settings.section` 设置页席位。

墙纸层就是 `html` 画布背景——位于所有表面之后,绝不会遮挡应用:本包提供一份全局样式表(由壳层在 token 样式表之后引入),读取文档级 `--dshw-*` 自定义属性;浏览器半的 `WallpaperPresenter` 依据持久化分节写入这些属性。基础 token 背景保持不变,因此墙纸只在表面允许透出的地方可见——这恰是面板透明模式所控制的。图片来源有三种:内置渐变预设(id 持久化)、图片 URL(浏览器直接加载)与本地文件路径(由宿主半经 `/dsh-wallpaper` 前缀路由按需读取当前分节中的路径来提供——设置写入是唯一的线上面,不存在文件 RPC)。

面板模式映射为 `theme.overrideTokens('ui-appearance', …)` 覆盖层,作用于六个表面别名(`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1/2/3`、`--dsw-alias-bg-overlay`、`--dsw-specific-sidebar-fill`),值以各调色板静态来源做 `color-mix`,因此半透明/玻璃值随当前配色方案自动适配、无需重算;`solid` 保持产品 token 原样。墙纸与面板透明是两个独立维度,可自由组合。

宿主半在组合了 `settings`、`fs` 与 `webServer` 时,向 Host settings seam 注册命名空间(`settingsNamespace('ui-appearance')`)并注册墙纸路由。该命名空间之所以可被远程读写,是因为 api-proxy allowlist(`WEB_SETTINGS_NAMESPACES`)接纳了它——仅新增一项 Settings 注册绝不会使其暴露。

## 模型体验

无——本插件只渲染浏览器设置界面;没有任何内容进入模型请求。

#### KV 缓存效应

无;本包既不组装也不发送任何提供方请求。

## 已知限制与后续工作

- 本地墙纸来源是手动输入的路径;目前没有原生图片选择器,文件缺失或不可读时路由返回 404(墙纸不可见)。
- 墙纸层按浏览器生效:同一宿主实例的每个回环浏览器都渲染同一份持久化分节。
- `solid` 面板会遮住墙纸;压暗遮罩只在至少一个表面为半透明时有视觉效果。
