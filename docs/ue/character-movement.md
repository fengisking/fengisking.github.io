# UE CharacterMovement 源码阅读：MaxWalkSpeed 到底在哪里生效

## 1. 问题背景

在做角色或机甲 3C 时，经常会设置：

```cpp
CharacterMovement->MaxWalkSpeed = 900.f;
```

它的含义是角色在 Walking 移动模式下理论最大水平速度为 900 cm/s，也就是 9 m/s。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Classes/GameFramework/CharacterMovementComponent.h
Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp
```

重点函数：

```text
UCharacterMovementComponent::TickComponent
UCharacterMovementComponent::PerformMovement
UCharacterMovementComponent::StartNewPhysics
UCharacterMovementComponent::PhysWalking
UCharacterMovementComponent::CalcVelocity
```

## 3. 调用链

```text
TickComponent
→ PerformMovement
→ StartNewPhysics
→ PhysWalking
→ CalcVelocity
```

## 4. 后续待补充

- MaxAcceleration 如何影响加速。
- BrakingDecelerationWalking 如何影响刹车。
- GroundFriction 如何影响速度。
- 网络同步中速度如何被预测和校正。