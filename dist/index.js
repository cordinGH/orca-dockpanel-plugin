import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'

let pluginName = "panel-suspend"

export async function load(name) {
  pluginName = name
  console.log(`${pluginName} 插件已加载`)
  
  // 注入CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/styles.css`, pluginName)
  orca.themes.injectCSSResource(`${pluginName}/dist/button.css`, pluginName)
  
  // 启动模块
  await panelManager.start(pluginName)
  await commandHandler.start(pluginName, panelManager)
  document.addEventListener('click', handleDockButtonClick)
}

export async function unload() {
  console.log(`${pluginName} 插件已卸载`)
  
  // 移除CSS
  orca.themes.removeCSSResources(pluginName)
  
  // 清理各个模块
  await commandHandler.cleanup()
  await panelManager.cleanup()
  document.removeEventListener('click', handleDockButtonClick)
}



/**
 * 处理停靠面板按钮点击事件
 */
async function handleDockButtonClick(e) {
  const target = e.target
  if (!target?.classList.contains("orca-panel")) return

  const rect = target.getBoundingClientRect()
  const styles = window.getComputedStyle(target)
  const fontSize = parseFloat(styles.fontSize)

  // 计算按钮区域（右上角 24x24px，距离边缘 8px）
  const buttonWidth = (1.125 + 0.0625 * 2) * fontSize  // 1.25rem = 20px
  const buttonHeight = (1.125 + 0.3 * 2) * fontSize    // 1.725rem = 27.6px ≈ 28px
  const buttonMarginRight = 1.3 * fontSize  // 距离右边 1.3 个字体大小
  const buttonMarginTop = 0.5 * fontSize
  const buttonX = rect.width - buttonMarginRight - buttonWidth
  const buttonY = buttonMarginTop

  // 获取点击位置相对于面板左边和上边的距离
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 检查点击是否在按钮区域内
  if (x < buttonX || x > buttonX + buttonWidth ||
      y < buttonY || y > buttonY + buttonHeight) {
      return
  }
  // 获取面板ID
  const panelId = target.dataset.panelId
  if (!panelId) return

  orca.commands.invokeCommand(`${pluginName}.dockCurrentPanel`)
}
