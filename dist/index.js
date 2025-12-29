import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'

let pluginName = ""

// 记录 main 元素的 padding 值
let mainElementPaddings = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
}

let rootPanel = document.querySelector("#main>.orca-panels-row")

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
      mainElementPaddings = {
        top: parseFloat(styles.paddingTop) || 0,
        bottom: parseFloat(styles.paddingBottom) || 0,
        left: parseFloat(styles.paddingLeft) || 0,
        right: parseFloat(styles.paddingRight) || 0
      }
      setDockedPanelPosition()
      console.log(`[dockpanel] main 元素 padding 值已记录:`, mainElementPaddings)
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

  await registerSettings()

  // 启动模块
  await panelManager.start(pluginName)
  commandHandler.start(panelManager)
  
  // 设置右上角dockpanel按钮的左右键监听
  setBtnInfo()
  rootPanel.addEventListener('click', dockBtnHandler)
  rootPanel.addEventListener('contextmenu', dockBtnHandler)
  
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
  rootPanel.removeEventListener('click', dockBtnHandler)
  rootPanel.removeEventListener('contextmenu', dockBtnHandler)
  btnInfo = null

  await orca.plugins.setSettingsSchema(pluginName, {})
}


// 按钮的位置信息
let btnInfo = null
// 获取按钮的位置信息
function setBtnInfo(){
  const root = document.documentElement;
  const rootComputedStyle = getComputedStyle(root);
  const rootFontSize = parseFloat(rootComputedStyle.fontSize)

  // 获取自定义尺寸
  const getOrcaCustomLen = (propNameString) => {
    return parseFloat(rootComputedStyle.getPropertyValue(propNameString).trim()) * rootFontSize
  }

  const orcaSpacingMd = getOrcaCustomLen("--orca-spacing-md")
  const orcaSpacingSm = getOrcaCustomLen("--orca-spacing-sm")
  const orcaFontsizeLg = getOrcaCustomLen("--orca-fontsize-lg")
  const orcaSpacing2xs = getOrcaCustomLen("--orca-spacing-2xs")

  btnInfo = {
    btnRight: orcaSpacingMd + orcaSpacingSm,
    btnTop: 0.5 * rootFontSize,
    btnWight: orcaFontsizeLg + 2 * orcaSpacing2xs,
    btnHeight: orcaFontsizeLg + 2 * orcaSpacingSm
  }
}


/**
 * 处理停靠面板按钮点击事件
 */
async function dockBtnHandler(e) {
  const target = e.target
  // 如果点击的不是面板，不处理
  if (!target?.classList.contains("orca-panel")) return

  const targetPanelIsDockpanel = target.dataset.panelId === window.pluginDockpanel.panel.id

  // 如果左键点击的是折叠的停靠面板，则展开
  if (e.button === 0 && targetPanelIsDockpanel && window.pluginDockpanel.isCollapsed) {
    panelManager.toggleCollapsedClass()
    return
  }

  // 获取点按信息
  const rect = target.getBoundingClientRect()

  // 计算按钮相对于面板左边和上边的起始距离
  const { btnRight, btnTop, btnWight, btnHeight } = btnInfo;
  const btnXStart = rect.width - btnRight - btnWight
  const btnYStart = btnTop

  // 获取点击位置相对于面板左边和上边的距离
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 检查点击是否在按钮区域内
  if (x < btnXStart || x > btnXStart + btnWight || y < btnYStart || y > btnYStart + btnHeight) return
  
  e.stopPropagation()

  // 如果是右键的按钮
  if (e.button === 2) {
    // 右键的是停靠面板则会取消停靠
    if (targetPanelIsDockpanel) panelManager.dockCurrentPanel()
    return
  }

  // 如果左键点击的是展开的停靠面板的停靠按钮，则折叠。否则则停靠对应面板
  if (targetPanelIsDockpanel) {
    panelManager.toggleCollapsedClass()
  } else panelManager.dockCurrentPanel()
}



/**
 * 注册设置模式
 */
async function registerSettings() {
  const settingsSchema = {
    // 很长是为了方便其他插件订阅
    pluginDockPanelDefaultBlockId: {
      label: "默认块ID",
      description: "单屏时，点击停靠按钮会默认停靠今日日志。也可指定一个默认块ID替代日志。",
      type: "string",
      defaultValue: "",
    },
    enableHomeMode: {
      label: "启动主页模式",
      description: "启动后始终会打开新面板。「默认块ID」若未填写则新面板为今日日志",
      type: "boolean",
      defaultValue: false,
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