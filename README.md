# fengisking.github.io 技术主页维护说明

这个仓库用于维护个人技术主页：

```text
https://fengisking.github.io/
```

当前站点基于 **VitePress** 构建，内容主要由 `docs/` 目录下的 Markdown 文件生成。GitHub Pages 通过 `.github/workflows/deploy.yml` 中的 GitHub Actions workflow 自动构建和发布网站。

---

## 1. 日常维护总流程

每次更新网站，大致按这个流程：

```bat

:: 1. 修改 docs 里的 Markdown 或配置文件
:: 2. 本地预览
npm run docs:dev

:: 3. 确认构建没问题
npm run docs:build

:: 4. 查看本地修改
git status
git diff HEAD

:: 5. 提交并发布
git add .
git diff --staged
git commit -m "update site"
git push origin main
```

推送到 `main` 分支后，GitHub Actions 会自动部署到：

```text
https://fengisking.github.io/
```

---

## 2. 项目目录结构

```text
fengisking.github.io/
├─ docs/
│  ├─ index.md
│  ├─ about.md
│  ├─ ue/
│  │  ├─ index.md
│  │  ├─ character-movement.md
│  │  ├─ ai-perception.md
│  │  ├─ behavior-tree.md
│  │  └─ package-assets.md
│  ├─ projects/
│  │  ├─ index.md
│  │  ├─ mech-pve-ai.md
│  │  └─ ue-tools.md
│  ├─ public/
│  │  └─ images/
│  │     ├─ ue/
│  │     ├─ projects/
│  │     └─ profile/
│  └─ .vitepress/
│     └─ config.mts
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
├─ package.json
├─ package-lock.json
├─ .gitignore
└─ README.md
```

---

## 3. 各文件和目录的含义

| 文件 / 目录 | 含义 | 常见修改场景 |
|---|---|---|
| `docs/index.md` | 网站首页 | 改个人简介、精选文章、项目入口、联系方式 |
| `docs/about.md` | 关于我页面 | 改自我介绍、技术栈、经历概览 |
| `docs/ue/index.md` | UE 笔记栏目首页 | 改 UE 文章索引、源码阅读路线 |
| `docs/ue/*.md` | UE 技术文章 | 新增或修改 UE 源码、AI、3C、打包、性能文章 |
| `docs/projects/index.md` | 项目复盘栏目首页 | 改项目复盘索引 |
| `docs/projects/*.md` | 项目复盘文章 | 写机甲 PVE、工具链、自动跑测等项目复盘 |
| `docs/public/images/` | 图片资源目录 | 放截图、调用栈图、架构图、头像 |
| `docs/.vitepress/config.mts` | VitePress 配置 | 改顶部导航、左侧目录、站点标题、GitHub 链接 |
| `.github/workflows/deploy.yml` | GitHub Actions 发布配置 | 平时基本不用改 |
| `package.json` | npm 脚本和依赖 | 平时基本不用改 |
| `.gitignore` | Git 忽略规则 | 增加不想提交的本地文件 |

---

## 4. VitePress 路由规则

VitePress 使用文件路由，Markdown 文件路径会映射成网页路径。

| Markdown 文件 | 网页路径 |
|---|---|
| `docs/index.md` | `/` |
| `docs/about.md` | `/about` |
| `docs/ue/index.md` | `/ue/` |
| `docs/ue/character-movement.md` | `/ue/character-movement` |
| `docs/projects/mech-pve-ai.md` | `/projects/mech-pve-ai` |

例如：

```text
docs/ue/uobject-source.md
```

对应：

```text
https://fengisking.github.io/ue/uobject-source
```

---

## 5. 新增文章

### 5.1 新增 UE 技术文章

例如新增《UE UObject 源码阅读》：

1. 新建文件：

```text
docs/ue/uobject-source.md
```

2. 写入内容：

```md
# UE UObject 源码阅读

## 1. 问题背景

这里写为什么要看 UObject。

## 2. 源码入口

```text
Engine/Source/Runtime/CoreUObject/Public/UObject/Object.h
Engine/Source/Runtime/CoreUObject/Private/UObject/Obj.cpp
```

## 3. 调用链

后续补充。
```

3. 打开：

```text
docs/.vitepress/config.mts
```

4. 在 UE 侧边栏里增加一项：

```ts
{ text: 'UObject 源码阅读', link: '/ue/uobject-source' },
```

---

### 5.2 新增项目复盘

例如新增《Gameplay 自动跑测框架》：

1. 新建文件：

```text
docs/projects/gameplay-autotest.md
```

2. 对应网页：

```text
https://fengisking.github.io/projects/gameplay-autotest
```

3. 在 `docs/.vitepress/config.mts` 的 `/projects/` 侧边栏里增加：

```ts
{ text: 'Gameplay 自动跑测框架', link: '/projects/gameplay-autotest' },
```

---

## 6. 删除文章

例如删除：

```text
docs/ue/package-assets.md
```

需要做两件事：

1. 删除文件：

```text
docs/ue/package-assets.md
```

2. 删除 `docs/.vitepress/config.mts` 里对应侧边栏：

```ts
{ text: '打包与动态资源', link: '/ue/package-assets' }
```

否则左侧目录里会出现 404 链接。

---

## 7. 修改首页

修改文件：

```text
docs/index.md
```

常见修改：

- 改个人简介
- 改精选文章
- 改项目复盘
- 增加联系方式
- 增加简历下载链接

示例：

```md
# 潘天峰的技术主页

UE Gameplay / AI / Tools / Engine Notes

## 精选文章

- [UE UObject 源码阅读](/ue/uobject-source)
- [UE CharacterMovement 源码阅读](/ue/character-movement)
- [UE AI Perception 死亡复活感知问题](/ue/ai-perception)
```

---

## 8. 顶部导航和左侧目录

修改文件：

```text
docs/.vitepress/config.mts
```

### 8.1 顶部导航

```ts
nav: [
  { text: '首页', link: '/' },
  { text: 'UE 笔记', link: '/ue/' },
  { text: '项目复盘', link: '/projects/' },
  { text: '关于我', link: '/about' }
]
```

### 8.2 左侧目录

```ts
sidebar: {
  '/ue/': [
    {
      text: 'UE 源码笔记',
      items: [
        { text: 'UE 笔记总览', link: '/ue/' },
        { text: 'CharacterMovement 源码阅读', link: '/ue/character-movement' }
      ]
    }
  ]
}
```

新增文章后，如果想在左侧目录显示，就要在这里加一项。

---

## 9. 附图方法

### 9.1 推荐图片存放位置

把图片放到：

```text
docs/public/images/
```

推荐分类：

```text
docs/public/images/ue/
docs/public/images/projects/
docs/public/images/profile/
```

### 9.2 Markdown 引用图片

如果图片路径是：

```text
docs/public/images/ue/character-movement-flow.png
```

Markdown 里写：

```md
![CharacterMovement 流程](/images/ue/character-movement-flow.png)
```

注意：

```text
docs/public/images/ue/a.png
```

在 Markdown 中写：

```md
/images/ue/a.png
```

不要写成：

```md
docs/public/images/ue/a.png
```

### 9.3 图片命名建议

不推荐：

```text
截图1.png
微信图片_2026xxx.png
新建图片.png
```

推荐：

```text
uobject-newobject-callstack.png
character-movement-flow.png
ai-perception-process-stimuli.png
bt-skill-count-design.png
```

---


## 10. 推荐写作模板

每篇 UE 技术文章建议使用统一结构：

```md
# 文章标题

## 1. 问题背景

这篇文章解决什么实际问题？

## 2. 项目场景

这个问题在项目里如何出现？

## 3. 源码入口

```text
Engine/Source/...
```

## 4. 调用链

```text
A
→ B
→ C
```

## 5. 核心结论

写清楚你最终理解了什么。

## 6. 调试过程

断点、日志、截图、调用栈。

## 7. 项目应用

这个结论怎么用于实际项目？

## 8. 踩坑

容易误解的地方。

## 9. 后续问题

还没完全搞懂什么？

---

## 11. 推荐文章分类

### UE 源码

```text
docs/ue/uobject-source.md
docs/ue/character-movement.md
docs/ue/network-movement.md
docs/ue/ai-perception.md
docs/ue/behavior-tree.md
docs/ue/animation-blueprint.md
docs/ue/packaging-assets.md
docs/ue/rendering-style.md
```

### 项目复盘

```text
docs/projects/mech-pve-ai.md
docs/projects/gameplay-autotest.md
docs/projects/ue-tools.md
docs/projects/data-pipeline.md
```

### 工具链

可以放在 `docs/ue/` 或单独建：

```text
docs/tools/
```

如果新建 `docs/tools/`，记得在 `config.mts` 里加导航和侧边栏。

---

## 12. 文件命名规范

推荐：

```text
英文小写
单词之间用 -
不要用空格
不要用中文文件名
不要用特殊符号
```

推荐：

```text
uobject-source.md
character-movement.md
ai-perception.md
gameplay-autotest.md
```

不推荐：

```text
UObject源码阅读.md
UE Character Movement.md
新建文档.md
文章1.md
```


## 13. 当前站点的核心原则

这个网站不是随便堆笔记，每篇文章都应该尽量体现：

```text
问题背景
源码定位
调用链分析
项目经验
解决方案
复盘能力
```

比起“我学了什么”，更重要的是：

```text
我遇到了什么问题
我怎么定位
我看了哪些源码
我最终怎么解决
这能证明我具备什么能力
```
