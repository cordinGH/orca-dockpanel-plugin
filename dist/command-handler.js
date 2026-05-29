/**
 * 命令处理模块
 * 负责注册和管理插件命令
 */

let panelManager = null

let commands = null
let blockMenuCommand = ""

// 注册插件命令
function registerCommands() {
  
  commands = {
    // 停靠当前面板。已存在则更换。
    dock: {
      name: 'dockpanel.dockPanel',
      fn () {
        const {activePanel} = orca.state;
        // 排除预览和全局搜索
        if (activePanel.startsWith("_")) return;
        panelManager.dockPanel(activePanel)
      },
      description: "[dockpanel] 将当前面板转为停靠面板（已存在停靠面板则交换）"
    },

    // 统一的切出/切入，配合快捷键可以达到主页模式的效果
    toggle: {
      name: 'dockpanel.toggleDockedPanel',
      fn: panelManager.toggleDockedPanel,
      description: "[dockpanel] 切出/隐藏停靠面板（若当前无停靠面板则新建）"
    },
    
    // 取消停靠面板回归正常显示（单一功能，降低命令区分的心智负担​）
    unDocked: {
      name: 'dockpanel.undockPanel',
      fn: panelManager.undockPanel,
      description: "[dockpanel] 退出停靠"
    },

    gotoDefaultBlock: {
      name: 'dockpanel.gotoDefaultBlockOnDockedPanel',
      fn: panelManager.gotoDefaultBlockOnDockedPanel,
      description: "[dockpanel] 在停靠面板前往默认块（若当前无停靠面板则新建）"
    }, 

    gotoDefaultBlockOnCurrentPanel: {
      name: 'dockpanel.gotoDefaultBlockOnCurrentPanel',
      fn: panelManager.gotoDefaultBlockOnCurrentPanel,
      description: "[dockpanel] 在当前面板前往默认块"
    },

    openInDockedpanel2: {
      name: 'dockpanel.openInDockedpanel2',
      fn() {
        const selection = window.getSelection();
        const cursorData = orca.utils.getCursorDataFromSelection(selection);
        const blockId = cursorData?.focus?.blockId;
        if (!blockId) return
        panelManager.openInDockedpanel(blockId)
      },
      description: "[dockpanel] 在停靠面板打开当前光标所在块"
    }
  }

  blockMenuCommand = 'dockpanel.openInDockedpanel'

  Object.values(commands).forEach(({name,fn,description}) => orca.commands.registerCommand(name, fn, description))
  
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


export function start(pm) {
  panelManager = pm
  registerCommands()
}

export function cleanup() {
  // 清理命令
  Object.values(commands).forEach(command => orca.commands.unregisterCommand(command.name))
  commands = null
  orca.blockMenuCommands.unregisterBlockMenuCommand(blockMenuCommand);
}