# 机甲 PVE AI 自动跑测设计

## 1. 项目背景

目标是让 AI 像玩家一样在 PCG 地图中自动寻找 POI、战斗、补给、撤离，并输出跑测结果。

## 2. 核心模块

```text
PlayerContextManager
UtilityEvaluatorComponent
Action 注入系统
MoveAction / ShootAction / InteractAction / SkillAction / ReloadAction / LookAction
```

## 3. 后续整理

- 自动跑测框架如何插件化。
- 如何记录失败原因。
- 如何输出 Seed、坐标、行为状态和复现报告。