let rootPanel = null

// 按钮的位置信息
let btnInfo = null
let panelManager = null


export function start(pm) {

    panelManager = pm
    // 设置右上角dockpanel按钮的左右键监听
    rootPanel = document.querySelector("#main>.orca-panels-row")
    setBtnInfo()
    rootPanel.addEventListener('pointerdown', dockBtnHandler)
}

export function cleanup() {
    rootPanel.removeEventListener('pointerdown', dockBtnHandler)
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


let isPointerDownToUp = false
// 处理停靠面板按钮点击事件
function dockBtnHandler(e) {
    const target = e.target
    // 如果点击的不是面板，不处理
    if (!target?.classList.contains("orca-panel")) return

    // 获取点按信息
    const rect = target.getBoundingClientRect()

    // 计算按钮相对于面板左边和上边的起始距离
    const { btnRight, btnTop, btnWight, btnHeight } = btnInfo;
    const btnXStart = rect.width - btnRight - btnWight
    const btnYStart = btnTop

    // 获取点击位置相对于面板左边和上边的距离
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 不在按钮区域
    if (x < btnXStart || x > btnXStart + btnWight || y < btnYStart || y > btnYStart + btnHeight) return

    isPointerDownToUp = true
    e.preventDefault() // 消除圆圈
    e.stopPropagation()

    // 左键切出/隐藏，右键停靠当前面板，alt + 右键取消停靠（或者中键）。
    const eButton = e.button
    const dpid = target.dataset.panelId
    console.log("执行1次点击事件：", eButton)
    switch (eButton) {
        case 0: panelManager.toggleDockedPanel(); break;
        case 1: panelManager.undockPanel(); break;
        case 2: window.event?.altKey? panelManager.undockPanel() : panelManager.dockPanel(dpid); break;
    } 
}