# UE 笔记

这里整理 Unreal Engine 源码阅读、Gameplay、AI、网络、动画、渲染、打包和性能分析相关笔记。

## 推荐阅读顺序

从 `UE 学习路线和源码阅读方法` 开始，先建立“入口函数、调用链、关键变量、断点验证”的源码阅读方法。之后按对象系统、运行时、Gameplay、网络、表现、工程化阅读。不要一开始就读渲染或网络底层，否则很容易卡在宏、对象生命周期和线程模型上。

## 学习路线

- [UE 学习路线和源码阅读方法](/ue/ue-learning-roadmap-source-reading/)

## 核心机制

- [UE 反射详解](/ue/ue-reflection/)
- [UE 的 GC 详解](/ue/ue-gc/)
- [智能指针和 Delegate 详解](/ue/smart-pointer-delegate/)
- [UE 运行时问题解答](/ue/ue-runtime-questions/)

## Gameplay 和 AI

- [CharacterMovement 详解](/ue/character-movement-deep-dive/)
- [UE CharacterMovement 源码阅读：MaxWalkSpeed 到底在哪里生效](/ue/character-movement/)
- [Navigation 详解](/ue/navigation/)
- [UE AI Perception：死亡复活后感知为什么不刷新](/ue/ai-perception/)

## 网络、动画和表现

- [DS 和 RPC 详解](/ue/ds-rpc/)
- [Animation 详解](/ue/animation/)
- [UE 渲染详解](/ue/ue-rendering/)
- [Physics 和 Collision 详解](/ue/physics-collision/)

## 工程化

- [如何打包一个项目](/ue/cook-package/)
- [Unreal Insights 如何 Profile](/ue/unreal-insights-profile/)
- [World Partition 详解](/ue/world-partition/)
- [怎么升级引擎？](/ue/engine-upgrade/)
