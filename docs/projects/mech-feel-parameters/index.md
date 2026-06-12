# 机甲手感参数

## 1. 问题背景

机甲手感不是单个速度参数决定的。玩家感受到的是输入响应、加速、减速、转向、瞄准、镜头、动画、武器反馈、受击反馈和网络延迟的综合结果。如果只调 `MaxWalkSpeed`，很容易出现“速度对了但不重”“转向飘”“瞄准割裂”“冲刺没有爆发力”的问题。

## 2. 参数分类

机甲手感可以拆成六类：

```text
移动参数
转向参数
镜头参数
武器参数
动画参数
反馈参数
```

每类参数都要明确影响范围，避免一个参数同时控制多个体验。

## 3. 移动参数

核心参数：

```text
WalkSpeed
RunSpeed
SprintSpeed
Acceleration
BrakingDeceleration
GroundFriction
AirControl
GravityScale
DashDistance
DashDuration
```

调参顺序：

```text
先定最大速度
→ 再定加速时间
→ 再定刹停距离
→ 再定转向半径
→ 最后配动画和镜头
```

机甲通常需要比人形角色更强的重量感，所以加速和刹停不宜过于瞬时。但战斗游戏又需要响应明确，因此可以用“输入响应快、速度变化有惯性”的方式平衡。

## 4. 转向参数

转向不是简单设置 ActorRotation：

```text
YawTurnSpeed
AimTurnSpeed
SprintTurnSpeed
FlightTurnSpeed
DashYawTurnSpeed
RotationInterpSpeed
```

地面普通移动可以允许较快转向；冲刺和飞行要限制转向，体现重量和惯性；瞄准状态通常需要角色朝向跟随准星，但移动速度和转向速度降低。

## 5. 镜头参数

镜头决定玩家对速度和重量的感知：

```text
FOV
CameraLag
CameraRotationLag
SprintFOV
DashShake
FireShake
HitShake
AimOffset
CameraDistance
```

冲刺可以轻微增加 FOV 和镜头后拉；开火可以加小幅 shake；受击可以按方向做 impulse。镜头反馈要可控，不能影响瞄准清晰度。

## 6. 武器反馈参数

```text
FireRate
RecoilPitch
RecoilYaw
Spread
RecoverySpeed
ProjectileSpeed
MuzzleFlashScale
HitStop
HitShake
```

手炮、机枪、导弹、近战武器应该有不同反馈。重武器需要更明显的前摇、后坐、镜头震动和音效低频；轻武器需要更高响应和持续反馈。

## 7. 动画参数

动画影响“看起来是否跟输入一致”：

```text
Start / Stop 动画
Turn In Place
RootYawOffset
AimOffset
UpperBody Slot
Layered Blend per Bone
Flight Pose
Dash Pose
```

如果移动组件已经转向，但动画上半身还停在旧方向，玩家会感觉输入延迟。瞄准、开火、移动要统一角色朝向、控制器朝向和动画 AimOffset。

## 8. 推荐调参方法

不要直接在复杂关卡里调。先做标准测试场：

```text
直线 50m 加速
急停测试
90 度转向测试
冲刺距离测试
瞄准移动测试
开火后坐测试
飞行上升下降测试
网络延迟模拟测试
```

每次只改一类参数，记录改前改后的距离、时间和体感。

## 9. 自动跑测结合

机甲项目可以把手感参数和 AI 自动跑测结合：

```text
跑到目标点耗时
转向平均角速度
卡住次数
冲刺使用次数
瞄准状态移动误差
弹药命中率
受击后恢复时间
撤离点到达率
```

这些数据不能替代人工手感，但能发现明显的参数异常。

## 10. 配置建议

建议把参数按状态分组：

```text
Ground
Sprint
Aim
Dash
Flight
FlightSprint
Weapon
Camera
Animation
```

每个参数要有默认值、最小值、最大值和说明。不要让策划只能看到一堆没有单位的 float。

## 11. 踩坑

只调速度不调加速度，会让角色像滑块。

只调移动不调镜头，会让冲刺缺少速度感。

只调武器后坐不调恢复，会让连续射击难以控制。

动画和移动不同步，会让玩家觉得输入延迟。

网络预测没处理好，会让手感在本地和联机完全不同。

## 12. 结论

机甲手感是移动、转向、镜头、武器、动画和反馈共同作用的结果。调参应该先拆状态，再建立标准测试场，最后结合自动跑测和人工体验迭代。好的参数体系要能解释“为什么这样调”，而不是只保存一组数值。

