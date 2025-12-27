/**
 * 命令处理模块
 * 负责注册和管理插件命令
 */

// 模块状态
let pluginName = ""
let panelManager = null

// 快捷键常量
const alt_q = "alt+q"
// const c_alt_q = "ctrl+alt+q"

/**
 * 启动模块
 */
export async function start(name, pm) {
  pluginName = name
  panelManager = pm
  // 注册插件命令
  registerCommands()
}

/**
 * 清理模块
 */
export async function cleanup() {
  // 清理注册的命令
  cleanupCommands()

  console.log(`[dockpanel] 命令处理模块已清理`)
}

/**
 * 注册插件命令
 */
function registerCommands() {
  // 停靠当前面板
  orca.commands.registerCommand(
    `dockpanel.dockCurrentPanel`,
    () => panelManager.dockCurrentPanel(),
    "切换当前面板的停靠状态（dock）"
  )

  // 切换停靠面板的收起/展开状态
  orca.commands.registerCommand(
    `dockpanel.toggleDockedPanelCollapse`,
    () => panelManager.toggleCollapsedClass(),
    "隐藏/弹出停靠面板（dock）"
  )

  assignDefaultShortcuts()

  // 新功能，右键菜单直接打开停靠面板  2025年12月13日
  orca.blockMenuCommands.registerBlockMenuCommand("dockpanel.openInDockedpanel", {
    worksOnMultipleBlocks: false,
    render: (blockId, rootBlockId, close) => {
        const { createElement } = window.React;
        return createElement(orca.components.MenuText, {
            preIcon: "ti ti-external-link",
            title: "在停靠面板打开",
            onClick: () => {
                close();
                panelManager.openInDockedpanel(blockId)
            }
        });
    }
  })
}

/**
 * 分配默认快捷键
 */
async function assignDefaultShortcuts() {
  try {
    // 等待1秒确保快捷键列表加载完毕
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 通用快捷键分配函数
    async function assignShortcut(shortcut, dockPanelCommand, description, keyName) {
      const existingCommand = orca.state.shortcuts[shortcut]
      
      if (existingCommand && existingCommand !== dockPanelCommand) {
        const lowerCommand = existingCommand.toLowerCase()
        const isDockPanelCommand = (lowerCommand.includes("dock") && lowerCommand.includes("panel"))
        
        if (isDockPanelCommand) {
          console.log(`[dockpanel] ${keyName} 被 dockpanel其他版本占用，故覆盖分配`)
        } else {
          console.warn(`[dockpanel] ${keyName} 已被占用: ${existingCommand}`)
          orca.notify("warn", `默认快捷键${keyName}分配失败，请手动分配`)
          return false
        }
      }
      
      await orca.shortcuts.assign(shortcut, dockPanelCommand)
      orca.notify("success", `已为dockpanel插件「${description}」，分配闲置快捷键 ${keyName}`)
      return true
    }
    
    // 分配快捷键
    await assignShortcut(alt_q, `dockpanel.toggleDockedPanelCollapse`, "隐藏/弹出停靠面板", "Alt+Q")
    // await assignShortcut(c_alt_q, `dockpanel.dockCurrentPanel`, "切换当前面板的停靠状", "Ctrl+Alt+Q")
    
  } catch (error) {
    console.warn(`[dockpanel] 快捷键分配失败:`, error)
  }
}

/**
 * 清理注册的命令和快捷键
 */
async function cleanupCommands() {
  // 清理命令
  orca.commands.unregisterCommand(`dockpanel.dockCurrentPanel`)
  orca.commands.unregisterCommand(`dockpanel.toggleDockedPanelCollapse`)

  orca.blockMenuCommands.unregisterBlockMenuCommand("dockpanel.openInDockedpanel");
  
  // 清理快捷键 - 重置为默认状态
  await orca.shortcuts.reset(`dockpanel.toggleDockedPanelCollapse`)
  // await orca.shortcuts.reset(`dockpanel.dockCurrentPanel`)
}