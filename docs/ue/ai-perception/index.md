# UE AI Perception：死亡复活后感知为什么不刷新

## 1. 问题背景

在项目里经常会遇到这样的现象：

```text
AI 已经感知过玩家
玩家死亡
玩家复活
AI 没有重新触发预期的感知逻辑
```

直觉上会认为“玩家复活后重新进入视野，AI Perception 应该重新 OnTargetPerceptionUpdated”。但 UE 的 AI Perception 并不是简单地每帧发现目标就广播一次，它内部维护感知数据、刺激队列和状态变化。只有刺激状态发生变化，或感知数据被刷新到需要更新的状态，才会触发外部回调。

这篇文章关注的问题是：

```text
为什么死亡复活后，AI Perception 有时不会重新刷新？
需要 ForgetActor、重新注册 StimuliSource，还是手动触发感知更新？
```

## 2. 项目场景

项目里 AI 依赖感知系统维护仇恨和战斗状态：

```text
AI Perception
→ 感知玩家
→ EnmityTracker / MonsterState
→ Warning / Combat / Search 状态切换
```

死亡复活会带来几个容易被忽略的问题：

```text
1. 玩家 Actor 可能没有换，只是状态从 Dead 变回 Alive。
2. AI Perception 里仍然保存着这个 Actor 的 PerceptualData。
3. Sight 只看到“仍然可见”，没有产生从不可见到可见的边沿变化。
4. 项目战斗状态可能已经清了，但 Perception 缓存没有清。
```

最终表现就是：游戏逻辑认为玩家已经是一轮新的目标，但 Perception 认为这个 Actor 仍然是旧感知数据的一部分。

## 2. 源码入口

```text
Engine/Source/Runtime/AIModule/Private/Perception/
```

重点函数：

```text
UAIPerceptionComponent::ProcessStimuli
UAIPerceptionComponent::HandleExpiredStimulus
UAIPerceptionComponent::OnListenerUpdateImpl
UAIPerceptionSystem::Tick
UAISense_Sight::Update
UAISense_Sight::RegisterTarget
UAISense_Sight::OnNewListenerImpl
```

## 4. 调用链

典型感知刷新链路可以理解成：

```text
UAIPerceptionSystem::Tick
→ 各个 UAISense::Update
→ UAISense_Sight::Update
→ 生成 FAIStimulus
→ Listener.RegisterStimulus
→ UAIPerceptionComponent::ProcessStimuli
→ 更新 PerceptualData
→ 条件满足时广播 OnTargetPerceptionUpdated
```

其中最关键的是 `ProcessStimuli`。外部收到的感知回调不是 Sight 直接发的，而是 PerceptionComponent 在处理刺激队列后，根据感知数据变化决定是否广播。

## 5. 核心结论

### 5.1 Perception 不是“每帧看见就通知”

AI Perception 会缓存 Actor 的感知数据。对于同一个 Actor，如果系统认为它的感知状态没有发生关键变化，就不会一直重复广播。

因此死亡复活这种玩法状态变化，如果没有同步到 Perception 层，就可能不会触发新的感知事件。

### 5.2 死亡不是 Perception 的天然失效条件

玩家死亡通常是 Gameplay 状态：

```text
Health <= 0
Dead Tag
Disable Input
Play Death Montage
Collision / Visibility 变化
```

但 AI Perception 并不知道“死亡后这个目标应该被忘记”，除非项目主动做了这些事：

```text
ForgetActor
ForgetAll
Unregister StimuliSource
切换 Team / Affiliation
隐藏或禁用被感知组件
让 Sight 产生失败刺激
```

如果 Actor 仍然存在，仍然可见，Perception 可能继续保留旧数据。

### 5.3 复活要么重置感知缓存，要么让状态机不依赖边沿事件

解决方向有两类：

```text
方案 A：复活时重置 Perception 缓存
    适合希望 AI 把复活目标当成新目标处理。

方案 B：AI 状态机主动轮询当前目标有效性
    适合 Perception 只负责发现目标，战斗状态由项目系统维护。
```

项目里更稳的做法通常是两者结合：

```text
死亡时：
    清理仇恨 / 战斗目标
    必要时让感知组件 ForgetActor

复活时：
    重新注册或刷新 StimuliSource
    让 AI 状态机允许重新选择该玩家
```

## 6. 调试过程

调试 AI Perception 时，我会重点看这些数据：

```text
AIController 上的 UAIPerceptionComponent
PerceptualData 中是否还有玩家 Actor
玩家是否仍注册为 Sight Target / StimuliSource
OnTargetPerceptionUpdated 是否触发
Stimulus.WasSuccessfullySensed()
Stimulus.GetAge()
```

常用断点：

```text
UAISense_Sight::Update
UAIPerceptionComponent::ProcessStimuli
UAIPerceptionComponent::HandleExpiredStimulus
UAIPerceptionSystem::Tick
```

项目层断点：

```text
EnmityTrackerComponent 接收感知结果的位置
MonsterState_Combat / Warning / Search 的切换点
玩家死亡和复活逻辑
StimuliSource 注册和注销逻辑
```

## 7. 项目应用

### 7.1 死亡时清掉战斗语义

如果玩家死亡后，AI 还保留这个玩家作为战斗目标，会导致状态机误以为仍有有效敌人。项目层需要明确处理：

```text
玩家死亡
→ 清理 AI 仇恨目标
→ 清理黑板 TargetActor
→ 必要时 ForgetActor
```

### 7.2 复活时重新建立可感知关系

复活后如果希望 AI 重新发现玩家，不能只恢复血量。还要确认：

```text
Actor 没有被隐藏
Collision / Team / Affiliation 正确
StimuliSource 仍然注册
AI 的 PerceptionComponent 没有保留错误缓存
```

如果使用 `ForgetActor`，复活后下一次 Sight 成功刺激就更容易形成新的感知边沿。

### 7.3 自动跑测中的意义

自动跑测要求 AI 能稳定推进、战斗、补给、撤离。如果感知缓存没有清理，AI 可能出现：

```text
目标已经复活，但 AI 不重新进入战斗
目标已经死亡，但 AI 仍然追旧目标
黑板目标和感知数据不一致
```

因此跑测框架不能只看行为树是否在运行，还要记录感知目标、仇恨目标和黑板目标是否一致。

## 8. 踩坑

### 8.1 OnTargetPerceptionUpdated 不是完整状态源

它适合处理“边沿事件”，但不适合作为唯一真相。AI 当前是否应该攻击目标，还要结合：

```text
目标是否存活
是否可伤害
是否在任务阶段允许攻击
是否仍在仇恨系统里有效
```

### 8.2 ForgetActor 不是万能修复

`ForgetActor` 可以清掉缓存，但如果复活后 StimuliSource 没注册，或者目标被 Team/Affiliation 过滤了，AI 仍然不会重新感知。

### 8.3 死亡复活最好有明确事件

不要让 Perception 被动猜测玩法状态。更稳定的设计是：

```text
OnPlayerDeath
OnPlayerRevive
```

在这两个事件里同步处理仇恨、黑板和感知缓存。

## 9. 后续问题

- 多 AI 同时感知同一个复活玩家时，ForgetActor 应该由谁触发。
- 感知缓存清理是否要做成统一 GameplayState 事件。
- Perception 和团队阵营变化的刷新顺序如何保证。
