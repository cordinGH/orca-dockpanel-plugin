import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'

let pluginName = "panel-suspend"

export async function load(name) {
  pluginName = name
  console.log(`${pluginName} 插件已加载`)
  
  // 注入CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/styles.css`, pluginName)
  
  // 启动模块
  await panelManager.start(pluginName)
  await commandHandler.start(pluginName, panelManager)
}

export async function unload() {
  console.log(`${pluginName} 插件已卸载`)
  
  // 移除CSS
  orca.themes.removeCSSResources(pluginName)
  
  // 清理各个模块
  await commandHandler.cleanup()
  await panelManager.cleanup()
}
