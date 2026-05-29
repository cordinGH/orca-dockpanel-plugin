import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'
import * as buttonManager from './button-manager.js'

let pluginName = ""
let mainEl = null

export async function load(name) {
  pluginName = name

  // 注入CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/dockpanel-styles.css`, pluginName)

  // 注册设置选项
  await registerSettings()

  // 启动模块
  await panelManager.start(pluginName)
  commandHandler.start(panelManager)
  buttonManager.start(panelManager)
  
  trackMainBorderRadius()
}

export async function unload() {
  console.log(`[dockpanel] 插件已卸载`)

  // 移除CSS
  orca.themes.removeCSSResources(pluginName)

  // 清理各个模块
  commandHandler.cleanup()
  panelManager.cleanup()
  buttonManager.cleanup()
  
  untrackMainBorderRadius()
}

function recordBorderRadius(e) {
  // 初始无e；事件调用时只认 main 自身的圆角过渡，忽略子元素冒泡上来的（transitionrun 会冒泡）
  if (e && e.target !== mainEl) return
  mainEl.style.setProperty("--dockedpanel-border-radius", getComputedStyle(mainEl).borderTopLeftRadius || "0px")
}
// 跟踪main元素的圆角变化
function trackMainBorderRadius() {
  mainEl = document.getElementById('main')
  if (!mainEl) return
  recordBorderRadius()

  mainEl.style.transition = "border-radius 1ms";
  mainEl.addEventListener("transitionend", recordBorderRadius);
}

function untrackMainBorderRadius() {
  if (!mainEl) return
  mainEl.removeEventListener("transitionend", recordBorderRadius);
  // 还原对 main 的副作用
  mainEl.style.transition = "";
  mainEl.style.removeProperty("--dockedpanel-border-radius");
  mainEl = null;
}

/**
 * 注册设置模式
 */
async function registerSettings() {
  const settingsSchema = {
    // 很长是为了方便其他插件订阅
    pluginDockPanelDefaultBlockId: {
      label: "默认块ID",
      description: "停靠面板的默认块id。若未填写则自动定向为今日日志。",
      type: "string",
      defaultValue: "",
    },
    enableAutoFocus: {
      label: "启动自动聚焦",
      description: "展开停靠面板时自动聚焦到停靠面板（建议开启）",
      type: "boolean",
      defaultValue: true,
    },

    enableTextShadow: {
      label: "启动按钮阴影",
      description: "存在停靠面板时，按钮会具有阴影效果以提升辨识度。",
      type: "boolean",
      defaultValue: true,
    },
    enableAutoCollapse: {
      label: "启动自动隐藏",
      description: "当停靠面板不再是active面板时（如焦点给到了其他面板），自动隐藏停靠面板。",
      type: "boolean",
      defaultValue: true,
    }
  }

  await orca.plugins.setSettingsSchema(pluginName, settingsSchema)

  if (orca.state.plugins[pluginName]?.settings.enableTextShadow) document.body.classList.add("dockpanel-has-text-shadow")
}