/** Appearance settings page dictionaries (zh authoritative; en mirrors). */

/** Locale namespace owned by the appearance plugin. */
export const APPEARANCE_NS = 'appearance'

/** zh copy for the appearance settings page. */
export const zh = {
  'nav': '背景与外观',
  'wallpaper.title': '墙纸背景',
  'presets.none': '无',
  'presets.aurora': '极光',
  'presets.ocean': '深海',
  'presets.sunset': '晚霞',
  'presets.forest': '森林',
  'presets.graphite': '石墨',
  'custom.title': '自定义图片',
  'custom.urlPlaceholder': '图片 URL(https://…)',
  'custom.urlApply': '应用 URL',
  'custom.localPlaceholder': '本地文件路径(如 D:\\pictures\\wall.jpg)',
  'custom.localApply': '应用本地',
  'custom.localHint': '路径保存在设置中,由宿主读取并托管,刷新页面后仍然生效。',
  'fit.title': '显示方式',
  'fit.cover': '铺满',
  'fit.contain': '适应',
  'fit.tile': '平铺',
  'dim.title': '压暗遮罩',
  'surface.title': '面板透明',
  'surface.solid': '不透明',
  'surface.solidDesc': '面板保持原样,墙纸仅作底层',
  'surface.translucent': '半透明',
  'surface.translucentDesc': '面板半透明,透出墙纸',
  'surface.glass': '玻璃',
  'surface.glassDesc': '面板更透,呈现玻璃质感',
  'reset': '重置为默认外观',
  'hint': '墙纸与面板透明互不排斥,可自由叠加组合。',
} as const

/** en copy for the appearance settings page. */
export const en: Record<keyof typeof zh, string> = {
  'nav': 'Background & Appearance',
  'wallpaper.title': 'Wallpaper',
  'presets.none': 'None',
  'presets.aurora': 'Aurora',
  'presets.ocean': 'Ocean',
  'presets.sunset': 'Sunset',
  'presets.forest': 'Forest',
  'presets.graphite': 'Graphite',
  'custom.title': 'Custom image',
  'custom.urlPlaceholder': 'Image URL (https://…)',
  'custom.urlApply': 'Apply URL',
  'custom.localPlaceholder': 'Local file path (e.g. C:\\pictures\\wall.jpg)',
  'custom.localApply': 'Apply local',
  'custom.localHint': 'The path is stored in settings; the host reads and serves it, so it survives a page reload.',
  'fit.title': 'Fit mode',
  'fit.cover': 'Cover',
  'fit.contain': 'Contain',
  'fit.tile': 'Tile',
  'dim.title': 'Dim overlay',
  'surface.title': 'Panel transparency',
  'surface.solid': 'Solid',
  'surface.solidDesc': 'Panels keep their base look; the wallpaper stays underneath',
  'surface.translucent': 'Translucent',
  'surface.translucentDesc': 'Panels become translucent and reveal the wallpaper',
  'surface.glass': 'Glass',
  'surface.glassDesc': 'More transparent; reads as a glass surface',
  'reset': 'Reset to default appearance',
  'hint': 'Wallpaper and panel transparency combine freely.',
}

/** Copy keys shared by the zh and en dictionaries. */
export type AppearanceKey = keyof typeof zh
