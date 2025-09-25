/**
 * 命令处理模块
 * 负责注册和管理插件命令
 */

// 模块状态
let pluginName = ""
let panelManager = null

/**
 * 启动模块
 */
export async function start(name, pm) {
  pluginName = name
  panelManager = pm
  // 注册插件命令
  registerCommands()

  console.log(`${pluginName} 命令处理模块已启动`)
}

/**
 * 清理模块
 */
export async function cleanup() {
  // 清理注册的命令
  cleanupCommands()

  console.log(`${pluginName} 命令处理模块已清理`)
}

/**
 * 注册插件命令
 */
function registerCommands() {
  // 停靠当前面板
  orca.commands.registerCommand(
    `${pluginName}.dockCurrentPanel`,
    async () => {
      if (!panelManager.hasDockedPanel()) {
        await panelManager.dockCurrentPanel()
      } else if (panelManager.getDockedPanelID() !== orca.state.activePanel) {
        await panelManager.undockPanel()
        await panelManager.dockCurrentPanel()
      } else {
        await panelManager.undockPanel()
      }
    },
    "开启/取消当前面板的停靠(dock)"
  )

  // 切换停靠面板的收起/展开状态
  orca.commands.registerCommand(
    `${pluginName}.toggleDockedPanelCollapse`,
    async () => {
      if (!panelManager.hasDockedPanel()) {
        orca.notify("warn", "没有停靠面板")
        return
      } else{
        panelManager.toggleCollapsedClass()
      }
    },
    "收起/展开停靠的面板(dock)"
  )
}

/**
 * 清理注册的命令
 */
function cleanupCommands() {
  orca.commands.unregisterCommand(`${pluginName}.dockCurrentPanel`)
  orca.commands.unregisterCommand(`${pluginName}.toggleDockedPanelCollapse`)
}