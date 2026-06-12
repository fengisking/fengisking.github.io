# World Partition 详解

## 1. 问题背景

World Partition 用于大世界流式加载。传统关卡需要手动拆子关卡，World Partition 把世界按网格划分，根据玩家位置、Streaming Source、Data Layer 等规则自动加载和卸载 Actor。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Public/WorldPartition/WorldPartition.h
Engine/Source/Runtime/Engine/Private/WorldPartition/WorldPartition.cpp
Engine/Source/Runtime/Engine/Public/WorldPartition/WorldPartitionRuntimeCell.h
Engine/Source/Runtime/Engine/Private/WorldPartition/WorldPartitionRuntimeCell.cpp
Engine/Source/Runtime/Engine/Public/WorldPartition/WorldPartitionStreamingSource.h
Engine/Source/Runtime/Engine/Private/WorldPartition/WorldPartitionStreamingGeneration.cpp
```

## 3. 核心概念

```text
World Partition      大世界分区系统
Runtime Grid         运行时网格
Runtime Cell         网格单元
Streaming Source     流式加载源
Data Layer           数据层
HLOD                 层级细节替代
One File Per Actor   每个 Actor 独立文件
```

## 4. Actor 怎么加载卸载

编辑器里 Actor 会被转换成 World Partition 管理的数据。运行时根据 Streaming Source 判断哪些 Cell 应该加载。

流程：

```text
玩家或系统注册 Streaming Source
→ WorldPartition 每帧收集 Source
→ 计算覆盖到的 Runtime Cell
→ 需要的 Cell 进入加载队列
→ Cell 内 Actor Package 异步加载
→ Actor 创建、注册组件、BeginPlay
→ 离开范围的 Cell 卸载
→ Actor EndPlay、组件反注册、对象释放
```

## 5. Streaming Source

Streaming Source 描述“从哪里开始加载世界”。玩家通常是一个 Source，远程镜头、载具、任务目标也可以是 Source。

Source 关键数据：

```text
位置
旋转
加载半径
目标 Grid
优先级
形状
是否启用
```

## 6. Data Layer

Data Layer 用于控制一组 Actor 是否参与加载。它适合：

```text
剧情阶段
昼夜变化
任务状态
活动区域
编辑器组织
```

Data Layer 不是简单隐藏，它会影响 Actor 是否加载到世界。

## 7. HLOD

HLOD 用于远距离显示简化版本，减少远处大量 Actor 的渲染和加载成本。

流程：

```text
多个 Actor 聚合
→ 构建 HLOD Actor
→ 远距离加载 HLOD
→ 近距离卸载 HLOD，加载真实 Actor
```

## 8. 大世界性能关注点

```text
Cell 大小
加载半径
Streaming Source 数量
Actor 数量
组件数量
BeginPlay 成本
异步加载峰值
HLOD 构建质量
Data Layer 切换成本
```

不要只关注加载半径。Actor 的 BeginPlay、组件注册、碰撞创建、AI 初始化都可能造成卡顿。

## 9. 项目实践

大世界项目建议：

```text
用 Streaming Source 明确玩家和重要镜头加载范围
重 Actor 拆分或延迟初始化
远距离禁用 AI、碰撞、Tick
HLOD 和真实 Actor 切换要验证视觉一致性
任务相关对象用 Data Layer 管理
关键 POI 提前预加载
```

## 10. 调试

```text
World Partition Editor
wp.Runtime.ToggleDrawRuntimeHash2D
wp.Runtime.ToggleDrawRuntimeHash3D
stat streaming
stat levels
Unreal Insights LoadTime
```

排查加载问题时看：Actor 属于哪个 Cell、Cell 是否被 Source 覆盖、Data Layer 是否激活、Package 是否加载成功。

## 11. 结论

World Partition 的核心是把世界拆成 Runtime Cell，并由 Streaming Source 和 Data Layer 控制加载。大世界优化不只是流式距离，还包括 Actor 初始化成本、HLOD、AI 休眠和异步加载峰值管理。

