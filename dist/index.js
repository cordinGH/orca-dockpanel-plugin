import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'
import * as buttonManager from './button-manager.js'

let pluginName = ""

// 记录 main 元素的 padding 值(px)
let mainElementPaddings = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
}

/**
 * 记录 main 元素的 padding 值
 */
async function recordMainElementPaddings() {
  try {
    // 等待所有插件加载完毕
    await waitForEnabledPluginsLoaded()
    // 等待两帧确保 DOM 完全渲染并且 CSS 计算完毕
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const mainElement = document.getElementById('main')
    if (mainElement) {
      const styles = window.getComputedStyle(mainElement)
      // 设置圆角变量（停靠面板所需）
      mainElement.style.setProperty("--main-border-radius", styles.borderTopLeftRadius || "0px")
      mainElementPaddings = {
        top: parseFloat(styles.paddingTop) || 0,
        bottom: parseFloat(styles.paddingBottom) || 0,
        left: parseFloat(styles.paddingLeft) || 0,
        right: parseFloat(styles.paddingRight) || 0
      }
      setDockedPanelPosition()

    } else {
      console.warn(`[dockpanel] 未找到 id="main" 的元素`)
    }
  } catch (error) {
    console.error(`[dockpanel] 记录 main 元素 padding 值失败:`, error)
  }
}

/**
 * 等待所有已启用的插件加载完毕（使用 valtio 订阅）
 */
async function waitForEnabledPluginsLoaded() {
  return new Promise((resolve) => {
    // 重写resolve函数，确保清理资源
    const originalResolve = resolve
    let unsubscribe = null

    resolve = () => {
      if (unsubscribe) unsubscribe()
      clearTimeout(timeoutId)
      originalResolve()
    }

    // 设置超时保护（5秒）
    const timeoutId = setTimeout(() => {
      console.log(`[dockpanel] 插件加载检查超时，继续执行`)
      resolve()
    }, 5000)

    // 检查插件状态的函数
    const checkPlugins = () => {
      const { plugins } = orca.state
      // 直接获取有效的插件条目，过滤出存在有效plugin的条目
      const validPluginEntries = Object.entries(plugins).filter(([, plugin]) => plugin)
      if (validPluginEntries.length === 0) {
        resolve()
        return
      }
      // 获取已启用的插件和还在没加载好的插件
      const enabledPluginEntries = validPluginEntries.filter(([, plugin]) => plugin.enabled)
      const loadingPluginEntries = enabledPluginEntries.filter(([, plugin]) => !plugin.module)

      // 如果没有插件在加载，就认为加载完成
      if (loadingPluginEntries.length === 0) {
        console.log(`[dockpanel] 插件加载完毕，已启用插件数量: ${enabledPluginEntries.length}`, enabledPluginEntries)
        clearTimeout(timeoutId)
        resolve()
      }
    }

    // 使用 valtio 订阅插件状态变化
    if (window.Valtio && window.Valtio.subscribe) {
      unsubscribe = window.Valtio.subscribe(orca.state.plugins, checkPlugins)
      // 立即检查一次，防止创建订阅之前就已经加载完成
      checkPlugins()
    } else {
      console.warn(`[dockpanel] valtio 不可用，插件状态检查可能不准确`)
    }
  })
}


/**
 * 设置停靠面板的位置 CSS 变量
 */
function setDockedPanelPosition() {
    const root = document.documentElement
    // 记录main边距，以便保持任何边距下，都能和外壳保持相同距离；也为了挂起时可以自适应和挂起面板边框的距离
    root.style.setProperty('--docked-panel-base-top', `${mainElementPaddings.top}px`)
    root.style.setProperty('--docked-panel-base-left', `${mainElementPaddings.left}px`)
    root.style.setProperty('--docked-panel-base-bottom', `${mainElementPaddings.bottom}px`)
    root.style.setProperty('--docked-panel-base-right', `${mainElementPaddings.right}px`)
    console.log(`[dockpanel] 停靠面板基础位置已设置`)
}


export async function load(name) {
  pluginName = name

  // 注入CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/styles.css`, pluginName)
  orca.themes.injectCSSResource(`${pluginName}/dist/button.css`, pluginName)

  // 注册设置选项
  await registerSettings()

  // 启动模块
  await panelManager.start(pluginName)
  commandHandler.start(panelManager)
  buttonManager.start(panelManager)
  
  // 记录main元素的padding作为挂起面板的基准定位。
  recordMainElementPaddings()
}

export async function unload() {
  console.log(`[dockpanel] 插件已卸载`)

  // 移除CSS
  orca.themes.removeCSSResources(pluginName)

  // 清理各个模块
  commandHandler.cleanup()
  panelManager.cleanup()
  buttonManager.cleanup()

  // 清空设置选项
  await orca.plugins.setSettingsSchema(pluginName, {})
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
    }
  }

  await orca.plugins.setSettingsSchema(pluginName, settingsSchema)
}