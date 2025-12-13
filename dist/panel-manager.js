/**
 * 面板管理模块
 * 负责面板的停靠、恢复和状态管理
 */

// 模块状态
let pluginName = ""
let isLockedBeforeCollapsed = false
let dockedPanelCloseWatcher = null
let dockedPanelIdUnSubscribe = null

let defaultBlockId = ""
let autoDefocusEnabled = false
let autoFocusEnabled = true
let settingsWatcherUnSubscribe = null

// 根面板
let rootRow = document.querySelector("#main>.orca-panels-row")

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
  
  // 监听停靠面板关闭事件
  setupDockedPanelCloseWatcher()

  defaultBlockId = blockId
  autoDefocusEnabled = enableAutoDefocus
  console.log(`[dockpanel] 面板管理模块已启动，自动脱焦：${autoDefocusEnabled}`)
}

/**
 * 清理模块
 */
export function cleanup() {
  // 清理停靠面板关闭监听器
  cleanupDockedPanelCloseWatcher()
  
  cleanupSettingsWatcher()
  // 清理停靠面板ID订阅
  if (dockedPanelIdUnSubscribe) {
    dockedPanelIdUnSubscribe()
    dockedPanelIdUnSubscribe = null
  }

  // 如果有停靠的面板，先取消停靠
  if (window.dockedPanelState.id) undockPanel()
  console.log(`[dockpanel] 面板管理模块已清理`)
}

/**
 * 停靠当前面板
 */
export async function dockCurrentPanel() {
  // 如果当前已存在停靠面板，则取消
  if (window.dockedPanelState.id) {
    if (window.dockedPanelState.id === orca.state.activePanel) {
      undockPanel()
      return
    }
    undockPanel()
  }

  // 如果只有一个面板，先在侧边打开新面板
  if (!orca.nav.isThereMoreThanOneViewPanel()) {
    // openInLastPanel API在一些全屏视图下有问题，改用addTo API

    if (!defaultBlockId){
      // 没设置块ID，使用今日日志
      orca.nav.addTo(orca.state.activePanel, "left", {
        view: "journal",
        viewArgs: {date: new Date(new Date().toDateString())},
        viewState: {}
      })
    } else {

      const block = await orca.invokeBackend("get-block", defaultBlockId)
      // 填写了默认块id，但是没找到，也使用今日日志
      if (!block) {
        orca.notify("warn", `块ID ${defaultBlockId} 已被删除，使用默认的今日日志`, pluginName)
        orca.nav.addTo(orca.state.activePanel, "left", {
          view: "journal",
          viewArgs: {date: new Date(new Date().toDateString())},
          viewState: {}
        })
      } else {
        orca.nav.addTo(orca.state.activePanel, "left", {
          view: "block",
          viewArgs: {blockId: defaultBlockId},
          viewState: {}
        })
      }
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
  if (firstPanel.id !== currentPanelId) await orca.nav.move(currentPanelId, firstPanel.id, "left")

  // 停靠当前面板
  setDockPanel(currentPanelId)
}

/**
 * 取消停靠面板
 */
export function undockPanel() {
  // 比对取消时的锁定状态，如果和原状态不一致，则切换锁定状态变成一致。
  const isLockedNow = orca.nav.findViewPanel(window.dockedPanelState.id, orca.state.panels).locked === true
  if (isLockedNow !== isLockedBeforeCollapsed) {
    orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)
  }
  removeDockPanel()
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
  if (window.dockedPanelIsCollapsed) {
    // 是折叠状态，则退出折叠，并恢复锁定状态
    removeCollapsed()
    if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)

    if (autoFocusEnabled) orca.nav.switchFocusTo(window.dockedPanelState.id)

  } else {
    // 没有折叠，则进入折叠状态
    setCollapsed()
    // 折叠后应当锁定面板。记录折叠前的锁定状态，用于在下次展开时取消锁定。
    isLockedBeforeCollapsed = orca.nav.findViewPanel(window.dockedPanelState.id, orca.state.panels).locked === true
    if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", window.dockedPanelState.id)
  
    // 折叠自动脱离焦点
    if (autoDefocusEnabled) {
      if (window.dockedPanelState.id != orca.state.activePanel) return
      orca.nav.focusNext()
    }
  }
}


function setCollapsed() {
  if (rootRow) {
    rootRow.classList.add('collapsed-docked-panel')
    window.dockedPanelIsCollapsed = true
  }
}
function removeCollapsed() {
  if (rootRow) {
    rootRow.classList.remove('collapsed-docked-panel')
    window.dockedPanelIsCollapsed = false
  }
}

/**
 * 添加根容器停靠样式类
 */
function setDockPanel(panelId) {
  if (rootRow) {
    rootRow.classList.add('has-docked-panel')
    window.dockedPanelState.id = panelId
  }
}

/**
 * 移除根容器停靠样式类
 */
function removeDockPanel() {
  if (rootRow) {
    rootRow.classList.remove('has-docked-panel')
    removeCollapsed()
    window.dockedPanelState.id = null
  }
}


/**
 * 检测停靠面板是否被关闭。停靠面板固定为根面板下的第一个子面板，观察根面板直接子元素的移除行为。
 */
function setupDockedPanelCloseWatcher() {
  if (dockedPanelCloseWatcher) {
    return
  }
  // 只观察根级子面板的移除
  dockedPanelCloseWatcher = new MutationObserver((records) => {
    const currentDockedId = window.dockedPanelState.id;
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue; 
        const removedPanelId = node.getAttribute('data-panel-id');
        if (!removedPanelId) continue;
        // 停靠面板被关闭，或者只剩下停靠面板，均移除class，并结束处理
        const isDockedPanelRemoved = (removedPanelId === currentDockedId);
        const isDockedPanelOrphaned = (orca.state.activePanel === currentDockedId && !orca.nav.isThereMoreThanOneViewPanel());
        if (isDockedPanelRemoved || isDockedPanelOrphaned) {
          removeDockPanel();
          return; 
        }
      }
    }
  });
  dockedPanelCloseWatcher.observe(rootRow, { childList: true })
}

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
  if (settingsWatcherUnSubscribe) return

  // 使用 valtio 订阅设置变更
  if (window.Valtio && window.Valtio.subscribe) {
    settingsWatcherUnSubscribe = window.Valtio.subscribe(
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
  if (settingsWatcherUnSubscribe) {
    settingsWatcherUnSubscribe()
    settingsWatcherUnSubscribe = null
    console.log(`[dockpanel] 设置变更监听器已清理`)
  }
}
