一个用于 [Orca Note](https://github.com/sethyuan/orca-note) 的分屏挂起插件，允许用户将面板"挂起"，类似于安卓手机的小窗。
可以通过快捷键切出和收起。

## 版本主要变更
- ...
- v2.1.0 命令体验简化，新增前往默认块的命令。
- v1.7.0 按钮逻辑变更：左键普通面板的按钮会挂起面板。左键停靠面板的按钮会隐藏面板，右键停靠面板按钮会取消停靠。
- ...
- [v1.4.2](https://github.com/cordinGH/orca-dockpanel-plugin/releases/tag/v1.4.2)
  - 新增可选设置项：折叠停靠面板时是否需要让焦点离开停靠面板
  - 更改设置里默认ID后，会立即生效无需再重启/刷新
  - 优化收起/展开时的过渡效果
- [v1.3.0](https://github.com/cordinGH/orca-dockpanel-plugin/releases/tag/v1.3.0)
  - 对 可全屏的块（pdf、白板、视频） 做了适配，方便用来做视频笔记、pdf笔记
- [v1.2.0](https://github.com/cordinGH/orca-dockpanel-plugin/releases/tag/v1.2.0)
  - 按钮支持右键隐藏/弹出停靠面板（左键是 生成停靠/取消停靠；右键是 隐藏/弹出）
  - 新增设置选项：设置单屏时默认停靠的块id
- [v1.1.0](https://github.com/cordinGH/orca-dockpanel-plugin/releases/tag/v1.1.0)
  - 面板右上角新增按钮，一键挂起或恢复。
  - 单面板时，也可以挂起，会自动挂起今日日志。
  - 如果 alt + q 是闲置的，则会作为快捷键分配给「隐藏/弹出停靠面板」

## 使用方法

### 安装

前往本仓库的 [Releases](https://github.com/cordinGH/orca-dockpanel-plugin/releases) 页面。

在最新版本的 "Assets" 区域，下载 `Source code(zip)` 解压，解压后复制文件夹到 `orca\plugins`。  
**⭐️检查一下最终目录结构是否如下**：


```
orca-dockpanel-plugin/
├── dist/
├── README.md
└── icon.png
```


**⭐️然后，退掉 orca-note 重新打开 orca-note ，插件才能被读取，这是现版本所有插件必须的一步。**

---

> [!TIP]  
> - **Q：`orca\` 目录在哪？**  
> - A：从下图进入即可看到  
>   <img width="321" height="134" alt="image" src="https://github.com/user-attachments/assets/50cf1e64-f628-42cb-8e77-82ae4083999b" />


---

### 命令和快捷键

命令面板搜索dock
- 1️⃣开启/取消当前面板的停靠(dock)
- 2️⃣收起/展开停靠的面板(dock)

推荐给2️⃣设置快捷键，用来一键切出停靠面板。我设置的是alt q

> [!TIP] 
> 关于1️⃣命令的逻辑：
> - 如果不存在停靠面板，则会将当前面板停靠
> - 如果存在停靠面板
>     - 如果当前就在停靠面板，则会取消停靠恢复原样。
>     - 如果当前不在停靠面板，则当前面板会顶替为新停靠。

### 简单演示（v1.1.0）

https://github.com/user-attachments/assets/c40e1a86-d437-47aa-989c-bb86d83e18f0


