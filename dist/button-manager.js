let rootPanel = null

// 按钮的位置信息
let btnInfo = null
let panelManager = null

// 悬停提示框
let tooltipEl = null
// 标记当前tooltip所显示的面板，用于事件回调的早返回。
let tooltipPanel = null
// 悬停意图计时器句柄：停留够久才显示，快速划过会被取消，避免闪烁。
let showTimer = 0


export function start(pm) {

    panelManager = pm
    // 设置右上角dockpanel按钮的左右键监听
    rootPanel = document.querySelector("#main>.orca-panels-row")
    setBtnInfo()
    // rootPanel.addEventListener('pointerdown', dockBtnHandler)
    rootPanel.addEventListener('click', dockBtnHandler)
    rootPanel.addEventListener('auxclick', dockBtnHandler)

    // 注入悬停提示框
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'orca-tooltip dockpanel-tooltip'
    document.body.appendChild(tooltipEl)
    rootPanel.addEventListener('pointermove', dockBtnMoveHandler, { passive: true })

    // 隐藏提示框（边界情况）：pointer处于边界脱离rootpanel时，不会被读取到pointermove（从而不触发清理），需要leave兜底
    rootPanel.addEventListener('pointerleave', hideTooltip)
}

export function cleanup() {
    // rootPanel.removeEventListener('pointerdown', dockBtnHandler)
    rootPanel.removeEventListener('click', dockBtnHandler)
    rootPanel.removeEventListener('auxclick', dockBtnHandler)
    rootPanel.removeEventListener('pointermove', dockBtnMoveHandler)
    rootPanel.removeEventListener('pointerleave', hideTooltip)
    
    clearTimeout(showTimer)
    tooltipEl?.remove()
    tooltipEl = null
    tooltipPanel = null
    btnInfo = null
    rootPanel = null
    panelManager = null
}


// 获取按钮的位置信息
function setBtnInfo() {
    // 获取根元素字体大小
    const root = document.documentElement;
    const rootComputedStyle = getComputedStyle(root);
    const rootFontSize = parseFloat(rootComputedStyle.fontSize)

    // 将orca自定义长度变量（rem）转为px
    const getOrcaCustomLen = (propNameString) => {
        return parseFloat(rootComputedStyle.getPropertyValue(propNameString).trim()) * rootFontSize
    }

    const orcaSpacingMd = getOrcaCustomLen("--orca-spacing-md")
    const orcaSpacingSm = getOrcaCustomLen("--orca-spacing-sm")
    const orcaFontsizeLg = getOrcaCustomLen("--orca-fontsize-lg")
    const orcaSpacing2xs = getOrcaCustomLen("--orca-spacing-2xs")

    btnInfo = {
        bthPositionRight: orcaSpacingMd + orcaSpacingSm,
        bthPositionTop: 0.5 * rootFontSize,
        btnWidth: orcaFontsizeLg + 2 * orcaSpacing2xs,
        btnHeight: orcaFontsizeLg + 2 * orcaSpacingSm
    }
}


// 判断指针是否落在面板右上角按钮区域内（rect 由调用方传入，避免重复测量布局）
function isPointerInBtn(e, rect) {
    const { bthPositionRight, bthPositionTop, btnWidth, btnHeight } = btnInfo
    const btnXStart = rect.width - bthPositionRight - btnWidth
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return x >= btnXStart && x <= btnXStart + btnWidth
        && y >= bthPositionTop && y <= bthPositionTop + btnHeight
}


// 处理停靠面板按钮点击事件
function dockBtnHandler(e) {
    const target = e.target
    // 如果点击的不是面板，不处理
    if (!target?.classList.contains("orca-panel")) return

    const rect = target.getBoundingClientRect()
    // 不在按钮区域
    if (!isPointerInBtn(e, rect)) return

    e.stopPropagation()

    // 左键切出/隐藏，右键停靠当前面板，alt + 右键取消停靠。
    const eButton = e.button
    const dpid = target.dataset.panelId
    switch (eButton) {
        case 0: panelManager.toggleDockedPanel(); break;
        case 2: window.event?.altKey? panelManager.undockPanel() : panelManager.dockPanel(dpid); break;
    }
}


// 隐藏提示框
function hideTooltip() {
    // tooltips未在任何面板显示则不处理。
    if (!tooltipPanel) return
    tooltipPanel = null
    clearTimeout(showTimer)   // 取消尚未触发的显示，划过时不会闪
    tooltipEl.classList.remove('visible')
}

// 处理指针移动，按钮区域内显示提示框
function dockBtnMoveHandler(e) {
    const target = e.target
    // 不在面板表面则早退，全屏块也不影响，zindex给的很足。
    if (!target?.classList.contains("orca-panel")) { hideTooltip(); return }

    const rect = target.getBoundingClientRect()
    if (!isPointerInBtn(e, rect)) { hideTooltip(); return }

    // 所处面板未改变则，则无需处理tooltip。
    if (tooltipPanel === target) return;

    // 标记当前tooltip显示面板
    tooltipPanel = target

    // 仅在刚进入按钮区域时执行一次：定位并显示
    const { bthPositionRight, bthPositionTop, btnHeight, btnWidth} = btnInfo
    tooltipEl.textContent = "    左键 　切出/隐藏\n    右键 　停靠当前\nAlt 右键　取消停靠"
    
    // fixed 定位（相对视口），置于按钮左侧
    tooltipEl.style.right = (window.innerWidth - rect.right + bthPositionRight * 2 + btnWidth) + "px"
    tooltipEl.style.top = (rect.top + bthPositionTop) + "px"

    // 悬停意图：停留 150ms 才显示，快速划过会在到点前被 hideTooltip 取消
    clearTimeout(showTimer)
    showTimer = setTimeout(() => tooltipEl.classList.add('visible'), 150)
}