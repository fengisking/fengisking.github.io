# Navigation 详解

## 1. 问题背景

UE Navigation 解决 AI 在复杂地图中“从当前位置走到目标位置”的问题。它不是简单直线移动，而是先构建可行走区域，再用寻路算法找路径，最后由移动组件沿路径移动。大世界、动态障碍、多人怪物、飞行单位都会让导航系统变复杂。

## 2. 源码入口

```text
Engine/Source/Runtime/NavigationSystem/Public/NavigationSystem.h
Engine/Source/Runtime/NavigationSystem/Private/NavigationSystem.cpp
Engine/Source/Runtime/NavigationSystem/Public/NavMesh/RecastNavMesh.h
Engine/Source/Runtime/NavigationSystem/Private/NavMesh/RecastNavMesh.cpp
Engine/Source/Runtime/AIModule/Classes/AIController.h
Engine/Source/Runtime/AIModule/Private/AIController.cpp
Engine/Source/Runtime/AIModule/Classes/Navigation/PathFollowingComponent.h
Engine/Source/Runtime/AIModule/Private/Navigation/PathFollowingComponent.cpp
```

底层 Recast/Detour：

```text
Engine/Source/Runtime/Navmesh/Public
Engine/Source/Runtime/Navmesh/Private
```

## 3. 总流程

```text
场景几何和 NavRelevantComponent 收集
→ Recast 构建 Tile
→ 生成 NavMesh 多边形
→ AIController MoveTo
→ UNavigationSystemV1::FindPath
→ ARecastNavMesh 查询路径
→ PathFollowingComponent 跟随路径
→ MovementComponent 执行移动
```

## 4. NavMesh 如何生成

Recast 会把世界切成 Tile。每个 Tile 根据碰撞几何体生成体素高度场，再过滤不可走区域，生成区域、轮廓、多边形网格，最后得到可寻路的 NavMesh。

核心概念：

```text
Tile              导航网格分块
CellSize          体素横向精度
CellHeight        体素高度精度
AgentRadius       代理半径
AgentHeight       代理高度
AgentMaxSlope     最大可走坡度
AgentMaxStepHeight 最大台阶高度
NavArea           区域类型和代价
NavModifier       修改导航区域
```

## 5. MoveTo 调用链

AI 移动常见调用链：

```text
AAIController::MoveToActor / MoveToLocation
→ BuildPathfindingQuery
→ UNavigationSystemV1::FindPathSync / FindPathAsync
→ ARecastNavMesh::FindPath
→ FNavigationPath
→ UPathFollowingComponent::RequestMove
→ FollowPathSegment
→ RequestMove / RequestDirectMove
→ MovementComponent 执行移动
```

BehaviorTree 的 `MoveTo` Task 也是走到 AIController 的 MoveTo。

## 6. 寻路算法

Detour 使用基于 NavMesh 多边形的路径搜索。可以理解为：

```text
找到起点所在多边形
→ 找到终点所在多边形
→ 在多边形图上 A* 搜索
→ 得到多边形通道
→ String Pulling / Funnel 算法拉直路径
→ 输出路径点
```

路径点不是每个地面点，而是经过优化后的拐点。

## 7. 动态障碍

动态障碍常见方式：

```text
NavModifierComponent
NavRelevantComponent
Dynamic Obstacle
Runtime Generation
Navigation Invoker
```

动态重建 NavMesh 成本高，尤其是大世界和大量怪物。能用局部避障解决的，不要频繁重建导航。

## 8. 避障

UE AI 避障常见有两套：

```text
RVO Avoidance
Detour Crowd
```

RVO 在移动组件层做速度避让，适合简单场景。Detour Crowd 更贴近导航路径和群体移动，但配置复杂。大量怪物项目里，需要根据怪物数量、体型、移动速度和关卡宽度选择。

## 9. 如何优化 Navigation

优化方向：

```text
合理设置 CellSize / CellHeight，不要过高精度
按 Agent 类型拆分导航数据，避免一个配置兼容所有单位
使用 Navigation Invoker 限制运行时生成范围
减少动态 NavModifier 频繁变化
远距离 AI 降低 MoveTo 更新频率
缓存可复用路径或目标点
大体型 Boss 单独处理寻路，不要走小怪 NavMesh
不可达检测提前做，避免每帧 FindPath
```

## 10. 飞行单位和特殊移动

普通 NavMesh 是地面导航。飞行单位如果只是平面巡航，可以用投影到地面的 NavMesh；如果是真 3D 空间，需要自定义寻路体素、航点图、流场或行为逻辑。

大型飞行 Boss 常见做法不是每帧 NavMesh 寻路，而是用状态机、环绕点、样条、队形点、区域约束等方式控制。

## 11. 调试方法

```text
P 键显示 NavMesh
show Navigation
ai debug
Visual Logger
Navigation Testing Actor
stat Navigation
```

调试时先看目标点是否在 NavMesh 上，再看路径是否存在，最后看 PathFollowing 是否被卡住。

## 12. 结论

Navigation 是“构建可走区域 + 查询路径 + 路径跟随 + 移动执行”的系统。优化重点不是只调 MoveTo，而是控制 NavMesh 构建成本、动态障碍成本、路径查询频率和 AI 群体移动策略。

## 13. 源码精读：MoveTo 从 AIController 进入

源码位置：

```text
Engine/Source/Runtime/AIModule/Private/AIController.cpp
Engine/Source/Runtime/AIModule/Private/Navigation/PathFollowingComponent.cpp
Engine/Source/Runtime/NavigationSystem/Private/NavigationSystem.cpp
```

`AAIController::MoveToLocation` 或 BehaviorTree 的 MoveTo Task 最终都会构造一个移动请求。AIController 不直接移动 Pawn，而是先找路径，再把路径交给 PathFollowingComponent。

调用链：

```text
UBTTask_MoveTo::ExecuteTask
→ AAIController::MoveTo
→ AAIController::BuildPathfindingQuery
→ UNavigationSystemV1::FindPathSync
→ ARecastNavMesh::FindPath
→ UPathFollowingComponent::RequestMove
→ UPathFollowingComponent::FollowPathSegment
→ MovementComponent::RequestDirectMove / AddMovementInput
```

所以 MoveTo 卡住时，要分三层排查：有没有路径、PathFollowing 有没有推进、MovementComponent 有没有移动。

## 14. 源码精读：Recast 构建 Tile

源码位置：

```text
Engine/Source/Runtime/NavigationSystem/Private/NavMesh/RecastNavMesh.cpp
Engine/Source/Runtime/NavigationSystem/Private/NavMesh/RecastNavMeshGenerator.cpp
Engine/Source/Runtime/Navmesh/Private/Recast
```

Recast 会把世界几何转成可寻路多边形。它不是每次 MoveTo 临时扫描世界，而是预先或运行时增量构建 NavMesh。

构建链路：

```text
收集 NavRelevant 几何
→ 按 Runtime Grid / Tile 切分
→ Rasterize 三角面到高度场
→ 过滤不可走坡度、低矮空间、障碍
→ 生成 Compact Heightfield
→ 构建 Region
→ 生成 Contour
→ 生成 PolyMesh
→ 生成 Detour NavMesh Tile
```

`CellSize` 和 `CellHeight` 会直接影响精度和构建成本。精度越高，Tile 数据越大，构建越慢，查询也可能更贵。

## 15. 源码精读：FindPath 如何搜索

源码位置：

```text
Engine/Source/Runtime/NavigationSystem/Private/NavMesh/RecastNavMesh.cpp
Engine/Source/Runtime/Navmesh/Private/Detour
```

寻路不是在世界坐标网格上找，而是在 NavMesh 多边形图上找。

流程：

```text
ProjectPointToNavigation 找起点 Poly
→ ProjectPointToNavigation 找终点 Poly
→ Detour 在 Poly 图上 A* 搜索
→ 得到 Poly Corridor
→ Funnel/StringPulling 拉直路径
→ 输出 FNavPathPoint 数组
→ PathFollowingComponent 按路径点推进
```

如果目标点不在 NavMesh 上，`ProjectPointToNavigation` 可能失败或投影到附近点。很多“AI 不动”其实是目标点不可达或投影失败。

## 16. 源码精读：PathFollowing 怎么驱动移动

源码位置：

```text
Engine/Source/Runtime/AIModule/Private/Navigation/PathFollowingComponent.cpp
Engine/Source/Runtime/AIModule/Classes/Navigation/PathFollowingComponent.h
```

PathFollowingComponent 每帧判断当前路径段是否完成，然后计算期望移动方向。

核心过程：

```text
TickComponent
→ FollowPathSegment
→ 获取当前位置和当前 Segment 终点
→ 判断是否到达 AcceptanceRadius
→ 如果到达，AdvancePathSegment
→ 如果未到达，计算 MoveVelocity
→ 调用 MovementComponent
```

如果怪物卡在拐角，可能不是 FindPath 错，而是 PathFollowing 认为当前 Segment 没完成，或者 MovementComponent 无法按期望方向移动。调试时要同时看路径点和实际速度。
