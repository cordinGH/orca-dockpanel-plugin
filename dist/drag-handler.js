/**
 * 拖拽处理模块 (函数式版本)
 * 负责处理面板拖拽的阻止和恢复
 */

// 模块状态
let pluginName = ""
let dragPreventionMap = new Map() // 存储已添加拖拽阻止的面板

/**
 * 初始化模块
 */
export function init(name) {
  pluginName = name
  dragPreventionMap.clear()
}

/**
 * 设置模块
 */
export async function setup() {
  console.log(`${pluginName} 拖拽处理模块已启动 (函数式)`)
}

/**
 * 清理模块
 */
export async function cleanup() {
  // 清理所有拖拽阻止
  for (const [panelId, listeners] of dragPreventionMap) {
    removeDragTargetPrevention(panelId)
  }
  dragPreventionMap.clear()
  console.log(`${pluginName} 拖拽处理模块已清理 (函数式)`)
}

/**
 * 为面板添加拖拽目标阻止功能
 */
export function addDragTargetPrevention(panelId) {
  if (dragPreventionMap.has(panelId)) {
    console.warn(`面板 ${panelId} 已经添加了拖拽阻止功能`)
    return
  }

  const panelElement = document.querySelector(`[data-panel-id="${panelId}"]`)
  if (!panelElement) {
    console.warn(`未找到面板元素: ${panelId}`)
    return
  }

  // 创建事件监听器
  const listeners = {
    dragover: (event) => preventDragTarget(event),
    drop: (event) => preventDragTarget(event),
    dragenter: (event) => preventDragTarget(event)
  }

  // 添加事件监听器
  panelElement.addEventListener('dragover', listeners.dragover, true)
  panelElement.addEventListener('drop', listeners.drop, true)
  panelElement.addEventListener('dragenter', listeners.dragenter, true)

  // 存储监听器引用
  dragPreventionMap.set(panelId, {
    element: panelElement,
    listeners: listeners
  })

  console.log(`已为面板 ${panelId} 添加拖拽阻止功能`)
}

/**
 * 移除面板的拖拽目标阻止功能
 */
export function removeDragTargetPrevention(panelId) {
  const preventionData = dragPreventionMap.get(panelId)
  if (!preventionData) {
    console.warn(`面板 ${panelId} 没有拖拽阻止功能`)
    return
  }

  const { element, listeners } = preventionData

  // 移除事件监听器
  element.removeEventListener('dragover', listeners.dragover, true)
  element.removeEventListener('drop', listeners.drop, true)
  element.removeEventListener('dragenter', listeners.dragenter, true)

  // 从映射中移除
  dragPreventionMap.delete(panelId)

  console.log(`已为面板 ${panelId} 移除拖拽阻止功能`)
}

/**
 * 阻止拖拽目标事件
 */
export function preventDragTarget(event) {
  event.preventDefault()
  event.stopPropagation()
  return false
}

/**
 * 检查面板是否有拖拽阻止功能
 */
export function hasDragPrevention(panelId) {
  return dragPreventionMap.has(panelId)
}

/**
 * 获取所有有拖拽阻止功能的面板ID
 */
export function getPreventedPanelIds() {
  return Array.from(dragPreventionMap.keys())
}
