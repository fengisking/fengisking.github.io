# UE 学习路线和源码阅读方法

## 1. 问题背景

UE 学习最容易卡在两个地方：一是知识面太宽，不知道先学 Gameplay、渲染、动画、网络还是工具链；二是打开源码以后只看到大量类和宏，不知道入口在哪里。我的建议是先围绕“对象生命周期、世界运行、输入移动、网络同步、资源生产、性能分析”建立主线，再用项目问题倒逼源码阅读。

源码阅读不是从 `UObject` 第一行开始顺序读，而是从一个可复现现象开始：哪个对象创建了，哪个函数被调用了，哪个状态被改了，最后表现为什么。每次阅读都应该沉淀三件事：入口类和函数、完整调用链、关键状态变化。

## 2. 学习路线

第一阶段先建立运行时骨架：

```text
UObject / UClass / UWorld / AActor / UActorComponent
→ GameInstance / GameMode / GameState / PlayerController / Pawn
→ Tick / Timer / Latent / Async
→ Gameplay Framework 生命周期
```

第二阶段围绕 Gameplay 高频系统：

```text
Input
→ CharacterMovement
→ Ability / Attribute / GameplayTag
→ Collision / Trace / Projectile
→ AIController / BehaviorTree / Perception / Navigation
```

第三阶段补齐工程能力：

```text
Replication / RPC / Prediction / Correction
→ Animation Blueprint / AnimGraph / Montage
→ AssetManager / Cook / Package
→ Unreal Insights / Stat / Trace
→ World Partition / Streaming
```

第四阶段再深入底层：

```text
Reflection / UHT / generated.h
→ GC / UObject Cluster
→ TaskGraph / RenderThread / RHI
→ Chaos / Navigation Recast
→ Build.cs / UBT / UAT
```

## 3. 源码阅读方法

### 3.1 先找入口类

入口类通常不是最底层类，而是业务直接接触的类。比如读移动同步，不要先读 `FArchive` 或网络底层，先从这些类开始：

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
Engine/Source/Runtime/Engine/Classes/GameFramework/Character.h
Engine/Source/Runtime/Engine/Private/Character.cpp
```

读反射，则从声明和生成产物入手：

```text
Engine/Source/Runtime/CoreUObject/Public/UObject/Object.h
Engine/Source/Runtime/CoreUObject/Public/UObject/Class.h
Engine/Source/Runtime/CoreUObject/Public/UObject/UObjectGlobals.h
Engine/Source/Programs/UnrealHeaderTool/
```

### 3.2 再找运行入口

UE 里很多系统的运行入口都在 Tick、初始化、注册、序列化、网络包处理里。比如 Actor 生命周期可以沿着这条链看：

```text
UWorld::SpawnActor
→ UWorld::SpawnActorInternal
→ AActor::PostSpawnInitialize
→ AActor::RegisterAllComponents
→ AActor::BeginPlay
```

移动可以沿着：

```text
UCharacterMovementComponent::TickComponent
→ UCharacterMovementComponent::PerformMovement
→ UCharacterMovementComponent::StartNewPhysics
→ UCharacterMovementComponent::PhysWalking / PhysFalling / PhysFlying
→ UCharacterMovementComponent::MoveUpdatedComponent
```

### 3.3 每次只追一个状态

读源码时不要同时追所有变量。比如读 CharacterMovement，可以先只追：

```text
Velocity
Acceleration
MovementMode
CurrentFloor
UpdatedComponent
MaxWalkSpeed
```

这些变量如何被写入，比函数名本身更重要。

### 3.4 建立自己的源码笔记模板

每篇源码笔记至少回答这些问题：

```text
入口类是什么？
入口函数是什么？
完整调用链是什么？
关键数据结构是什么？
这个函数修改了哪些状态？
什么时候发生网络同步？
项目里应该怎么用？
哪里容易误解？
```

## 4. 推荐阅读顺序

如果目标是 Gameplay / AI / 3C 开发，可以按这个顺序：

1. `UObject`、`UClass`、反射、GC。
2. `UWorld`、`AActor`、`UActorComponent` 生命周期。
3. `ACharacter` 和 `UCharacterMovementComponent`。
4. 输入、控制器、相机。
5. Replication、RPC、移动预测。
6. Collision、Trace、Projectile。
7. AIController、BehaviorTree、Navigation、Perception。
8. Animation Blueprint、Montage、AimOffset。
9. Cook、Package、AssetManager。
10. Insights、Stat、Trace。

## 5. 实战阅读技巧

最有效的方式是“断点 + 日志 + 调用栈 + 变量观察”。比如你想知道 `MaxWalkSpeed` 在哪里生效，不应该全局搜索以后随便读，而应该断在：

```text
UCharacterMovementComponent::GetMaxSpeed
UCharacterMovementComponent::CalcVelocity
UCharacterMovementComponent::PhysWalking
```

然后观察 `Velocity` 是否被 clamp，`Acceleration` 是否参与计算，`MovementMode` 是否进入预期分支。

## 6. 踩坑

不要只看头文件。UE 很多核心行为在 cpp、宏展开、生成代码、引擎 Tick 流程里。

不要只看一次调用栈。编辑器、PIE、DS、客户端、服务端、回放、网络预测路径都可能不同。

不要把 Blueprint 看到的行为当成最终真相。很多 Blueprint 节点只是 C++ 函数的包装，真正的状态变化在 C++。

## 7. 结论

UE 源码阅读的核心不是“读完所有源码”，而是建立从项目问题到源码入口的定位能力。每次解决一个问题，都沉淀入口、调用链、状态变化和项目结论，长期积累后就能形成自己的引擎知识地图。

