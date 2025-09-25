一个用于Orca Note的分屏挂起插件，允许用户将当前面板"挂起"，类似于安卓手机的小窗。
可以通过快捷键切出和收起。

# 使用方法

## 安装

前往本仓库的 [Releases](https://github.com/cordinGH/orca-dockedpanel-plugin/releases) 页面。

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

## 命令和快捷键

命令面板搜索dock
- 1️⃣开启/取消当前面板的停靠(dock)
- 2️⃣收起/展开停靠的面板(dock)

推荐给2️⃣设置快捷键，用来一键切出停靠面板。我设置的是alt q

> [!TIP] 
> 关于1️⃣命令的逻辑：
> - 如果不存在停靠面板，则会将当前面板停靠
> - 如果存在停靠面板
>     - 如果当前就在停靠面板，则会停靠
>     - 如果当前不在停靠面板，则当前面板会顶替为新停靠

## 简单演示


https://github.com/user-attachments/assets/a913d935-0daf-465b-b395-d1c20b2a07bc


