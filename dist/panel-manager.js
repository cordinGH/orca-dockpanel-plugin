/**
 * 面板管理模块
 * 负责面板的停靠、恢复和状态管理
 */

// 模块状态
let pluginName = ""
let dockedPanelID = null
let isLockedBeforeCollapsed = false
let panelCloseWatcher = null
let isCollapsed = false
let lastMainPanelID = ""

let defaultBlockId = ""
let autoDefocusEnabled = false
let settingsWatcher = null

/**
 * 启动模块
 */

export async function start(name, blockId, enableAutoDefocus) {
  pluginName = name
  dockedPanelID = null
  isCollapsed = false
  // 监听面板关闭事件
  setupPanelCloseWatcher()
  
  defaultBlockId = blockId
  autoDefocusEnabled = enableAutoDefocus

  console.log(`${pluginName} 面板管理模块已启动，自动脱焦：${autoDefocusEnabled}`)
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
  // 新功能 v1.4.0 生成新停靠时，记录最后一次所在的主面板
  lastMainPanelID = orca.state.activePanel
  // 如果只有一个面板，先在侧边打开今天的日志
  if (!orca.nav.isThereMoreThanOneViewPanel()) {
    // await orca.commands.invokeCommand("core.openTodayInPanel")
    // await orca.commands.invokeEditorCommand("core.editor.openOnTheSide", null, "544")
    console.log(`面板管理器的defaultBlockId：${defaultBlockId}`)
    
    // 如果有默认块ID，直接在侧边打开该块，统一采用openInLastPanel API，更为流畅
    if (defaultBlockId && defaultBlockId.trim() !== "") {  
      try {
        // 强制加载指定块
        const block = await orca.invokeBackend("get-block", defaultBlockId)
        if (block && !block.deleted) {
          // 直接在侧边打开指定块
          await orca.nav.openInLastPanel("block", { blockId: defaultBlockId })
        } else {
          orca.notify("warn", `块ID ${defaultBlockId} 已被删除，使用默认的今日日志`, pluginName)
          await orca.commands.invokeCommand("core.openTodayInPanel")
        }
      } catch (error) {
        orca.notify("warn", `块ID ${defaultBlockId} 不存在，使用默认的今日日志`, pluginName)
        // await orca.commands.invokeCommand("core.openTodayInPanel")
        await orca.nav.openInLastPanel("journal", { date: new Date() })
      }
    } else {
      // 没有设置块ID，使用今日日志
      // await orca.commands.invokeCommand("core.openTodayInPanel")
      await orca.nav.openInLastPanel("journal", { date: new Date() })
    }
    
  }

  const currentPanelId = orca.state.activePanel
  const firstPanel = orca.state.panels.children[0]
  const numberOfLevel1Panel = orca.state.panels.children.length

  // 当根row的只有一个colChild且col内只有2个普通面板，禁止停靠，因为会破坏结构
  if (numberOfLevel1Panel === 1 && firstPanel.children && firstPanel.children.length === 2 && firstPanel.children.every(child => child.view)) {
    orca.notify("warn", "当前布局特殊，不支持停靠")
    return
  }
  
  // 如果当前面板不是第一个面板，则移动到第一个位置
  if (firstPanel.id !== currentPanelId) {
    orca.nav.move(currentPanelId, firstPanel.id, "left")
  }
  
  // 停靠当前面板
  dockedPanelID = currentPanelId
  addDockPanelClass()
  removeCollapsedClass()
  // 记录挂起之前的锁定状态，以便恢复
  isLockedBeforeCollapsed = orca.nav.findViewPanel(dockedPanelID, orca.state.panels).locked === true
  
  // orca.notify("success", "面板已停靠显示")
}

/**
 * 取消停靠面板
 */
export async function undockPanel() {
  // 移除根容器样式类
  removeDockPanelClass()
  
  // 比对取消时的锁定状态，如果和原状态不一致，则切换锁定状态变成一致。
  const isLockedNow = orca.nav.findViewPanel(dockedPanelID, orca.state.panels).locked === true
  if (isLockedNow !== isLockedBeforeCollapsed) {
    orca.commands.invokeCommand("core.panel.toggleLock", dockedPanelID)
  }
  // 清空停靠ID
  dockedPanelID = null
  // orca.notify("success", "面板已取消停靠显示")
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

// 折叠同时会锁定面板，防止被跳转
export function toggleCollapsedClass() {
  if (isCollapsed === true) {
    // 新功能1.4.0：记录展开之前的最后一次主面板
    lastMainPanelID = orca.state.activePanel
    // 是折叠状态，则退出折叠，并恢复锁定状态
    removeCollapsedClass()
    if (!isLockedBeforeCollapsed) {
      console.log("收起之前为未锁定，现已恢复收起之前的锁定状态")
      orca.commands.invokeCommand("core.panel.toggleLock", dockedPanelID)
    }
  } else {
    // 没有折叠，则进入折叠状态，并更新锁定状态
    setCollapsedClass()
    isLockedBeforeCollapsed = orca.nav.findViewPanel(dockedPanelID, orca.state.panels).locked === true
    console.log("已记录当前锁定状态，用于在下次退出折叠时恢复")
    if (!isLockedBeforeCollapsed) {
      orca.commands.invokeCommand("core.panel.toggleLock", dockedPanelID)
    }

    // 新功能1.4.0，折叠时自动脱离焦点
    if (autoDefocusEnabled) {
      if (dockedPanelID != orca.state.activePanel) {
        console.log("当前面板不是停靠面板，不需要nav切出焦点")
        return
      } else {
        if (lastMainPanelID != orca.state.activePanel) {
          orca.nav.switchFocusTo(lastMainPanelID)
          console.log("当前面板是停靠面板，nav切出焦点")
        } else {
          orca.nav.focusNext()
        }
      }
    } else {
      console.log("自动脱焦功能已禁用")
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

  // 监听面板关闭命令 - 使用before命令获取关闭前的状态。
  orca.commands.registerBeforeCommand("core.closePanel", (cmdId, ...args) => {
    // 在命令执行前检查当前活动面板是否是停靠的面板
    if (dockedPanelID && orca.state.activePanel === dockedPanelID) {
      console.log(`检测到停靠面板 ${dockedPanelID} 将被关闭，移除停靠样式类`)
      // 面板将被关闭，移除样式类并清空状态
      removeDockPanelClass()
      removeCollapsedClass()
      dockedPanelID = null
    }
    return true 
  })

  // 执行关闭后，如果只剩下停靠面板，取消停靠
  orca.commands.registerAfterCommand("core.closePanel", (cmdId, ...args) => {
    if (dockedPanelID && orca.state.activePanel === dockedPanelID && !orca.nav.isThereMoreThanOneViewPanel()) {
      removeDockPanelClass()
      removeCollapsedClass()
      dockedPanelID = null
      orca.notify("info", "取消停靠，因为当前只剩下停靠面板")
      return
    }

    // 新功能v1.4.0：如果关闭面板后，nav到了折叠的停靠面板，
    if (autoDefocusEnabled && orca.state.activePanel ===  dockedPanelID && isCollapsed){
      orca.nav.focusNext()
      console.log("当前焦点到了折叠的停靠面板，自动执行next面板")
      return
    }
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
    orca.commands.unregisterAfterCommand("core.closePanel")
    panelCloseWatcher = null
    console.log(`${pluginName} 面板关闭监听器已清理`)
  }
}

/**
 * 设置设置变更监听器
 */
export function setupSettingsWatcher() {
  if (settingsWatcher) {
    return // 已经设置过了
  }

  // 使用 valtio 订阅设置变更
  if (window.Valtio && window.Valtio.subscribe) {
    settingsWatcher = window.Valtio.subscribe(
      orca.state.plugins[pluginName], 
      () => {
        const settings = orca.state.plugins[pluginName]?.settings;
        if (settings) {
          // 处理自动脱焦设置变更
          const newAutoDefocusEnabled = settings?.enableAutoDefocus === true
          if (newAutoDefocusEnabled !== autoDefocusEnabled) {
            autoDefocusEnabled = newAutoDefocusEnabled
            console.log(`${pluginName} 自动脱焦设置已更新: ${autoDefocusEnabled}`)
          }
          
          // 处理默认块ID设置变更
          const newDefaultBlockId = settings?.defaultBlockId || ""
          if (newDefaultBlockId !== defaultBlockId) {
            defaultBlockId = newDefaultBlockId
            console.log(`${pluginName} 默认块ID设置已更新: ${defaultBlockId}`)
          }
        }
      }
    )
    console.log(`${pluginName} 设置变更监听器已启动`)
  } else {
    console.warn(`${pluginName} valtio 不可用，设置变更监听器无法启动`)
  }
}

/**
 * 清理设置变更监听器
 */
function cleanupSettingsWatcher() {
  if (settingsWatcher) {
    settingsWatcher()
    settingsWatcher = null
    console.log(`${pluginName} 设置变更监听器已清理`)
  }
}
