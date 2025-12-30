/**
 * 命令处理模块
 * 负责注册和管理插件命令
 */

let panelManager = null

// 快捷键常量
const alt_q = "alt+q"
let commands = null
let blockMenuCommand = ""

// 注册插件命令
function registerCommands() {
  
  commands = {
    // 停靠当前面板。已存在则更换。
    dock: {
      name: 'dockpanel.dockCurrentPanel',
      fn: panelManager.dockCurrentPanel,
      description: "[dockpanel] 将当前面板转为停靠面板（已存在停靠面板则更替）"
    },

    // 统一的切出/切入，配合快捷键可以达到主页模式的效果
    toggle: {
      name: 'dockpanel.toggleDockedPanel',
      fn: panelManager.toggleDockedPanel,
      description: "[dockpanel] 切出/隐藏停靠面板（若当前无停靠面板则新建）"
    },
    
    // 取消停靠面板回归正常显示（单一功能，降低命令区分的心智负担​）
    unDocked: {
      name: 'dockpanel.unDocked',
      fn: panelManager.undockPanel,
      description: "[dockpanel] 退出停靠"
    },

    gotoDefaultBlock: {
      name: 'dockpanel.gotoDefaultBlockOnDockedPanel',
      fn: panelManager.gotoDefaultBlockOnDockedPanel,
      description: "[dockpanel] 在停靠面板中前往默认块（主页）"
    }
  }

  blockMenuCommand = 'dockpanel.openInDockedpanel'

  Object.values(commands).forEach(({name,fn,description}) => orca.commands.registerCommand(name, fn, description))
  
  // 新功能，右键菜单直接打开停靠面板  2025年12月13日
  orca.blockMenuCommands.registerBlockMenuCommand(blockMenuCommand, {
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


// 分配默认快捷键
async function assignDefaultShortcuts() {
    // 等待1秒确保快捷键列表加载完毕
    await new Promise(resolve => setTimeout(resolve, 2000))
    const shortcut = orca.state.shortcuts[commands.toggle.name]
    if (!shortcut) {
      orca.notify("info", '[dockpanel] 「切出/隐藏停靠面板」暂无快捷键，推荐配置')
    } else {
      orca.notify("success", `[dockpanel] 「切出/隐藏停靠面板」快捷键为${shortcut}`)
    }
}


export function start(pm) {
  panelManager = pm

  registerCommands()

  assignDefaultShortcuts()
}

export function cleanup() {
  // 清理命令
  Object.values(commands).forEach(command => orca.commands.unregisterCommand(command.name))

  orca.blockMenuCommands.unregisterBlockMenuCommand(blockMenuCommand);

  // 清理快捷键 - 重置为默认状态
  orca.shortcuts.reset(commands.toggle.name)
}