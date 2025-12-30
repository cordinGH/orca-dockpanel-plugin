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
let enableAutoFocus = true
let settingsWatcherUnSubscribe = null

// 根面板
let rootRow = document.querySelector("#main>.orca-panels-row")

// 准备全局对象，方便其他插件使用。Valtio.proxy创建响应式对象，方便其他插件订阅变化。
window.pluginDockpanel = {}
window.pluginDockpanel.panel = window.Valtio.proxy({
  id: null
})
// 暴露折叠状态到全局，供其他插件查看
window.pluginDockpanel.isCollapsed = false

export async function start(name) {

  pluginName = name
  
  const settings = orca.state.plugins[pluginName].settings
  defaultBlockId = settings.pluginDockPanelDefaultBlockId || ""
  enableAutoFocus = settings.enableAutoFocus || false


  setupSettingsWatcher()

  // 监听停靠面板关闭事件
  setupDockedPanelCloseWatcher()
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
  if (window.pluginDockpanel.panel.id) undockPanel()
  console.log(`[dockpanel] 面板管理模块已清理`)
}


// 停靠当前面板
export async function dockCurrentPanel() {
  // 如果当前已存在停靠面板，则取消
  if (window.pluginDockpanel.panel.id) {
    if (window.pluginDockpanel.panel.id === orca.state.activePanel) {
      undockPanel()
      return
    }
    undockPanel()
  }

  // openInLastPanel API在一些全屏视图下有问题，改用addTo API

  // 唯一块直接新建
  if (!orca.nav.isThereMoreThanOneViewPanel()) {
    await createDockedPanel(defaultBlockId)
    return
  }

  const currentPanelId = orca.state.activePanel
  const rootPanelChildPanelNumber = orca.state.panels.children.length
  const firstChildPanel = orca.state.panels.children[0]

  // 当根row的只有一个colChild且col内只有2个普通面板，禁止停靠，因为会破坏结构
  if (rootPanelChildPanelNumber === 1 && firstChildPanel.direction === '"column') {
    const children = firstChildPanel.children
    if (children.length === 2 && children.every(child => child.view)) {
      orca.notify("warn", "当前布局特殊，不支持停靠")
      return
    }
  }

  // 如果当前面板不是第一个面板，则移动到第一个位置
  if (firstChildPanel.id !== currentPanelId) orca.nav.move(currentPanelId, firstChildPanel.id, "left")

  setDockPanel(currentPanelId)
}

/**
 * 取消停靠面板
 */
export function undockPanel() {
  // 比对取消时的锁定状态，如果和原状态不一致，则切换锁定状态变成一致。
  const isLockedNow = orca.nav.findViewPanel(window.pluginDockpanel.panel.id, orca.state.panels).locked === true
  if (isLockedNow !== isLockedBeforeCollapsed) {
    orca.commands.invokeCommand("core.panel.toggleLock", window.pluginDockpanel.panel.id)
  }
  removeDockPanel()
}


// export function gotoHomeOndockedPanel() {
export async function gotoDefaultBlockOnDockedPanel() {
  if (!window.pluginDockpanel.panel.id) {
    await createDockedPanel(defaultBlockId)
    return
  }

  if (window.pluginDockpanel.isCollapsed) toggleDockedPanel()
  
  const target = await getBlockTarget(defaultBlockId)

  orca.nav.goTo(target.view, target.viewArgs, window.pluginDockpanel.panel.id)

}


// 根据块id获取Block跳转目标，至少会返回一个今日日志
async function getBlockTarget(blockId) {
  // 没传直接返回今日日志
  if (!blockId) {
    return {view: 'journal', viewArgs: {date: new Date(new Date().toDateString())}, viewState: {}}
  }

  const block = orca.state.blocks[blockId] || await orca.invokeBackend("get-block", blockId)
  if (!block) {
    return {view: 'journal', viewArgs: {date: new Date(new Date().toDateString())}, viewState: {}}
  }

  const blockRepr = block.properties.find(p => p.name === '_repr')
  const blockType = blockRepr.value.type
  // 如果是日志块id，则转为日志视图的target
  const target = {
    view: blockType === 'journal'? 'journal' : 'block',
    viewArgs: blockType === 'journal'? {date: blockRepr.value.date} : {blockId: blockId},
    viewState: {}
  }

  return target
}


// 创建新的停靠面板，默认值为设置选项中的blockId
async function createDockedPanel(blockId) {
  if (window.pluginDockpanel.panel.id) {
    console.notify("info", "[dockpanel] 只允许存在一个停靠面板，请先取消")
    return
  }

  // 新面板target
  let target = await getBlockTarget(blockId)

  const firstPanelId = orca.state.panels.children[0].id
  const panelId = orca.nav.addTo(firstPanelId, "left", target)
  setDockPanel(panelId)
}



// 切出停靠面板，没有就新建一个
export async function toggleDockedPanel() {
  if (!window.pluginDockpanel.panel.id) {
    await createDockedPanel(defaultBlockId)
    return
  }

  if (window.pluginDockpanel.isCollapsed) {
    removeCollapsed()

    // 折叠面板时会自动lock，如果在折叠之前不是锁着的就释放锁定状态
    if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", window.pluginDockpanel.panel.id)

    // 自动聚焦
    if (enableAutoFocus) orca.nav.switchFocusTo(window.pluginDockpanel.panel.id)

  } else {
    setCollapsed()

    // 折叠后应当锁定面板。记录折叠前的锁定状态用于在下次展开时决定是否需要取消锁定。
    isLockedBeforeCollapsed = orca.nav.findViewPanel(window.pluginDockpanel.panel.id, orca.state.panels).locked
    if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", window.pluginDockpanel.panel.id)
  
    // 折叠自动脱离焦点
    if (window.pluginDockpanel.panel.id === orca.state.activePanel) orca.nav.focusNext()
  }
}

// 设置折叠样式
function setCollapsed() {
  if (rootRow) {
    rootRow.classList.add('collapsed-docked-panel')
    window.pluginDockpanel.isCollapsed = true
  }
}

// 移除折叠样式
function removeCollapsed() {
  if (rootRow) {
    rootRow.classList.remove('collapsed-docked-panel')
    window.pluginDockpanel.isCollapsed = false
  }
}


// 设置停靠样式
function setDockPanel(panelId) {
  if (rootRow) {
    rootRow.classList.add('has-docked-panel')
    window.pluginDockpanel.panel.id = panelId
  }
}

// 移除停靠样式
function removeDockPanel() {
  if (rootRow) {
    rootRow.classList.remove('has-docked-panel')
    removeCollapsed()
    window.pluginDockpanel.panel.id = null
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
    const currentDockedId = window.pluginDockpanel.panel.id;
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
function setupSettingsWatcher() {
  if (settingsWatcherUnSubscribe) return

  // 使用 valtio 订阅设置变更
  if (window.Valtio && window.Valtio.subscribe) {
    settingsWatcherUnSubscribe = window.Valtio.subscribe(
      orca.state.plugins[pluginName],
      () => {
        const settings = orca.state.plugins[pluginName]?.settings;
        if (settings) {
          // 处理默认块ID设置变更
          const newDefaultBlockId = settings?.pluginDockPanelDefaultBlockId || ""
          if (newDefaultBlockId !== defaultBlockId) {
            defaultBlockId = newDefaultBlockId
            console.log(`[dockpanel] 默认块ID设置已更新: ${defaultBlockId}`)
          }

          // 处理自动聚焦设置变更
          const newAutoFocus = settings?.enableAutoFocus
          if (newAutoFocus !== enableAutoFocus) {
            enableAutoFocus = newAutoFocus
            console.log(`[dockpanel] 自动聚焦设置已更新: ${enableAutoFocus}`)
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


// 新功能，右键菜单直接打开停靠面板  2025年12月13日
export async function openInDockedpanel(blockId) {

  const target = await getBlockTarget(blockId)

  if (!target) orca.notify("info", "[dockpanel] 目标块不存在")

  const dpid = window.pluginDockpanel.panel.id
  if (dpid) {
    // 如果存在停靠面板，先确保展开，然后goTo
    if (window.pluginDockpanel.isCollapsed) toggleDockedPanel()
    orca.nav.goTo(target.view, target.viewArgs, dpid)
    return
  }

  // 不存在就起一个
  orca.nav.addTo(orca.state.activePanel, "left", target)

  dockCurrentPanel()
}