# Agent Note: Web 墙纸与面板透明——ui-appearance 插件

Status: implemented

[English](2026-08-18-web-wallpaper-and-panel-transparency.md) | 中文

## Problem

Web GUI 此前没有任何面向用户的背景能力:表面 token(`--dsw-alias-bg-*`、`--dsw-specific-sidebar-fill`)全部不透明,应用无法在面板背后展示墙纸,也没有任何入口让用户设置墙纸。墙纸功能与主题系统的关系,是两个既有扩展点单独都覆盖不了的:`theme.overrideTokens` 能把表面变半透明,但画不了背景图;而普通的 CSS 注入在客户端插件架构里没有正式的安放位置(动态插件的 `styles.insert` 内建只存在于沙箱;正式 client 包通过壳层 base.css 的 import 引入样式表)。功能还必须跨刷新持久化——settings seam 提供这一点——但只有被 api-proxy allowlist 显式接纳的 namespace 才可读写。

## Decision

新增客户端插件包 `packages/client/ui-appearance`,以三个独立图层承载整个能力,可自由叠加:

1. **墙纸层**:包内提供 `src/styles/wallpaper.css`,由壳层 base.css 在所有 ui-theme token 样式表之后引入。该样式表读取五个 body 作用域自定义属性(`--dshw-image/size/repeat/blur/dim`),把 `body::before`(图片,`filter` 模糊)与 `body::after`(压暗遮罩)绘制为 `position: fixed; z-index: -1` 层。浏览器半的 `WallpaperPresenter` 依据持久化分节写入这些属性,并在释放时只收回自己写入的内容——与 ui-layout `ThemePresenter` 的纪律一致。这些层位于应用自身表面之后:负 z-index 的定位伪元素绘制在画布(即 body 背景——因 html 不带背景而传播)之上、流入内容背景之下——因此墙纸恰好在 token 透明度允许透出的地方可见,在不透明表面下不可见,无需任何 DOM 重构。
2. **表面透明层**:面板模式(`solid`/`translucent`/`glass`)映射为 `theme.overrideTokens('ui-appearance', …)` 覆盖层,作用于六个表面别名,值以各调色板静态来源做 `color-mix(in srgb, var(--dsw-static-…) N%, transparent)`,因此随当前配色方案自动适配、无需重算,内置亮暗两套主题都不需要第三方主题参与。
3. **持久化分节**:`ui-appearance` settings 命名空间(墙纸 kind/value/fit/blur/dim 与面板模式)在宿主侧注册,浏览器侧经 `ctx.settingsScope` 绑定。api-proxy 的 `WEB_SETTINGS_NAMESPACES` allowlist 接纳该命名空间——这是任何 Settings 注册可被远程读写的显式决策点。

墙纸来源为渐变预设(id 持久化)、图片 URL(浏览器直接加载)与本地文件路径。本地文件不需要文件 RPC:宿主半注册 `/dsh-wallpaper` 前缀路由,每个请求读取分节中当前的路径,输出 `fs.readBytes` 的字节(≤ 20 MiB、按扩展名推断内容类型、`no-store`)。设置写入是唯一的线上面——路由读取的正是设置页写入的同一个分节。

## Alternatives considered

**宿主文件读取 RPC(ApiProxy 方法或 Typert remote)。** 否决:为服务一张图片,要新增 wire 方法、请求/响应 schema、特权方法条目,并在宿主信任边界上增加一个任意路径读取面。路由直接读取已持久化的路径,把爆炸半径限制在功能内部,且零新增 wire 词汇;代价(客户端对缺失文件没有错误反馈)记为已知限制。

**复用 `body` 自身的背景(html/body background-image)。** 否决:base.css 的 body 背景就是主题的画布(因 html 不带背景而传播),半透明表面位于其上,body 层的图片会被底色盖住。`z-index: -1` 的伪元素层绘制在画布之上、内容背景之下——这正是墙纸需要的层叠位置,且无需改动壳层 DOM。

**注册第三方主题而非 `overrideTokens`。** 否决:主题是整板调色定义,由偏好选择;面板模式是必须与用户主题选择叠加的单一 token 维度,这正是覆盖层的用途。

**把墙纸存在浏览器存储。** 否决:settings seam 已提供回环持久化与 Host 侧 revision 冲突处理;第二条持久化路径是重复建设。

## Consequences

功能以自包含包的形式落地,产品 DOM 与主题注册表零改动:停止插件 fiber 即收回全部图层,壳层只多一条 base.css import 与 bundle 名册行。层叠模型意味着墙纸只在半透明表面透出——这是预期的组合方式,但用户在不透明面板下选墙纸会看不到任何效果,直到切换面板模式,因此设置页文案明确说明二者的组合关系。

api-proxy allowlist 现在点名 `ui-appearance`;任何未来的 settings 命名空间仍须显式准入,两个包的 README 都记录了这份名单。路由每次请求都重读分节,因此墙纸变更在下次抓取即可见,无需缓存失效(由 `no-store` 保证)。本地文件始终留在宿主侧——浏览器除了自己写进 settings 的路径外不会收到任何文件系统路径,路由把读取上限在 20 MiB。
