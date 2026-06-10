# UE AI Perception：死亡复活后感知为什么不刷新

## 1. 问题背景

角色死亡、复活后，如果 AI Perception 没有发生成功/失败状态变化，可能不会触发预期的感知更新。

## 2. 源码入口

```text
Engine/Source/Runtime/AIModule/Private/Perception/
```

重点函数：

```text
UAIPerceptionComponent::ProcessStimuli
UAISense_Sight::Update
```

## 3. 待整理问题

- Stimulus 如何进入队列。
- PerceptualData 保存什么。
- bRequiresUpdate 什么时候为 true。
- 死亡复活时是否需要 ForgetActor 或重新注册 StimuliSource。