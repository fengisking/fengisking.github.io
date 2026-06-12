# Animation 详解

## 1. UE 动画包含哪些方面

UE 动画系统不只是 Animation Blueprint。完整动画链路包括：

```text
Skeleton / SkeletalMesh
Animation Sequence
BlendSpace
Animation Blueprint
AnimGraph
State Machine
Montage
Slot
Layered Blend per Bone
AimOffset
Control Rig
IK
Root Motion
Motion Warping
Animation Notify
Linked Anim Graph / Anim Layer
```

学习动画要同时理解数据、图节点、运行时更新、姿态求值和 Gameplay 驱动。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Classes/Animation/AnimInstance.h
Engine/Source/Runtime/Engine/Private/Animation/AnimInstance.cpp
Engine/Source/Runtime/Engine/Public/Animation/AnimNodeBase.h
Engine/Source/Runtime/Engine/Private/Animation/AnimNodeBase.cpp
Engine/Source/Runtime/AnimGraphRuntime/Public
Engine/Source/Runtime/AnimGraphRuntime/Private
Engine/Source/Runtime/Engine/Classes/Animation/AnimMontage.h
Engine/Source/Runtime/Engine/Private/Animation/AnimMontage.cpp
```

## 3. AnimGraph Update / Evaluate 流程

动画运行大体分为 Update 和 Evaluate。

```text
USkeletalMeshComponent::TickComponent
→ TickAnimation
→ UAnimInstance::UpdateAnimation
→ NativeUpdateAnimation / BlueprintUpdateAnimation
→ AnimGraph Update
→ Parallel Animation Evaluation
→ AnimGraph Evaluate
→ 输出最终 Pose
→ 骨骼矩阵刷新
```

Update 阶段更新权重、时间、状态机转换、BlendSpace 参数。Evaluate 阶段真正计算姿态。这个分离是为了并行评估和性能优化。

## 4. State Machine

State Machine 负责基础状态切换，比如 Idle、Walk、Run、Jump、Fall。它本质是根据条件选择当前状态，并更新状态内部动画时间。

状态机适合连续状态，不适合所有一次性动作。攻击、换弹、受击通常更适合 Montage。

## 5. Montage Slot 怎么覆盖基础姿态

Montage 不是直接替换整个 AnimGraph，而是通过 Slot 节点插入到 AnimGraph 某个位置。

调用链：

```text
UAnimInstance::Montage_Play
→ 创建或更新 FAnimMontageInstance
→ Montage Tick 更新播放时间和权重
→ AnimGraph 运行到 Slot 节点
→ Slot 节点读取该 Slot 上的 Montage 姿态
→ 按权重覆盖或混合基础姿态
```

如果 AnimGraph 里没有对应 Slot 节点，Montage 播放了也不会影响最终姿态。

## 6. Layered Blend per Bone 如何实现局部叠加

`Layered Blend per Bone` 用骨骼分支过滤实现局部姿态混合。它先计算 Base Pose，再计算 Blend Pose，然后根据骨骼权重表决定每根骨骼用哪个姿态或混合多少。

典型用途：

```text
下半身跑步
上半身开枪
头部 AimOffset
受击局部动画
手臂换弹叠加
```

关键点是骨骼层级。比如从 `spine_01` 开始叠加，会影响它的所有子骨骼。配置错骨骼会导致全身被覆盖或局部不生效。

## 7. AimOffset 本质是什么

AimOffset 本质是一个按 Pitch / Yaw 参数采样的姿态 BlendSpace。它不是魔法瞄准系统，而是把多个方向的瞄准姿态按输入角度混合。

流程：

```text
计算角色朝向和控制器朝向差值
→ 得到 AimYaw / AimPitch
→ AimOffset 根据二维参数采样姿态
→ 通常通过 Layered Blend per Bone 叠到上半身
```

如果角色 ActorRotation、ControlRotation、Mesh 空间关系不清楚，AimOffset 很容易抖或反向。

## 8. Root Motion

Root Motion 是动画驱动位移。常见流程：

```text
AnimSequence 提取 Root Motion
→ AnimInstance 累积 RootMotion
→ CharacterMovement 消费 RootMotion
→ 转成移动组件位移
```

Root Motion 的优势是动作位移和动画一致；问题是网络同步、自定义移动和碰撞处理更复杂。

## 9. 如何深入学习

建议按这个顺序：

1. 先理解 Skeleton、SkeletalMesh、AnimSequence。
2. 再理解 AnimInstance Tick、Update、Evaluate。
3. 学 StateMachine 和 BlendSpace。
4. 学 Montage、Slot、Notify。
5. 学 Layered Blend per Bone、AimOffset。
6. 学 Root Motion、Motion Warping、IK。
7. 最后看并行动画、线程安全、性能分析。

## 10. 性能优化

```text
减少复杂 AnimGraph 节点数量
使用 Update Rate Optimization
远距离角色降低动画 Tick
避免每帧 Blueprint 做重逻辑
使用 Linked Anim Graph 拆分复杂图
减少高频曲线和 Notify 成本
LOD 下关闭 IK、物理、修正节点
```

## 11. 项目应用

机甲项目里常见动画需求：

```text
移动基础姿态
瞄准上半身叠加
武器开火 Montage
飞行姿态和地面姿态切换
受击和硬直
手炮/枪械不同持姿
RootYawOffset 或 TurnInPlace
```

这些不要全部塞进一个状态机。基础移动用状态机，一次性动作用 Montage，上半身覆盖用 Slot 和 Layered Blend per Bone，瞄准用 AimOffset。

## 12. 结论

UE 动画系统的核心是“Update 计算状态，Evaluate 计算姿态”。Montage 通过 Slot 接入 AnimGraph，Layered Blend per Bone 通过骨骼权重做局部叠加，AimOffset 本质是姿态 BlendSpace。深入学习时要把 Gameplay 状态、控制器朝向、角色朝向和最终姿态放在同一条链路里理解。

