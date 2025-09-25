/**
 * 分屏挂起插件 - 主入口文件 (函数式版本)
 * 允许用户挂起当前面板，将其移动到面板列表末尾，避免在面板切换时被选中
 */

import * as panelManager from './panel-manager.js'
import * as commandHandler from './command-handler.js'

let pluginName = "panel-suspend"

/**
 * 插件加载函数
 */
export async function load(name) {
  pluginName = name
  console.log(`${pluginName} 插件已加载 (函数式版本)`)
  
  // 注入CSS样式
  orca.themes.injectCSSResource(`${pluginName}/dist/styles.css`, pluginName)
  
  // 启动各个模块
  await panelManager.start(pluginName)
  await commandHandler.start(pluginName, panelManager)
}

/**
 * 插件卸载函数
 */
export async function unload() {
  console.log(`${pluginName} 插件已卸载 (函数式版本)`)
  
  // 移除CSS资源
  orca.themes.removeCSSResources(pluginName)
  
  // 清理各个模块
  await commandHandler.cleanup()
  await panelManager.cleanup()
}
