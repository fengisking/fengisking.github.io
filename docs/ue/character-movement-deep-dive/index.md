# CharacterMovement 详解

## 1. 问题背景

`UCharacterMovementComponent` 是 UE 里最复杂也最常用的组件之一。它不只是设置速度，而是同时负责输入加速度、地面检测、移动模式、碰撞滑动、跳跃、下落、网络预测、服务端校正、客户端平滑和 RootMotion 处理。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/Character.h
Engine/Source/Runtime/Engine/Private/Character.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/MovementComponent.h
Engine/Source/Runtime/Engine/Classes/GameFramework/PawnMovementComponent.h
```

## 3. 核心调用链

每帧主链路：

```text
UCharacterMovementComponent::TickComponent
→ ConditionalUpdateComponentToWorld
→ PerformMovement
→ StartNewPhysics
→ PhysWalking / PhysFalling / PhysFlying / PhysSwimming / PhysNavWalking
→ CalcVelocity
→ MoveAlongFloor / SafeMoveUpdatedComponent / MoveUpdatedComponent
→ SlideAlongSurface / StepUp / FindFloor
→ UpdateComponentVelocity
```

网络移动链路：

```text
TickComponent
→ ReplicateMoveToServer
→ FSavedMove_Character
→ ServerMove / ServerMovePacked
→ MoveAutonomous
→ PerformMovement
→ ClientAdjustPosition
→ SmoothCorrection
```

## 4. 关键函数和作用

`TickComponent` 是组件每帧入口，会区分本地控制、模拟代理、服务器权威等路径。

`PerformMovement` 是真正执行移动的高层函数，负责 RootMotion、物理交互、移动模式切换前后处理。

`StartNewPhysics` 根据 `MovementMode` 分发到不同物理函数。

`PhysWalking` 处理地面行走，包含地面速度、斜坡、台阶、摩擦、地面投影。

`PhysFalling` 处理空中下落，包含重力、空中控制、落地检测。

`CalcVelocity` 根据加速度、摩擦、制动、最大速度计算 Velocity。

`GetMaxSpeed` 返回当前模式下的速度上限，比如 Walk、Crouch、Fly、Swim。

`FindFloor` 和 `ComputeFloorDist` 负责找脚下地面。

`MoveUpdatedComponent` 是底层移动 UpdatedComponent 的入口。

`SafeMoveUpdatedComponent` 在移动时处理碰撞。

`SlideAlongSurface` 在撞墙后沿表面滑动。

`StepUp` 处理台阶和可跨越障碍。

## 5. MovementMode

常见移动模式：

```text
MOVE_None
MOVE_Walking
MOVE_NavWalking
MOVE_Falling
MOVE_Swimming
MOVE_Flying
MOVE_Custom
```

`MOVE_Custom` 用于自定义移动，比如攀爬、滑铲、墙跑、喷气飞行。自定义时需要实现 `PhysCustom`，并保证客户端预测和服务端模拟一致。

## 6. 地面移动做了什么

Walking 简化流程：

```text
检查 Floor
→ 判断是否仍在地面
→ 根据输入和摩擦 CalcVelocity
→ 把速度投影到地面
→ MoveAlongFloor
→ 碰撞后 SlideAlongSurface
→ 尝试 StepUp
→ 更新 Floor
```

很多“角色卡台阶”“斜坡速度异常”“走楼梯抖动”的问题，都要看 `CurrentFloor`、`WalkableFloorAngle`、`MaxStepHeight`、`PerchRadiusThreshold`。

## 7. 移动同步

CharacterMovement 的网络同步包含三层：

```text
客户端本地预测
服务端权威模拟
客户端校正和平滑
```

客户端不会等服务器回包才移动，否则手感会很差。它会本地执行移动，同时保存 `FSavedMove_Character`。服务端收到输入后再模拟，如果结果不同，就给客户端发校正。客户端收到校正后回滚到服务端位置，再重放未确认输入。

## 8. 如何自定义移动同步

自定义移动要改这些点：

```text
自定义 MovementMode 或 CustomMovementMode
PhysCustom
FSavedMove_Character 子类
FNetworkPredictionData_Client_Character 子类
GetCompressedFlags
UpdateFromCompressedFlags
CanCombineWith
SetMoveFor
PrepMoveFor
```

如果只是本地改速度而没同步到 saved move，服务端不会知道客户端为什么这么移动，结果就是频繁 correction。

## 9. 常见参数

```text
MaxWalkSpeed              行走最大速度
MaxAcceleration           最大加速度
BrakingDecelerationWalking 制动减速度
GroundFriction            地面摩擦
AirControl                空中控制
GravityScale              重力缩放
MaxStepHeight             最大台阶高度
WalkableFloorAngle        可行走坡度
NetworkSmoothingMode      网络平滑模式
```

调手感时不要只调 `MaxWalkSpeed`。启动、停止、转向、空中控制、坡道、动画匹配都要一起看。

## 10. 项目应用

在机甲项目里，移动组件通常会承载：

```text
跑走切换
冲刺
飞行
飞行冲刺
瞄准减速
站在移动平台上的基座补偿
网络复制旋转精度
AI 自动跑测移动稳定性
```

每个状态都应该明确修改哪些变量：速度、加速度、朝向模式、MovementMode、动画状态、网络同步数据。

## 11. 踩坑

`MaxWalkSpeed` 不是直接设置最终速度，而是速度计算中的上限。

`SetActorLocation` 绕过移动组件，容易破坏碰撞和网络预测。

客户端自定义移动如果不进 saved move，服务端会校正。

模拟代理看到的角色位置和 Mesh 位置可能不同，因为有网络平滑。

## 12. 结论

CharacterMovement 是“输入到物理位移，再到网络同步和视觉平滑”的完整系统。自定义移动时不能只改一个速度变量，而要同时考虑移动模式、碰撞、预测、服务端模拟、客户端平滑和动画。

