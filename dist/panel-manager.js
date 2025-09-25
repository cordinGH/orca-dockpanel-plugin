/**
 * 面板管理模块
 * 负责面板的停靠、恢复和状态管理
 */

// 模块状态
let pluginName = ""
let dockedPanelID = null
let panelCloseWatcher = null
let isCollapsed = false

/**
 * 启动模块
 */
export async function start(name) {
  pluginName = name
  dockedPanelID = null
  isCollapsed = false
  // 监听面板关闭事件
  setupPanelCloseWatcher()
  
  console.log(`${pluginName} 面板管理模块已启动`)
}

/**
 * 清理模块
 */
export async function cleanup() {
  // 清理面板关闭监听器
  cleanupPanelCloseWatcher()

  // 如果有停靠的面板，先取消停靠
  if (dockedPanelID) {
    await undockPanel()
  }
  console.log(`${pluginName} 面板管理模块已清理`)
}

/**
 * 停靠当前面板
 */
export async function dockCurrentPanel() {
  if (!orca.nav.isThereMoreThanOneViewPanel()) {
    orca.notify("warn", "只有一个面板，无法停靠")
    return
  }

  const currentPanelId = orca.state.activePanel
  const firstPanel = orca.state.panels.children[0]
  const numberOfLevel1Panel = orca.state.panels.children.length

  // 当根row的只有一个colChild且col内只有2个普通面板，禁止停靠，因为会破坏结构
  if (numberOfLevel1Panel === 1 && firstPanel.children.length === 2 && firstPanel.children.every(child => child.view)) {
    orca.notify("warn", "当前布局特殊，不支持停靠")
    return
  }
  // 如果当前面板就是第一个面板，则正常移动
  if (firstPanel.id !== currentPanelId) {
    // 正常移动
    orca.nav.move(currentPanelId, firstPanel.id, "left")
  }
  dockedPanelID = currentPanelId
  addDockPanelClass()
  removeCollapsedClass()
  orca.notify("success", "面板已停靠显示")
}

/**
 * 取消停靠面板
 */
export async function undockPanel() {
  // 移除根容器样式类
  removeDockPanelClass()
  // 清空停靠状态
  dockedPanelID = null
  orca.notify("success", "面板已取消停靠显示")
}


/**
 * 获取停靠的面板ID
 */
export function getDockedPanelID() {
  return dockedPanelID
}

/**
 * 检查是否有停靠的面板
 */
export function hasDockedPanel() {
  return dockedPanelID !== null
}

// 折叠同时会锁定面板，放置被跳转
export function toggleCollapsedClass() {
  console.log(`尝试获取停靠id ${getDockedPanelID()}`)
  const isLocked = orca.nav.findViewPanel(getDockedPanelID(), orca.state.panels).locked
  if (isCollapsed === true) {
    removeCollapsedClass()
    console.log(`isCollapsed: ${isCollapsed}`)
    console.log(`isLocked: ${isLocked}`)
    if (isLocked) {
      orca.commands.invokeCommand("core.panel.toggleLock", dockedPanelID)
    }
  } else {
    setCollapsedClass()
    console.log(`isCollapsed: ${isCollapsed}`)
    console.log(`isLocked: ${isLocked}`)
    if (!isLocked) {
      orca.commands.invokeCommand("core.panel.toggleLock", dockedPanelID)
    }
  }
}
function setCollapsedClass() {
  const rootRow = document.querySelector('#main>.orca-panels-row')
  rootRow.classList.add('collapsed-docked-panel')
  isCollapsed = true
}
function removeCollapsedClass() {
  const rootRow = document.querySelector('#main>.orca-panels-row')
  rootRow.classList.remove('collapsed-docked-panel')
  isCollapsed = false
}

/**
 * 添加根容器停靠样式类
 */
function addDockPanelClass() {
  const rootRow = document.querySelector('#main>.orca-panels-row')
  rootRow.classList.add('has-docked-panel')
  console.log(`已为根容器添加停靠样式类`)
}

/**
 * 移除根容器停靠样式类
 */
function removeDockPanelClass() {
  const rootRow = document.querySelector('#main>.orca-panels-row')
  rootRow.classList.remove('has-docked-panel')
  console.log(`已为根容器移除停靠样式类`)
}

/**
 * 监听面板关闭API事件，如果关闭的是停靠面板则移除样式类
 */
function setupPanelCloseWatcher() {
  if (panelCloseWatcher) {
    return // 已经设置过了
  }

  // 监听面板关闭命令 - 使用before命令获取关闭前的状态
  orca.commands.registerBeforeCommand("core.closePanel", (cmdId, ...args) => {
    // 在命令执行前检查当前活动面板是否是停靠的面板
    if (dockedPanelID && orca.state.activePanel === dockedPanelID) {
      console.log(`检测到停靠面板 ${dockedPanelID} 将被关闭，移除停靠样式类`)
      // 面板将被关闭，移除样式类并清空状态
      removeDockPanelClass()
      removeCollapsedClass()
      dockedPanelID = null
    }
    return true // 允许命令继续执行
  })

  // 监听关闭其他面板命令 - 使用before命令获取关闭前的状态
  orca.commands.registerBeforeCommand("core.closeOtherPanels", (cmdId, ...args) => {
    // 如果停靠的面板不是当前活动面板，它将被关闭
    if (dockedPanelID && orca.state.activePanel !== dockedPanelID) {
      console.log(`检测到停靠面板 ${dockedPanelID} 将被关闭（关闭其他面板），移除停靠样式类`)
      // 面板将被关闭，移除样式类并清空状态
      removeDockPanelClass()
      removeCollapsedClass()
      dockedPanelID = null
    }
    return true // 允许命令继续执行
  })

  panelCloseWatcher = true // 标记已设置
  console.log(`${pluginName} 面板关闭监听器已启动`)
}

/**
 * 清理面板关闭监听器
 */
function cleanupPanelCloseWatcher() {
  if (panelCloseWatcher) {
    // 取消注册命令监听器
    orca.commands.unregisterBeforeCommand("core.closePanel")
    orca.commands.unregisterBeforeCommand("core.closeOtherPanels")
    panelCloseWatcher = null
    console.log(`${pluginName} 面板关闭监听器已清理`)
  }
}
