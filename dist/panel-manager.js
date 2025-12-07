/**
 * 面板管理模块
 * 负责面板的停靠、恢复和状态管理
 */

// 模块状态
let pluginName = ""
let isLockedBeforeCollapsed = false
let dockedPanelCloseWatcher = null
let firstPanelObserver = null
let dockedPanelIdUnSubscribe = null
let lastMainPanelID = ""

let defaultBlockId = ""
let autoDefocusEnabled = false
let autoFocusEnabled = true
let settingsWatcher = null

// DOM 元素缓存
let rootRow = null

// 创建停靠面板状态的 Proxy 包装器（只暴露 id）
// 使用 Valtio 的 proxy 创建响应式对象，以支持订阅
window.dockedPanelState = window.Valtio.proxy({
  id: null
})

// 暴露折叠状态到全局，供其他插件访问
window.dockedPanelIsCollapsed = false


export async function start(name, blockId, enableAutoDefocus) {
  pluginName = name
  window.dockedPanelState.id = null
  window.dockedPanelIsCollapsed = false
  
  // 缓存 DOM 元素
  rootRow = document.querySelector("#main>.orca-panels-row")
  
  // 监听停靠面板关闭事件
  setupDockedPanelCloseWatcher()
  
  // 初始化第一个面板的观察器（监听active类变化）
  firstPanelObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === 'class') {
        const newClass = record.target.getAttribute('class')
        if (newClass.includes('active') && window.dockedPanelIsCollapsed) {
          orca.nav.focusNext()
        }
        return
      }
    }
  })
  
  // 订阅停靠面板ID变化
  setupDockedPanelIDSubscription()

  defaultBlockId = blockId
  autoDefocusEnabled = enableAutoDefocus
  console.log(`[dockpanel] 面板管理模块已启动，自动脱焦：${autoDefocusEnabled}`)
}

/**
 * 清理模块
 */
export async function cleanup() {
  // 清理停靠面板关闭监听器
  cleanupDockedPanelCloseWatcher()
  
  // 清理第一个面板观察器
  if (firstPanelObserver) {
    firstPanelObserver.disconnect()
    firstPanelObserver = null
  }
  
  // 清理停靠面板ID订阅
  if (dockedPanelIdUnSubscribe) {
    dockedPanelIdUnSubscribe()
    dockedPanelIdUnSubscribe = null
  }

  // 如果有停靠的面板，先取消停靠
  if (window.dockedPanelState.id) {
    await undockPanel()
  }
  console.log(`[dockpanel] 面板管理模块已清理`)
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
    // 如果有默认块ID，直接在侧边打开该块，统一采用openInLastPanel API，更为流畅
    if (defaultBlockId && defaultBlockId.trim() !== "") {
      try {
        // 强制加载指定块
        const block = await orca.invokeBackend("get-block", defaultBlockId)
        if (block && !block.deleted) {
          // 直接在侧边打开指定块
          // await orca.nav.openInLastPanel("block", { blockId: defaultBlockId })
          orca.nav.addTo(orca.state.activePanel, "left", {
            view: "block",
            viewArgs: {blockId: defaultBlockId},
            viewState: {}
          })
        } else {
          orca.notify("warn", `块ID ${defaultBlockId} 已被删除，使用默认的今日日志`, pluginName)
          // await orca.nav.openInLastPanel("journal", { date: new Date(new Date().toDateString()) })
          orca.nav.addTo(orca.state.activePanel, "left", {
            view: "journal",
            viewArgs: {date: new Date(new Date().toDateString())},
            viewState: {}
          })
        }
      } catch (error) {
        orca.notify("warn", `块ID ${defaultBlockId} 不存在，使用默认的今日日志`, pluginName)
        // await orca.commands.invokeCommand("core.openTodayInPanel")
        // await orca.nav.openInLastPanel("journal", { date: new Date(new Date().toDateString()) })
        orca.nav.addTo(orca.state.activePanel, "left", {
          view: "journal",
          viewArgs: {date: new Date(new Date().toDateString())},
          viewState: {}
        })
      }
    } else {
      // 没有设置块ID，使用今日日志
      // await orca.commands.invokeCommand("core.openTodayInPanel")
      // await orca.nav.openInLastPanel("journal", { date: new Date(new Date().toDateString()) })
      orca.nav.addTo(orca.state.activePanel, "left", {
        view: "journal",
        viewArgs: {date: new Date(new Date().toDateString())},
        viewState: {}
      })
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
    // 确保先移过去了，再修改window.dockedPanelState.id
    await orca.nav.move(currentPanelId, firstPanel.id, "left")
  }

  // 停靠当前面板
  window.dockedPanelState.id = currentPanelId
  addDockPanelClass()
  removeCollapsedClass()
  // 记录挂起之前的锁定状态，以便恢复
  isLockedBeforeCollapsed = orca.nav.findViewPanel(window.dockedPanelState.id, orca.state.panels).locked === true
  // orca.notify("success", "面板已停靠显示")
}

/**
 * 取消停靠面板
 */
export async function undockPanel() {
  // 移除根容器样式类
  removeDockPanelClass()

  // 比对取消时的锁定状态，如果和原状态不一致，则切换锁定状态变成一致。
  const isLockedNow = orca.nav.findViewPanel(window.dockedPanelState.id, orca.state.panels).locked === true
  if (isLockedNow !== isLockedBeforeCollapsed) {
    orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)
  }
  // 清空停靠ID
  window.dockedPanelState.id = null
  // orca.notify("success", "面板已取消停靠显示")
}


/**
 * 获取停靠的面板ID
 */
export function getDockedPanelID() {
  return window.dockedPanelState.id
}

/**
 * 检查是否有停靠的面板
 */
export function hasDockedPanel() {
  return window.dockedPanelState.id !== null
}

// 折叠同时会锁定面板，防止被跳转
export function toggleCollapsedClass() {
  if (window.dockedPanelIsCollapsed === true) {
    // 新功能1.4.0：记录展开之前的最后一次主面板
    lastMainPanelID = orca.state.activePanel
    // 是折叠状态，则退出折叠，并恢复锁定状态
    removeCollapsedClass()
    if (!isLockedBeforeCollapsed) {
      // console.log("收起之前为未锁定，现已恢复收起之前的锁定状态")
      orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)
    }
    if (autoFocusEnabled) {
      orca.nav.switchFocusTo(window.dockedPanelState.id)
    }
  } else {
    // 没有折叠，则进入折叠状态，并更新锁定状态
    setCollapsedClass()
    isLockedBeforeCollapsed = orca.nav.findViewPanel(window.dockedPanelState.id, orca.state.panels).locked === true
    // console.log("已记录当前锁定状态，用于在下次退出折叠时恢复")
    if (!isLockedBeforeCollapsed) {
      orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)
    }

    // 新功能1.4.0，折叠时自动脱离焦点
    if (autoDefocusEnabled) {
      // 如果当前面板不是停靠面板，不需要nav切出焦点
      if (window.dockedPanelState.id != orca.state.activePanel) {
        return
      }
      if (lastMainPanelID != orca.state.activePanel) {
        orca.nav.switchFocusTo(lastMainPanelID)
      } else {
        orca.nav.focusNext()
      }
    }
  }
}
function setCollapsedClass() {
  if (rootRow) {
    rootRow.classList.add('collapsed-docked-panel')
    window.dockedPanelIsCollapsed = true
  }
}
function removeCollapsedClass() {
  if (rootRow) {
    rootRow.classList.remove('collapsed-docked-panel')
    window.dockedPanelIsCollapsed = false
  }
}

/**
 * 添加根容器停靠样式类
 */
function addDockPanelClass() {
  if (rootRow) {
    rootRow.classList.add('has-docked-panel')
  }
}

/**
 * 移除根容器停靠样式类
 */
function removeDockPanelClass() {
  if (rootRow) {
    rootRow.classList.remove('has-docked-panel')
  }
}


/**
 * 设置停靠面板关闭监听器，用MutationObserver观察 #main>.orca-panels-row 根级子面板的移除事件
 * 主要用于检测停靠面板是否被用户关闭
 */
function setupDockedPanelCloseWatcher() {
  if (dockedPanelCloseWatcher) {
    return
  }
  // 只观察根级子面板的移除（不包含子树变化）
  
  dockedPanelCloseWatcher = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList' && record.removedNodes.length > 0) {
        for (const node of record.removedNodes) {
          if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-panel-id')) {
            const closedPanelId = node.getAttribute('data-panel-id')
             // 发现了停靠面板被关闭，或者只剩下停靠面板，均移除class，并结束本次回调
             if ((closedPanelId === window.dockedPanelState.id) || (orca.state.activePanel === window.dockedPanelState.id && !orca.nav.isThereMoreThanOneViewPanel())) {
               removeDockPanelClass()
               removeCollapsedClass()
               window.dockedPanelState.id = null
               return;
             }
          }
        }
      }
    }
  })
  dockedPanelCloseWatcher.observe(rootRow, { childList: true })
}


/**
 * 清理停靠面板关闭监听器
 */
function cleanupDockedPanelCloseWatcher() {
  if (dockedPanelCloseWatcher) {
    dockedPanelCloseWatcher.disconnect()
    dockedPanelCloseWatcher = null
    console.log(`[dockpanel] 停靠面板关闭监听器已清理`)
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
            console.log(`[dockpanel] 自动脱焦设置已更新: ${autoDefocusEnabled}`)
          }

          // 处理默认块ID设置变更
          const newDefaultBlockId = settings?.defaultBlockId || ""
          if (newDefaultBlockId !== defaultBlockId) {
            defaultBlockId = newDefaultBlockId
            console.log(`[dockpanel] 默认块ID设置已更新: ${defaultBlockId}`)
          }

          // 处理自动聚焦设置变更
          const newAutoFocusEnabled = settings?.enableAutoFocus === true
          if (newAutoFocusEnabled !== autoFocusEnabled) {
            autoFocusEnabled = newAutoFocusEnabled
            console.log(`[dockpanel] 自动聚焦设置已更新: ${autoFocusEnabled}`)
          }
        }
      }
    )
    console.log(`[dockpanel] 设置变更监听器已启动`)
  } else {
    console.warn(`[dockpanel] valtio 不可用，设置变更监听器无法启动`)
  }
}

/**
 * 清理设置变更监听器
 */
function cleanupSettingsWatcher() {
  if (settingsWatcher) {
    settingsWatcher()
    settingsWatcher = null
    console.log(`[dockpanel] 设置变更监听器已清理`)
  }
}

/**
 * 订阅停靠面板ID变化
 * 当停靠面板ID变化时，重新观察新的停靠面板的active类变化
 */
function setupDockedPanelIDSubscription() {
  dockedPanelIdUnSubscribe = window.Valtio.subscribe(window.dockedPanelState, () => {
    if (window.dockedPanelState.id == null) {
      firstPanelObserver.disconnect()
      return
    }      
    // 如果有停靠面板，观察第一个面板元素的class变化
    if (window.dockedPanelState.id) {
      const dockedPanelElement = rootRow.querySelector(":scope > .orca-panel:nth-child(1 of .orca-panel)")
      if (dockedPanelElement) {
        firstPanelObserver.observe(dockedPanelElement, { attributes: true, attributeFilter: ['class'] })
      }
    }
  })
}
