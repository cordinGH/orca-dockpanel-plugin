let rootPanel = null

// 按钮的位置信息
let btnInfo = null
let panelManager = null


export function start(pm) {

    panelManager = pm
    // 设置右上角dockpanel按钮的左右键监听
    rootPanel = document.querySelector("#main>.orca-panels-row")
    setBtnInfo()
    rootPanel.addEventListener('click', dockBtnHandler)
    rootPanel.addEventListener('contextmenu', dockBtnHandler)
}

export function cleanup() {
    rootPanel.removeEventListener('click', dockBtnHandler)
    rootPanel.removeEventListener('contextmenu', dockBtnHandler)
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
        btnRight: orcaSpacingMd + orcaSpacingSm,
        btnTop: 0.5 * rootFontSize,
        btnWight: orcaFontsizeLg + 2 * orcaSpacing2xs,
        btnHeight: orcaFontsizeLg + 2 * orcaSpacingSm
    }
}


/**
 * 处理停靠面板按钮点击事件
 */
function dockBtnHandler(e) {
    const target = e.target
    // 如果点击的不是面板，不处理
    if (!target?.classList.contains("orca-panel")) return

    const targetPanelIsDockpanel = target.dataset.panelId === window.pluginDockpanel.panel.id

    // 如果左键点击的是折叠的停靠面板（也就是缩小的小方块），则近切换折叠
    if (e.button === 0 && targetPanelIsDockpanel && window.pluginDockpanel.isCollapsed) {
        panelManager.toggleDockedPanel()
        return
    }

    // 获取点按信息
    const rect = target.getBoundingClientRect()

    // 计算按钮相对于面板左边和上边的起始距离
    const { btnRight, btnTop, btnWight, btnHeight } = btnInfo;
    const btnXStart = rect.width - btnRight - btnWight
    const btnYStart = btnTop

    // 获取点击位置相对于面板左边和上边的距离
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 检查点击是否在按钮区域内
    if (x < btnXStart || x > btnXStart + btnWight || y < btnYStart || y > btnYStart + btnHeight) return

    e.stopPropagation()

    // 如果是右键的展开的停靠面板按钮，则取消停靠
    if (e.button === 2 && targetPanelIsDockpanel) {
        panelManager.undockPanel()
        return
    }

    // 如果左键的是展开的停靠面板的停靠按钮，则折叠。否则则停靠对应面板
    if (targetPanelIsDockpanel) {
        panelManager.toggleDockedPanel()
    } else panelManager.dockPanel(orca.state.activePanel)
}
