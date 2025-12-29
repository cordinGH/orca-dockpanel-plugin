/**
 * 命令处理模块
 * 负责注册和管理插件命令
 */

let panelManager = null

// 快捷键常量
const alt_q = "alt+q"
let commandName = null

/**
 * 启动模块
 */
export function start(pm) {
  commandName = {
    dock: 'dockpanel.dockCurrentPanel',
    toggle: 'dockpanel.toggleDockedPanelCollapse',
    menuOpen: 'dockpanel.openInDockedpanel'
  }
  panelManager = pm

  registerCommands()

  assignDefaultShortcuts()
}

/**
 * 清理模块
 */
export function cleanup() {
  // 清理命令
  orca.commands.unregisterCommand(commandName.dock)
  orca.commands.unregisterCommand(commandName.toggle)

  orca.blockMenuCommands.unregisterBlockMenuCommand(commandName.menuOpen);
  
  // 清理快捷键 - 重置为默认状态
  orca.shortcuts.reset(commandName.toggle)
}

/**
 * 注册插件命令
 */
function registerCommands() {
  // 停靠当前面板
  orca.commands.registerCommand(
    commandName.dock,
    () => panelManager.dockCurrentPanel(),
    "切换当前面板的停靠状态（dock）"
  )

  // 切换停靠面板的收起/展开状态
  orca.commands.registerCommand(
    commandName.toggle,
    () => panelManager.toggleCollapsedClass(),
    "隐藏/弹出停靠面板（dock）"
  )

  // 新功能，右键菜单直接打开停靠面板  2025年12月13日
  orca.blockMenuCommands.registerBlockMenuCommand(commandName.menuOpen, {
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
    // 等待1秒确保快捷键列表加载完毕
    await new Promise(resolve => setTimeout(resolve, 1000))
    const existingCommand = orca.state.shortcuts[alt_q]
    if (!existingCommand) {
      orca.shortcuts.assign(alt_q, commandName.toggle)
      orca.notify("success", `[dockpanel] 已为「隐藏/弹出停靠面板」分配闲置快捷键Alt + Q`)
    } else if (existingCommand === commandName.toggle) {
      orca.notify("success", `[dockpanel]「隐藏/弹出停靠面板」快捷键 Alt + Q`)
    } else {
      orca.notify("info", `[dockpanel] Alt + Q 已占用，请自行为「隐藏/弹出停靠面板」配置快捷键`)
    }
}