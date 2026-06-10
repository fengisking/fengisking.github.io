# 行为树技能释放次数控制：Decorator + Component 设计

## 1. 设计目标

为 AI 行为树增加一套按 AbilityTag 记录技能释放次数的机制。

## 2. 设计结构

```text
SkillUseCountComponent
Decorator_CanUseAbilityByCount
UseAbilityWithTag 成功后记录 +1
BTTask_ResetSkillUseCount
```

## 3. 原则

- 不新增 Blackboard Key。
- Decorator 只判断，不修改。
- UseAbilityWithTag 不判断 Count，只在释放成功后记录。
- Reset 节点单独负责移除多个 Tag。