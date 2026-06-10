# 机甲 PVE AI 自动跑测设计

## 1. 项目背景

项目目标是让 AI 像玩家一样在 PCG 地图中完成一局 PVE 流程：

```text
出生
→ 寻找 POI
→ 移动到目标区域
→ 清理敌人和虫穴
→ 弹药不足时补给
→ POI 全完成后撤离
→ 开启撤离、守圈、登机
```

这套系统不是为了做最终玩家可见的机器人队友，而是为了自动跑测 Gameplay 闭环。它要能在大量 Seed、地图组合和战斗配置里跑起来，暴露卡点、资源不足、目标丢失、撤离失败等问题。

## 2. 问题本质

第一性原理拆开看，自动跑测 AI 需要解决四件事：

```text
1. 知道当前世界发生了什么。
2. 判断当前最应该做什么。
3. 把判断转成玩家可执行的输入或 Action。
4. 失败时能恢复，并留下可复现信息。
```

所以系统不能只写一个 Behavior Tree 节点，也不能只写一个“自动寻路”。它需要一个闭环：

```text
上下文采样
→ Utility 评分
→ PlayerAction 执行
→ 执行反馈
→ 重新采样和修正
```

## 2. 核心模块

```text
PlayerContextManager
UtilityEvaluatorComponent
Action 注入系统
MoveAction / ShootAction / InteractAction / SkillAction / ReloadAction / LookAction
```

## 3. 架构设计

### 3.1 PlayerContextManager：低频战场快照

`PlayerContextManager` 负责把场景信息整理成每个玩家的战术上下文：

```text
玩家状态：
    位置、血量、耐力、是否存活、是否换弹

武器状态：
    当前弹匣、备弹、弹药类型、是否激活

技能状态：
    技能槽是否装备、是否可用、是否能打虫穴

POI 状态：
    当前锁定 POI、是否到达、POI 半径、虫穴目标

敌人状态：
    相关敌人、最近敌人、最佳攻击目标、飞行怪威胁

撤离状态：
    撤离点、交互点、登机点、是否进入撤离圈
```

它不直接执行行为，只提供稳定输入。这样 Utility 层可以专注“选行为”，而不是每个候选都重新扫一遍世界。

### 3.2 UtilityEvaluatorComponent：行为评分和通道选择

`UtilityEvaluatorComponent` 根据上下文生成候选：

```text
MoveToTarget
MoveToExtraction
SupplyAmmo
ShootTarget
Skill1 / Skill2
Reload
KeepDistance
FollowLeader
BoardExtraction
InteractExtraction
```

候选有分数、原因、目标 Actor、目标位置、移动完成半径和移动风格。最终按通道选择：

```text
移动通道：
    移动、补给、撤离、后退、跟随

攻击通道：
    射击、技能、换弹、交互、登机
```

这样 AI 可以一边移动一边射击，但不会同时提交多个互相覆盖输入的移动 Action。

### 3.3 PlayerAction：复用玩家输入语义

底层不直接调用“怪物 AI 移动”，而是复用玩家 Action：

```text
MoveAction：
    模拟移动输入，支持 NavMesh 路径、飞行、冲刺、动态超时和卡住恢复。

ShootAction：
    按当前武器和目标执行持续射击。

SkillAction：
    触发技能槽输入。

ReloadAction：
    触发换弹输入。

LookAction：
    控制视角朝向目标。
```

这让自动跑测更接近真实玩家路径：它测到的问题更可能是玩家也会遇到的问题，而不是 AI 专用接口绕过后的假结果。

## 4. 核心流程

```text
Tick
→ UtilityEvaluator 定时刷新
→ 从 PlayerContextManager 读取当前玩家 Context
→ GenerateCandidates
→ SelectExecutableCandidates
→ CreateActionForCandidate
→ ActionExecutor 执行
→ UpdateCurrentActionFeedback
→ 失败时刷新 Context 并重新评估
```

普通推进阶段：

```text
未到 POI：
    MoveToLockedPOI

到达 POI：
    有近身威胁 → KeepDistance / ShootTarget
    有虫穴目标 → ShootTarget / Skill
    无直接目标 → POICombatSlot 站位
```

撤离阶段：

```text
POI 全完成或弹药无法支撑
→ MoveToExtraction
→ InteractExtraction
→ ExtractDefend
→ ExtractionDefenseSlot
→ BoardExtraction
```

补给阶段：

```text
无弹：
    高分补给，优先找弹药箱或补给 POI

低总弹药且不在强战斗：
    主动补给，但分数低于关键战斗和撤离行为

撤离防守：
    只有临界低弹且补给点在撤离圈内才允许补给
```

## 5. 稳定性设计

### 5.1 移动超时

移动 Action 按目标距离估算动态超时：

```text
Timeout = Distance / ExpectedSpeed + Buffer
```

并限制在最小和最大时间之间。这样近距离目标不会一启动就超时，远距离目标也不会无限占用执行通道。

### 5.2 卡住检测

移动过程中定期检查“到目标距离是否减少”：

```text
SoftStuck：
    短时间无进展，先尝试内部恢复。

HardStuck：
    长时间无进展，向 Utility 反馈失败。
```

Utility 收到 HardStuck 后会记录目标失败次数，必要时临时黑名单非关键目标。撤离点是硬目标，不允许真正放弃。

### 5.3 硬卡住后的飞行脱困

如果同一目标刚发生 HardStuck，下一次候选可以生成短促 `HardStuckFlyEscape`：

```text
进入飞行
→ 朝目标方向移动一小段时间
→ 重新评估普通移动路径
```

这对 PCG 地图里局部障碍、坡度、窄通道非常有用。

### 5.4 目标失败和黑名单

非撤离目标连续失败多次后进入临时黑名单：

```text
MoveTargetFailCountMap
MoveTargetBlacklistExpireTimeMap
```

黑名单是临时降级，不是永久删除。过期后目标重新参与候选，避免一次导航失败导致任务永远不做。

## 6. 人味行为设计

自动跑测不是只要“能跑完”，还要尽量模拟玩家行为，否则测试覆盖会偏。

### 6.1 移动风格

候选会根据距离、耐力和周围敌人决定移动风格：

```text
Run：
    普通距离或战斗压力下移动。

Sprint：
    长距离、耐力充足、周围没有近身敌人。

Fly：
    超远距离、耐力充足，或硬卡住后尝试绕障。
```

### 6.2 队伍站位

撤离防守和 POI 战斗会按队伍下标分配槽位：

```text
TeamIndex
TeamAliveCount
```

每个玩家落在同一圆周的不同角度，避免所有 AI 挤到同一个点。

### 6.3 技能使用

技能不只是“CD 好了就放”。评分会考虑：

```text
虫穴目标
撤离防守压力
当前是否无弹
是否已经穿插过足够射击
```

这样技能更像玩家在关键目标或压力场景下使用，而不是机械轮转。

## 7. 调试和输出

跑测最重要的是复现。需要记录：

```text
地图 Seed
当前任务阶段
当前 POI / 撤离点
玩家位置
当前候选列表
最终选中候选
Action 成功/失败
失败原因
目标 Actor
目标坐标
移动卡住时间
黑名单状态
```

典型日志形态：

```text
[Utility] Select MoveToTarget Reason=MoveToLockedPOI Score=65 Target=POI_A
[MoveStability] Reason=HardStuckNoProgress Target=POI_A FailCount=1
[Utility] Select MoveToExtraction Reason=ReturnToExtractionArea Score=160
```

## 8. 项目收益

这套自动跑测能覆盖人工测试很难稳定覆盖的问题：

```text
PCG 地图某个 Seed 导航卡死
某个 POI 半径配置错误
补给点没有有效弹药箱
撤离交互点不可达
登机 Actor 没有正确刷新
飞行怪导致 AI 长时间不攻击
虫穴目标和敌人威胁优先级冲突
```

它不是替代 QA，而是把大量重复、长流程、容易遗漏的测试变成可批量执行的基础设施。

## 9. 踩坑

### 9.1 不能只靠 Behavior Tree

Behavior Tree 适合表达明确状态机，但自动跑测会遇到大量动态权衡：

```text
战斗 vs 补给
补给 vs 撤离
射击 vs 技能
后退 vs 继续赶路
```

这些更适合 Utility 评分，而不是在树上堆大量 Selector。

### 9.2 Context 刷新不能太频繁

全量扫场景很贵。ContextManager 用低频刷新，Action 反馈和近身距离则用实时坐标补充。这样既能减少开销，又能保证近身威胁反应不滞后。

### 9.3 撤离目标不能被普通黑名单处理

普通 POI 或敌人可以临时放弃，但撤离点不能。否则 AI 在最终阶段可能因为一次导航失败永远不撤离。

### 9.4 补给不能在所有阶段都抢占

无弹补给很重要，但撤离登机阶段更重要。补给逻辑必须按任务阶段限制，否则 AI 会在该登机时转头找弹药箱。

## 10. 后续计划

- 把候选列表和 Action 反馈输出成结构化 JSON。
- 给每次失败保存地图 Seed、位置和目标 Actor 名称。
- 增加跑测批处理入口，支持连续执行多个 PCG Seed。
- 增加可视化回放，把移动路径、失败点和目标选择画在地图上。
