# Physics 和 Collision 详解

## 1. 问题背景

UE 的碰撞系统用于查询、阻挡、触发和物理模拟。Gameplay 里大部分问题都和碰撞有关：子弹打不到、角色卡住、Overlap 不触发、Sweep 结果不对、物理对象抖动、Trace Channel 配错。UE5 使用 Chaos 作为物理系统。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Classes/Components/PrimitiveComponent.h
Engine/Source/Runtime/Engine/Private/Components/PrimitiveComponent.cpp
Engine/Source/Runtime/Engine/Classes/Engine/World.h
Engine/Source/Runtime/Engine/Private/Collision
Engine/Source/Runtime/PhysicsCore
Engine/Source/Runtime/Experimental/Chaos
```

常用查询入口：

```text
UWorld::LineTraceSingleByChannel
UWorld::SweepSingleByChannel
UWorld::OverlapMultiByChannel
UPrimitiveComponent::MoveComponent
UPrimitiveComponent::ComponentOverlapMulti
```

## 3. Chaos 是什么

Chaos 是 UE 的物理模拟系统，负责刚体、约束、破碎、布料部分接口、物理场等。Gameplay 层常见的移动碰撞和查询会通过 Engine 的 Collision 接口进入物理场景，最终由 Chaos 完成底层检测。

你平时不一定直接写 Chaos API，但要理解它承载：

```text
Rigid Body
Collision Shape
Broad Phase
Narrow Phase
Constraint Solver
Physics Scene
Destruction
```

## 4. Object Channel 和 Trace Channel 区别

Object Channel 描述“对象是什么”。比如 Pawn、WorldStatic、WorldDynamic、Projectile。

Trace Channel 描述“这次查询想问什么”。比如 Visibility、Camera、WeaponTrace、InteractionTrace。

例子：

```text
子弹 Trace：用 WeaponTrace 问世界，哪些 Object Type 会 Block？
相机 Trace：用 Camera 问世界，Pawn 是否 Ignore？
AI 视线：用 Visibility 问障碍物是否遮挡？
```

Object Channel 更像对象身份，Trace Channel 更像问题类型。

## 5. Collision Response

每个对象对每个 Channel 有三种响应：

```text
Ignore   忽略
Overlap  产生重叠事件，不阻挡
Block    阻挡
```

最终结果取决于双方配置。比如移动组件扫到一个物体，如果对方对 Pawn 是 Block，Pawn 对对方也是 Block，就会阻挡。

## 6. Sweep 和 Overlap 区别

Overlap 问的是“当前位置是否和某些对象重叠”。它不关心从 A 到 B 的运动过程。

Sweep 问的是“一个形状从 A 移动到 B 的过程中是否撞到对象”。它会返回命中时间、命中点、法线等。

```text
Overlap：范围检测、触发区、搜索附近目标
Sweep：角色移动、近战挥砍、胶囊体试探移动
LineTrace：射线检测、视线、点击拾取、子弹即时命中
```

## 7. Hit 和 Overlap 事件

Hit 通常来自阻挡碰撞，Overlap 来自重叠响应。想收到事件还要打开相关开关：

```text
Generate Overlap Events
Simulation Generates Hit Events
Collision Enabled
Collision Response
Object Type
```

很多 Overlap 不触发的问题，本质是其中一个组件没有启用事件或响应不是 Overlap。

## 8. 移动组件和碰撞

CharacterMovement 不是简单 SetActorLocation，而是通过移动组件做 Sweep：

```text
SafeMoveUpdatedComponent
→ MoveUpdatedComponent
→ 碰撞检测
→ 如果 Hit，SlideAlongSurface 或 StepUp
```

所以 Gameplay 里直接 `SetActorLocation` 可能绕过移动组件的预期逻辑，导致穿透、网络不同步或状态不一致。

## 9. 性能优化

```text
减少每帧 Trace 数量
使用合适的 Channel，避免全对象查询
复杂 Mesh 少用 Complex Collision
Overlap 范围不要过大
大量目标搜索使用空间分区或管理器缓存
远距离对象关闭不必要碰撞
Projectile 高频检测用简化形状
```

Trace 和 Overlap 不是免费操作，尤其是大量 AI、子弹、技能范围同时存在时。

## 10. 调试方法

```text
show collision
pxvis collision / Chaos 可视化命令
DrawDebugLine / DrawDebugSphere / DrawDebugCapsule
Collision Analyzer
打印 HitResult 的 Actor、Component、BoneName、ImpactPoint、Normal
```

排查顺序：

```text
组件是否有 Collision Enabled
Object Type 是否正确
双方 Response 是否正确
是否启用 Generate Overlap Events
Trace 起点终点是否正确
是否被自己或 Owner 忽略
```

## 11. 结论

Object Channel 描述对象身份，Trace Channel 描述查询意图。Sweep 检测运动过程，Overlap 检测当前重叠。Chaos 是底层物理系统，但 Gameplay 大多通过 Engine 的 Collision 接口使用它。碰撞问题优先按配置、响应、事件开关、查询参数逐层排查。

