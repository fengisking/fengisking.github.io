# CharacterMovement 详解

## 0. 读前地图

这篇文章目标是从“一帧输入”追到“最终位移”，再追到“网络预测和校正”。不要把 CharacterMovement 理解成速度组件，它同时负责输入加速度、地面检测、碰撞移动、移动模式、RootMotion、客户端预测、服务端校正和视觉平滑。

源码入口：

```text
CharacterMovementComponent.h / .cpp：移动主体
Character.cpp：角色和 MovementComponent 的交互
MovementComponent.h：底层 UpdatedComponent 移动接口
PawnMovementComponent.h：输入消费和 Pawn 绑定
```

建议断点：

```text
UCharacterMovementComponent::TickComponent
UCharacterMovementComponent::PerformMovement
UCharacterMovementComponent::StartNewPhysics
UCharacterMovementComponent::PhysWalking
UCharacterMovementComponent::MoveAlongFloor
UCharacterMovementComponent::ReplicateMoveToServer
```

关键变量：

```text
Acceleration：输入转成的加速度
Velocity：当前真实速度
UpdatedComponent：真正被移动的组件
CurrentFloor：地面检测结果
MovementMode / CustomMovementMode：物理分支
SavedMoves：客户端预测历史
```

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

## 13. 源码精读：TickComponent 入口

源码位置：

```text
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
```

`TickComponent` 是 CharacterMovement 每帧入口。它会先检查组件是否可 Tick、UpdatedComponent 是否有效、CharacterOwner 是否存在，然后根据网络角色决定走自主代理、模拟代理还是服务端路径。

简化流程：

```text
UCharacterMovementComponent::TickComponent
→ 检查 ShouldSkipUpdate
→ 更新角色状态和根运动
→ 如果是 SimulatedProxy，走 SimulatedTick
→ 如果是 AutonomousProxy，走本地预测并发送 ServerMove
→ 如果是 Authority，执行权威移动
→ 更新 ComponentVelocity
```

读这里要重点看三个变量：

```text
CharacterOwner
UpdatedComponent
MovementMode
```

`UpdatedComponent` 通常是 Character 的 Capsule。真正参与碰撞移动的是 Capsule，不是 Mesh。这也是为什么网络平滑通常平滑 Mesh，而不是直接平滑 Capsule。

## 14. 源码精读：PerformMovement 到 PhysWalking

源码位置：

```text
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
```

`PerformMovement` 是执行一次完整移动模拟的主函数。它负责处理 RootMotion、移动前状态、物理模拟、移动后状态、落地和模式切换。

调用链：

```text
PerformMovement
→ ApplyAccumulatedForces
→ UpdateCharacterStateBeforeMovement
→ StartNewPhysics
→ PhysWalking / PhysFalling / PhysFlying
→ UpdateCharacterStateAfterMovement
→ OnMovementUpdated
→ SaveBaseLocation
```

`StartNewPhysics` 根据 `MovementMode` 分发。如果是 `MOVE_Walking`，会进入 `PhysWalking`。`PhysWalking` 里最核心的是：

```text
RestorePreAdditiveRootMotionVelocity
→ CalcVelocity
→ ApplyRootMotionToVelocity
→ MoveAlongFloor
→ FindFloor
→ 判断是否 Falling
```

这里的关键是 `CalcVelocity` 只算速度，`MoveAlongFloor` 才真正移动 UpdatedComponent。

## 15. 源码精读：CalcVelocity 具体做了什么

源码位置：

```text
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
```

`CalcVelocity` 会根据输入加速度、摩擦、制动和最大速度更新 `Velocity`。它不是简单 `Velocity = Input * MaxSpeed`。

核心逻辑：

```text
如果没有输入或超速，应用 Braking
→ 根据 Friction 影响当前速度方向
→ 根据 Acceleration 增加速度
→ 限制到 GetMaxSpeed
→ 处理 RequestedVelocity
→ 处理流体摩擦等特殊情况
```

常见参数实际影响：

```text
MaxAcceleration 控制启动变快还是变慢
BrakingDecelerationWalking 控制松手后刹停
GroundFriction 同时影响转向和刹车手感
MaxWalkSpeed 控制速度上限
```

所以项目调手感时，如果只改 `MaxWalkSpeed`，只能改变上限，不能解决启动、刹停、转向重量感。

## 16. 源码精读：MoveAlongFloor、StepUp 和 SlideAlongSurface

源码位置：

```text
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Private/Components/MovementComponent.cpp
```

地面移动不是直接沿世界 XY 移动。角色站在斜坡上时，移动方向会投影到地面；撞到障碍时，会尝试滑动或上台阶。

调用链：

```text
PhysWalking
→ MoveAlongFloor
→ ComputeGroundMovementDelta
→ SafeMoveUpdatedComponent
→ 如果 Hit
   → StepUp 尝试上台阶
   → HandleImpact
   → SlideAlongSurface
→ FindFloor 更新 CurrentFloor
```

`StepUp` 成功与否受 `MaxStepHeight`、碰撞法线、地面可走坡度影响。`SlideAlongSurface` 会根据命中法线把剩余位移投影到可滑动方向。角色贴墙滑动、上台阶、走斜坡的体验都在这几个函数里。

## 17. 源码精读：自定义移动同步最小闭环

源码位置：

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
```

如果要做滑铲、喷气冲刺、特殊飞行，最小闭环是：

```text
定义自定义状态
→ 客户端输入设置状态
→ FSavedMove 记录状态
→ GetCompressedFlags 或自定义 MoveData 传给服务端
→ UpdateFromCompressedFlags 还原状态
→ 客户端和服务端 PhysCustom 使用同一套计算
→ 校正后 PrepMoveFor 重放状态
```

只在客户端设置一个 bool，然后本地加速度，是不够的。服务端不知道这个 bool，就会按普通移动模拟，最后通过 ClientAdjustPosition 把客户端拉回。

## 源码精读补充：按一帧移动拆开阅读

读前目标：读完后应该能从一次输入追到最终位移，能解释移动预测为什么需要 `FSavedMove`，也知道自定义移动时哪些状态必须进入网络同步。

源码位置：

```text
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Character.cpp
```

建议断点：

```text
ACharacter::Tick
UCharacterMovementComponent::TickComponent
UCharacterMovementComponent::PerformMovement
UCharacterMovementComponent::StartNewPhysics
UCharacterMovementComponent::PhysWalking
UCharacterMovementComponent::MoveAlongFloor
UCharacterMovementComponent::ReplicateMoveToServer
```

关键变量：

```text
Acceleration：本帧输入转成的加速度
Velocity：移动组件维护的真实速度
UpdatedComponent：真正被移动的组件，通常是 Capsule
CurrentFloor：地面检测结果，决定能否 Walking
MovementMode / CustomMovementMode：物理分支选择
PendingLaunchVelocity：LaunchCharacter 等特殊位移入口
SavedMoves：客户端预测后等待服务端确认的移动历史
```

一帧数据流：

```text
输入系统写入移动输入
→ Character 消费输入向量
→ MovementComponent 得到 Acceleration
→ PerformMovement 进入物理更新
→ StartNewPhysics 根据 MovementMode 分发
→ PhysWalking / PhysFalling 计算 Velocity 和 Delta
→ SafeMoveUpdatedComponent 移动 Capsule
→ 命中后 StepUp / SlideAlongSurface
→ 更新 Floor、Velocity 和网络状态
```

伪代码精读：

```cpp
PerformMovement()
{
    UpdateAccelerationFromInput();
    StartNewPhysics(DeltaTime);
    UpdateComponentVelocity();
    SaveNetworkMoveIfNeeded();
}

StartNewPhysics()
{
    if (MovementMode == MOVE_Walking)
        PhysWalking();
    else if (MovementMode == MOVE_Falling)
        PhysFalling();
    else if (MovementMode == MOVE_Custom)
        PhysCustom();
}
```

自定义移动时，先确认你的新状态属于哪一类：只改速度参数、临时外力、还是完整自定义物理。只改速度参数通常覆写 `GetMaxSpeed` 即可；临时外力可以考虑 Launch 或 RootMotionSource；完整滑铲、攀爬、喷气飞行才需要 `MOVE_Custom` 和 `FSavedMove`。

调试验证方法：

1. 在 `PhysWalking` 断点，观察 `Acceleration`、`Velocity`、`MaxWalkSpeed`。
2. 撞墙时进入 `SlideAlongSurface`，确认剩余位移如何投影。
3. 上台阶时看 `StepUp` 返回值和 `MaxStepHeight`。
4. 开网络模式后，在 `ReplicateMoveToServer` 看客户端保存了哪些输入。

常见误区：

- `SetActorLocation` 绕过 MovementComponent，会破坏预测、碰撞和校正链路。
- `MaxWalkSpeed` 只是速度上限，不决定启动和刹车手感。
- 自定义移动只在客户端生效，一定会被服务端校正拉回。
