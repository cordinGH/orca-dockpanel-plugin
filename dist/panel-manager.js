/**
 * 面板管理模块
 * 负责面板的停靠、恢复和状态管理
 */

// 模块基本参数
let pluginName = ""
let defaultBlockId = ""
let enableAutoFocus = true
let enableAutoCollapse = false
let settingsWatcherUnSubscribe = null
let rootRow = null // orca.state.panels 对应的 DOM 元素
let dockedPanelCloseWatcher = null
let dockedPanelIdUnSubscribe = null

let disposeAutoCollapse = null


// 停靠面板状态变量
let isLockedBeforeCollapsed = false
window.pluginDockpanel = {}
window.pluginDockpanel.panel = window.Valtio.proxy({
  id: null
})
window.pluginDockpanel.isCollapsed = false

// 标记当前是否正在交换停靠面板, 防止observer误触发
let isSwappingDockedPanel = false

export async function start(name) {

  pluginName = name
  rootRow =  document.querySelector("#main>.orca-panels-row")
  
  const settings = orca.state.plugins[pluginName].settings
  defaultBlockId = settings.pluginDockPanelDefaultBlockId
  enableAutoFocus = settings.enableAutoFocus
  enableAutoCollapse = settings.enableAutoCollapse


  setupSettingsWatcher()

  // 监听停靠面板关闭事件
  setupDockedPanelCloseWatcher()

  if (enableAutoCollapse) disposeAutoCollapse = initAutoCollapseMonitor()
}

/**
 * 清理模块
 */
export function cleanup() {

  if (disposeAutoCollapse) {
    disposeAutoCollapse()
    disposeAutoCollapse = null
  }
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

  

  rootRow = null
}


// 停靠当前面板
export async function dockPanel(panelId) {

  const oldDockedPanelId = window.pluginDockpanel.panel.id

  if (panelId === oldDockedPanelId) {
    orca.notify("info", "[dockpanel] 该面板已是停靠面板")
    return
  }

  // 【case1】已存在停靠面板，则交换位置
  if (oldDockedPanelId) {
    isSwappingDockedPanel = true
    const newDockedPanel = orca.nav.findViewPanel(panelId, orca.state.panels)

    // 【锁定变更】 如果old是折叠状态，则还原锁定。并将锁定标识更新为new，并脱焦（dockpanel是点击触发）
    const isCollapsed = window.pluginDockpanel.isCollapsed
    if (isCollapsed && !isLockedBeforeCollapsed) {
      orca.commands.invokeCommand("core.panel.toggleLock", oldDockedPanelId)
      isLockedBeforeCollapsed = newDockedPanel.locked === true
      if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", panelId)
      if (orca.state.activePanel === panelId) orca.nav.focusNext()
    }

    // 【停靠变更】旧的移到新的右边，新的移到最后
    orca.nav.move(oldDockedPanelId, panelId, "right")
    const rootPanelChildren = orca.state.panels.children
    const lastChildPanelId = rootPanelChildren[rootPanelChildren.length - 1].id
    orca.nav.move(panelId, lastChildPanelId, "right")
    window.pluginDockpanel.panel.id = panelId
    
    // 确保observer不触发
    setTimeout(() => isSwappingDockedPanel = false, 0)
    return
  }

  // 【case2】唯一面板，则以默认块新建一个面板留在原地，然后停靠target面板
  if (!orca.nav.isThereMoreThanOneViewPanel()) {
    // 先挂起再添加，避免抖动
    setDockPanel(panelId)
    let target = await getBlockTarget(defaultBlockId)
    orca.nav.addTo(panelId, "left", target)
    return
  }


  const rootPanelChildPanelNumber = orca.state.panels.children.length
  const rootPanelChildren = orca.state.panels.children
  const lastChildPanel = rootPanelChildren[rootPanelChildPanelNumber - 1]
  // 【case3】当根row的只有一个colChild且col内只有2个普通面板，禁止停靠，因为会破坏结构
  if (rootPanelChildPanelNumber === 1 && lastChildPanel.direction === '"column') {
    const children = lastChildPanel.children
    if (children.length === 2 && children.every(child => child.view)) {
      orca.notify("warn", "当前布局特殊，不支持停靠")
      return
    }
  }

  // 【case4】正常情况，直接把面板移到最后位置
  if (lastChildPanel.id !== panelId) {
    isSwappingDockedPanel = true
    orca.nav.move(panelId, lastChildPanel.id, "right")
    setTimeout(() => isSwappingDockedPanel = false, 0)
  }
  setDockPanel(panelId)
}


// 清理停靠
export function undockPanel() {

  const dockedPanelId = window.pluginDockpanel.panel.id
  if (!dockedPanelId) {
    orca.notify("info", "[dockpanel] 当前没有面板被挂起")
    return
  }
  
  const panel = orca.nav.findViewPanel(dockedPanelId, orca.state.panels)
  if (!panel) {
    removeDockPanel()
    return
  }
  // 比对取消时的锁定状态，如果和原状态不一致，则切换锁定状态变成一致。
  const isLockedNow = panel.locked === true
  if (isLockedNow !== isLockedBeforeCollapsed) {
    orca.commands.invokeCommand("core.panel.toggleLock", window.pluginDockpanel.panel.id)
  }
  
  removeDockPanel()
}


// 在停靠面板前往默认块
export async function gotoDefaultBlockOnDockedPanel() {
  if (!window.pluginDockpanel.panel.id) {
    await createDockedPanel(defaultBlockId)
    return
  }

  if (window.pluginDockpanel.isCollapsed) toggleDockedPanel()
  
  const target = await getBlockTarget(defaultBlockId)

  orca.nav.goTo(target.view, target.viewArgs, window.pluginDockpanel.panel.id)
}

// 在当前面板前往默认块
export async function gotoDefaultBlockOnCurrentPanel() {
  const target = await getBlockTarget(defaultBlockId)
  orca.nav.goTo(target.view, target.viewArgs, orca.state.activePanel)
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
    viewArgs: blockType === 'journal'? {date: blockRepr.value.date} : {blockId: Number(blockId)},
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
  const rootPanelChildren = orca.state.panels.children
  const lastPanelId = rootPanelChildren[rootPanelChildren.length - 1].id
  const panelId = orca.nav.addTo(lastPanelId, "right", target)
  setDockPanel(panelId)
}


// 切出停靠面板
export async function toggleDockedPanel() {

  // 【case1】 当前无停靠面板则新建一个
  if (!window.pluginDockpanel.panel.id) {
    await createDockedPanel(defaultBlockId)
    return
  }

  // 【case2】 有停靠面板则切换折叠状态
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
    window.pluginDockpanel.panel.id = null
    removeCollapsed()  
    isLockedBeforeCollapsed = false
    isSwappingDockedPanel = false
  }
}


/**
 * 检测停靠面板是否被关闭。停靠面板固定为根面板下的第一个子面板，观察根面板直接子元素的移除行为。
 */
function setupDockedPanelCloseWatcher() {

  // 只观察根级子面板的移除
  dockedPanelCloseWatcher = new MutationObserver((records) => {

    if (isSwappingDockedPanel) return; // 正在交换停靠面板时不处理

    const currentDockedId = window.pluginDockpanel.panel.id;
    if (!currentDockedId) return; // 当前无停靠面板时不处理

    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue; 
        const removedPanelId = node.getAttribute('data-panel-id');
        if (!removedPanelId) continue;
        // 停靠面板被关闭，或者只剩下停靠面板
        if (removedPanelId === currentDockedId) {
          removeDockPanel()
        } else if (!orca.nav.isThereMoreThanOneViewPanel()) {
          undockPanel()
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
          const newDefaultBlockId = settings.pluginDockPanelDefaultBlockId || ""
          if (newDefaultBlockId !== defaultBlockId) {
            defaultBlockId = newDefaultBlockId
            console.log(`[dockpanel] 默认块ID设置已更新: ${defaultBlockId}`)
          }

          // 处理自动聚焦设置变更
          const newAutoFocus = settings.enableAutoFocus
          if (newAutoFocus !== enableAutoFocus) {
            enableAutoFocus = newAutoFocus
            console.log(`[dockpanel] 自动聚焦设置已更新: ${enableAutoFocus}`)
          }

          // 处理停靠时的按钮发光效果
          settings.enableTextShadow ? document.body.classList.add("dockpanel-has-text-shadow"):document.body.classList.remove("dockpanel-has-text-shadow")

          // 自动隐藏
          const newAutoCollapse = settings.enableAutoCollapse
          if (newAutoCollapse) {
            disposeAutoCollapse = initAutoCollapseMonitor()
          } else {
            if (disposeAutoCollapse) {
              disposeAutoCollapse()
              disposeAutoCollapse = null
            }
          }
        }
      }
    )
    console.log(`[dockpanel] ✅ 开始监听dockpanel设置变更`)
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

  // 不存在就新起一个
  createDockedPanel(defaultBlockId)
}



// ************************************  issue 5 自动折叠****************************************************
function initAutoCollapseMonitor() {
  
  // 保存根面板的直接child
  let observerMap = new Map()
  
  const evaluateAutoCollapse = (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return
      // case1 已经折叠不做处理
      if (window.pluginDockpanel.isCollapsed) return

      const target = mutation.target;
      const isDockedPanel = target.dataset.panelId === window.pluginDockpanel.panel.id
      const dockedPanelNotActive = isDockedPanel && !target.classList.contains('active')

      // case2 没折叠但是活跃中，不处理
      if (!dockedPanelNotActive) return

      const {body} = document
      const isPreview = body.classList.contains("orca-popup-pointer-logic")
      const isSearchModal = body.querySelectorAll(':scope > .orca-modal-overlay > .orca-search-modal').length !== 0

      // case3 没折叠，也不活跃，但是当前正在预览视图/全局搜索视图，不处理
      if (isPreview || isSearchModal) return

      setCollapsed()
      // 折叠后应当锁定面板。记录折叠前的锁定状态用于在下次展开时决定是否需要取消锁定。
      isLockedBeforeCollapsed = orca.nav.findViewPanel(window.pluginDockpanel.panel.id, orca.state.panels).locked
      if (!isLockedBeforeCollapsed) orca.commands.invokeCommand("core.panel.toggleLock", window.pluginDockpanel.panel.id)
    }
  };

  const handleDirectChild = (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') return

      // A. 为新的直接子面板绑定observer
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return
        observePanel(node)
      });

      // B. 为移除的直接子面板断连Observer并清理相关对象
      mutation.removedNodes.forEach(node => {
        if (node.nodeType !== 1) return
        const observer = observerMap.get(node);

        if (!observer) return
        observer.disconnect();
        observerMap.delete(node);
      });
    }
  }
    
  const observePanel = (element) => {
    if (observerMap.has(element)) return

    const observer = new MutationObserver(evaluateAutoCollapse);
    observer.observe(element, { attributes: true, attributeFilter: ['class'], subtree: false})
    
    observerMap.set(element, observer);
  }
  
  let rootRowObserver = new MutationObserver(handleDirectChild);

  rootRowObserver.observe(rootRow, { childList: true, subtree: false })

  // 为初始面板建立观察
  Array.from(rootRow.children).forEach(node => {if (node.nodeType === 1) observePanel(node)});

  // 销毁函数
  const dispose = () => {
    for (const observer of observerMap.values()) {
      observer.disconnect()
    }
    observerMap.clear()
    observerMap = null
    rootRowObserver.disconnect()
    rootRowObserver = null
  }
  return dispose
}