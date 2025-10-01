import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'
let pluginName = "orca-dockpanel"
let leftClickHandler = null
let rightClickHandler = null

// 记录 main 元素的 padding 值
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
    // 额外等待一点时间确保 CSS 样式已应用
    await new Promise(resolve => setTimeout(resolve, 200))

    const mainElement = document.getElementById('main')
    if (mainElement) {
      const styles = window.getComputedStyle(mainElement)
      mainElementPaddings = {
        top: parseFloat(styles.paddingTop) || 0,
        bottom: parseFloat(styles.paddingBottom) || 0,
        left: parseFloat(styles.paddingLeft) || 0,
        right: parseFloat(styles.paddingRight) || 0
      }
      console.log(`${pluginName} main 元素 padding 值已记录:`, mainElementPaddings)

      // 设置 CSS 变量供样式使用
      setDockedPanelPosition()
    } else {
      console.warn(`${pluginName} 未找到 id="main" 的元素`)
    }
  } catch (error) {
    console.error(`${pluginName} 记录 main 元素 padding 值失败:`, error)
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
      originalResolve()
    }

    // 设置超时保护（5秒）
    const timeoutId = setTimeout(() => {
      console.log(`${pluginName} 插件加载检查超时，继续执行`)
      resolve()
    }, 5000)

    // 检查插件状态的函数
    const checkPlugins = () => {
      const { plugins } = orca.state
      // 直接获取有效的插件条目，过滤出存在有效plugin的条目
      const validPluginEntries = Object.entries(plugins).filter(([, plugin]) => plugin)
      if (validPluginEntries.length === 0) return
      // 获取已启用的插件和还在没加载好的插件
      const enabledPluginEntries = validPluginEntries.filter(([, plugin]) => plugin.enabled)
      const loadingPluginEntries = enabledPluginEntries.filter(([, plugin]) => !plugin.module)

      // 如果没有插件在加载，就认为加载完成
      if (loadingPluginEntries.length === 0) {
        console.log(`${pluginName} 插件加载完毕，已启用插件数量: ${enabledPluginEntries.length}`, enabledPluginEntries)
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
      // 如果 valtio 不可用，记录警告
      console.warn(`${pluginName} valtio 不可用，插件状态检查可能不准确`)
    }
  })
}


/**
 * 设置停靠面板的位置 CSS 变量
 */
function setDockedPanelPosition() {
  try {
    const root = document.documentElement
    // 记录main边距，以便保持任何边距下，都能和外壳保持相同距离；也为了挂起时可以自适应和挂起面板边框的距离
    root.style.setProperty('--docked-panel-base-top', `${mainElementPaddings.top}px`)
    root.style.setProperty('--docked-panel-base-left', `${mainElementPaddings.left}px`)
    root.style.setProperty('--docked-panel-base-bottom', `${mainElementPaddings.bottom}px`)
    root.style.setProperty('--docked-panel-base-right', `${mainElementPaddings.right}px`)
    console.log(`${pluginName} 停靠面板基础位置已设置`)
  } catch (error) {
    console.error(`${pluginName} 设置停靠面板位置失败:`, error)
  }
}


export async function load(name) {
  pluginName = name
  console.log(`${pluginName} 插件已加载`)

  // 注入CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/styles.css`, pluginName)
  orca.themes.injectCSSResource(`${pluginName}/dist/button.css`, pluginName)

  await registerSettings()

  // 启动模块
  await panelManager.start(pluginName, getDefaultBlockId())
  await commandHandler.start(pluginName, panelManager)

  // 设置左键和右键的监听
  leftClickHandler = (e) => handleDockButtonClick(e, `${pluginName}.dockCurrentPanel`)
  rightClickHandler = (e) => {

    // 在右键按钮或者隐藏面板时，改变右键行为
    const dockedPanel = document.querySelector('.collapsed-docked-panel > .orca-panel:nth-child(1 of .orca-panel)')
    if (dockedPanel && dockedPanel.contains(e.target)) {
      e.preventDefault()
    }
    e.stopPropagation()

    // 如果是点击折叠面板，不需要约束点击按钮区域 ，直接弹出面板
    const collapsedPanel = document.querySelector('.has-docked-panel.collapsed-docked-panel > .orca-panel:nth-child(1 of .orca-panel)')
    if (collapsedPanel && collapsedPanel.contains(e.target)) {
      orca.commands.invokeCommand(`${pluginName}.toggleDockedPanelCollapse`)
      return
    }

    handleDockButtonClick(e, `${pluginName}.toggleDockedPanelCollapse`)
  }
  document.addEventListener('click', leftClickHandler)
  document.addEventListener('contextmenu', rightClickHandler)

  // 记录main元素的padding作为挂起面板的基准定位。
  recordMainElementPaddings()
}

export async function unload() {
  console.log(`${pluginName} 插件已卸载`)

  // 移除CSS
  orca.themes.removeCSSResources(pluginName)

  // 清理设置模式（可选，unregister 会自动清理）
  try {
    await orca.plugins.setSettingsSchema(pluginName, {})
    console.log(`${pluginName} 设置模式已清理`)
  } catch (error) {
    console.log(`${pluginName} 设置模式清理失败:`, error)
  }

  // 清理各个模块
  await commandHandler.cleanup()
  await panelManager.cleanup()
  document.removeEventListener('click', leftClickHandler)
  document.removeEventListener('contextmenu', rightClickHandler)
}




/**
 * 处理停靠面板按钮点击事件
 */
async function handleDockButtonClick(e, command) {
  const target = e.target
  if (!target?.classList.contains("orca-panel")) return

  // 获取点按信息
  const rect = target.getBoundingClientRect()
  const styles = window.getComputedStyle(target)
  const fontSize = parseFloat(styles.fontSize)

  const buttonMarginRight = 1.3 * fontSize
  const buttonMarginTop = 0.5 * fontSize
  const buttonBoxWidth = (1.125 + 0.0625 * 2) * fontSize
  const buttonBoxHeight = (1.125 + 0.3 * 2) * fontSize
  // 计算按钮相对于面板左边和上边的起始距离
  const buttonXStart = rect.width - buttonMarginRight - buttonBoxWidth
  const buttonYStart = buttonMarginTop

  // 获取点击位置相对于面板左边和上边的距离
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 检查点击是否在按钮区域内
  if (x < buttonXStart || x > buttonXStart + buttonBoxWidth ||
    y < buttonYStart || y > buttonYStart + buttonBoxHeight) {
    return
  }
  
  // 获取面板ID
  const panelId = target.dataset.panelId
  if (!panelId) return

  // 阻止事件冒泡
  e.stopPropagation()
  
  orca.commands.invokeCommand(command)
}



/**
 * 注册设置模式
 */
async function registerSettings() {
  const settingsSchema = {
    defaultBlockId: {
      label: "默认块ID",
      description: "单屏时，点击停靠按钮会默认停靠今日日志。可指定一个默认块替代日志。例如填写 1 ",
      type: "string",
      defaultValue: "",
    }
  }

  await orca.plugins.setSettingsSchema(pluginName, settingsSchema)
  console.log(`${pluginName} 设置界面已加载，当前默认块id：${getDefaultBlockId()}`)
}

/**
 * 获取设置值
 */
export function getSettings() {
  return orca.state.plugins[pluginName]?.settings || {}
}

/**
 * 获取默认块ID
 */
export function getDefaultBlockId() {
  const settings = getSettings()
  return settings.defaultBlockId || ""
}