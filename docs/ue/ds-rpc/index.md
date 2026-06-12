# DS 和 RPC 详解

## 1. 问题背景

DS 通常指 Dedicated Server。UE 的联机模型是服务器权威：客户端负责输入和表现，服务端负责最终状态。RPC 解决的是“某个对象上的某个函数要跨网络调用”的问题，Replication 解决的是“某个对象状态要同步到其他端”的问题。移动预测、平滑和校正则解决客户端操作手感和服务器权威之间的矛盾。

## 2. 源码入口

网络核心路径：

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/Actor.h
Engine/Source/Runtime/Engine/Private/ActorReplication.cpp
Engine/Source/Runtime/Engine/Classes/Engine/NetDriver.h
Engine/Source/Runtime/Engine/Private/NetDriver.cpp
Engine/Source/Runtime/Engine/Classes/Engine/ActorChannel.h
Engine/Source/Runtime/Engine/Private/DataChannel.cpp
Engine/Source/Runtime/Engine/Classes/Engine/NetConnection.h
Engine/Source/Runtime/Engine/Private/RepLayout.cpp
```

角色移动同步路径：

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/Character.h
Engine/Source/Runtime/Engine/Private/Character.cpp
```

## 3. RPC 类型

RPC 常见类型：

```text
Server      客户端请求服务端执行
Client      服务端通知指定客户端执行
NetMulticast 服务端广播到相关客户端执行
```

示例：

```cpp
UFUNCTION(Server, Reliable)
void ServerFire();

UFUNCTION(Client, Unreliable)
void ClientPlayHitFeedback();

UFUNCTION(NetMulticast, Unreliable)
void MulticastPlayEffect();
```

RPC 依赖 Actor 的网络通道和对象复制条件。不是任何 UObject 都能随便 RPC，通常要在可网络复制的 Actor 或 ActorComponent 上。

## 4. Reliable 和 Unreliable 差异

`Reliable` 表示可靠到达并保持顺序。它适合低频但必须执行的事件，比如确认购买、任务完成、关键交互。

`Unreliable` 表示可能丢包。它适合高频、可被下一帧覆盖的事件，比如开火表现、脚步声、准星反馈、临时特效。

误区是把所有 RPC 都写成 Reliable。Reliable 队列如果被高频事件塞满，会阻塞后续可靠消息，导致延迟积累。高频表现类事件应该优先 Unreliable 或改成状态复制。

## 5. RPC 调用链

一次 Server RPC 可以简化为：

```text
Client 调用 ServerFire
→ 生成的 RPC wrapper 检查调用端和网络条件
→ UActorChannel 写入 RPC bunch
→ UNetConnection 发送
→ Server NetDriver 收包
→ UActorChannel 找到目标 Actor
→ ProcessEvent 调用 UFunction
→ ServerFire_Implementation 执行业务
```

反射系统在这里提供函数元数据，网络层负责序列化参数和路由。

## 6. Replication 和 RPC 的边界

RPC 是事件，Replication 是状态。

```text
开门按钮被按下：Server RPC
门当前是否打开：Replicated Property
开门音效：Multicast 或 OnRep 播放
玩家血量：Replicated Property + OnRep
玩家输入：ServerMove 这类专门移动 RPC
```

如果一个数据需要 late join 客户端也能看到，就不要只用 RPC，应该复制状态。

## 7. 移动预测

CharacterMovement 的移动同步不是简单服务端每帧复制位置。客户端会先本地预测移动，马上得到手感反馈，再把压缩输入发送给服务端。服务端模拟后如果发现客户端预测偏差太大，就发送校正。

典型调用链：

```text
客户端输入
→ UCharacterMovementComponent::TickComponent
→ ReplicateMoveToServer
→ FSavedMove_Character 保存输入和时间戳
→ ServerMove / ServerMovePacked
→ 服务端 PerformMovement
→ 比较位置和速度
→ ClientAdjustPosition / ClientVeryShortAdjustPosition
→ 客户端回滚、重放未确认输入
```

核心类型：

```text
FSavedMove_Character
FNetworkPredictionData_Client_Character
FNetworkPredictionData_Server_Character
FCharacterNetworkMoveData
FCharacterNetworkMoveDataContainer
```

## 8. 平滑和校正

服务端校正不能直接把客户端角色瞬移到服务端位置，否则画面会抖。UE 会做 Network Smoothing。

常见路径：

```text
Client 收到校正
→ ClientAdjustPosition
→ 更新服务端权威位置
→ SmoothCorrection
→ MeshTranslationOffset / MeshRotationOffset
→ SmoothClientPosition
→ 逐帧把视觉 Mesh 平滑到 Capsule
```

Capsule 是真实碰撞位置，Mesh 可以做视觉平滑。这样既保持物理正确，又减少画面跳变。

## 9. 如何自定义移动同步

如果需要自定义移动状态，比如滑铲、飞行冲刺、攀爬，需要扩展：

```text
FSavedMove_Character
FNetworkPredictionData_Client_Character
GetCompressedFlags
UpdateFromCompressedFlags
CanCombineWith
SetMoveFor
PrepMoveFor
```

流程：

```text
客户端保存自定义输入标记
→ 压缩到 move flags 或自定义 move data
→ ServerMove 传到服务端
→ 服务端还原状态
→ 服务端用同样规则模拟
→ 客户端校正时重放 move
```

核心原则是客户端和服务端必须使用同一套移动计算，否则预测一定会频繁被校正。

## 10. 怎么优化 DS 消耗

DS 成本主要来自：

```text
Actor 数量
Tick 数量
Replication 频率
RPC 数量
物理和寻路
AI 感知和行为树
动画和碰撞
```

优化方向：

```text
降低无关 Actor 的 NetUpdateFrequency
使用 NetCullDistanceSquared 控制相关性
用 Replication Graph 或自定义相关性裁剪
减少 Reliable 高频 RPC
把表现事件改为客户端预测或本地播放
AI 低频 Tick / 分帧更新
远距离怪物关闭复杂感知和物理
按区域休眠 Actor
减少每帧同步大数组和字符串
```

DS 上不需要渲染，但并不代表便宜。AI、物理、网络序列化、寻路都是实际开销。

## 11. 项目排查方法

网络问题排查优先看：

```text
Network Profiler
Unreal Insights Networking Trace
stat net
Net pktlag / pktloss 模拟
ActorChannel 数量
RPC 频率
Replicated 属性大小
Client correction 次数
```

如果移动抖动，先看是否频繁 correction；如果 DS CPU 高，先看 Tick、AI、Replication；如果带宽高，先看高频属性和 Reliable RPC。

## 12. 结论

DS 是服务器权威运行环境，RPC 是跨网络事件调用，Replication 是状态同步。移动同步靠预测、服务端校正和视觉平滑维持手感。优化 DS 的核心是降低无意义的 Tick、复制、RPC、AI 和物理成本。

