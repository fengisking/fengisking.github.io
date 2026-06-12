# Unreal Insights 如何 Profile

## 1. 问题背景

Unreal Insights 是 UE 的性能分析工具，可以查看 CPU、线程、任务、加载、网络、内存等 Trace 数据。它比简单 `stat unit` 更适合定位“哪一段代码慢、哪个线程卡、哪个任务排队、哪个资源加载耗时”。

![Insights 阅读视图](./image/insights-reading-map.svg)

## 2. 工具入口

常见入口：

```text
Engine/Binaries/Win64/UnrealInsights.exe
Trace 运行时模块
Insights Session Browser
Timing Insights
Memory Insights
Networking Insights
Loading Insights
```

源码路径：

```text
Engine/Source/Developer/TraceInsights
Engine/Source/Runtime/TraceLog
Engine/Source/Runtime/Core/Public/ProfilingDebugging
```

## 3. 如何采集

编辑器或游戏启动参数：

```bat
MyGame.exe -trace=cpu,frame,bookmark,loadtime,file,net -statnamedevents
```

常用频道：

```text
cpu        CPU 事件
frame      帧事件
bookmark   书签
loadtime   加载耗时
file       文件 IO
net        网络
memory     内存
gpu        GPU，取决于平台和配置
```

如果要分析 C++ 自定义代码，可以加：

```cpp
TRACE_CPUPROFILER_EVENT_SCOPE(MySystem_Update);
```

## 4. Timing Insights 看什么

主要看：

```text
GameThread
RenderThread
RHIThread
TaskGraph Workers
Frame Time
CPU Event
Wait
Async Loading
```

阅读顺序：

```text
先看帧尖峰
→ 找最慢线程
→ 展开该线程最长事件
→ 看是否等待其他线程
→ 看 TaskGraph 是否排队
→ 回到源码定位函数
```

## 5. 常见性能参数

```text
Frame Time       总帧耗时
Game Thread      玩法线程耗时
Render Thread    渲染线程耗时
RHI Thread       RHI 提交耗时
GPU Time         GPU 耗时
Task Wait        等待任务完成
Load Time        资源加载耗时
File IO          文件读取耗时
Net Send/Recv    网络收发
Memory Alloc     内存分配
```

如果 GameThread 高，优先看 Gameplay Tick、AI、动画更新、蓝图、碰撞查询。RenderThread 高，优先看 draw call、阴影、可见性、后处理。GPU 高，需要结合 RenderDoc、ProfileGPU 或 GPU Visualizer。

## 6. 典型分析流程

```text
打开 trace
→ 找到问题帧
→ 框选一段慢帧
→ Sort by Duration
→ 找最大事件
→ 展开调用层级
→ 搜索函数名
→ 回到源码加更细 TRACE_SCOPE
→ 复测
```

性能优化不要只看平均值。尖峰、P95、P99 更影响玩家感受。

## 7. 加 Bookmark

可以在关键流程加书签：

```cpp
TRACE_BOOKMARK(TEXT("Start Spawn Wave"));
```

这样在 Insights 时间线上能快速定位“刷怪开始”“关卡切换”“技能释放”“战斗爆发”等业务事件。

## 8. DS 分析

Dedicated Server 不渲染，但可以看：

```text
GameThread Tick
AI Tick
BehaviorTree
Navigation
Physics
Replication
RPC
Net Serialize
Actor Channel
```

DS 优化时要重点看网络和 AI，而不是渲染。

## 9. 踩坑

`stat unit` 只能告诉你哪个大线程慢，Insights 才能告诉你慢在哪里。

没有 `-statnamedevents` 时，很多事件名不够清晰。

Trace 本身有开销，正式环境采集要控制频道和时长。

## 10. 结论

Unreal Insights 的核心用法是从慢帧出发，定位线程，再定位事件，再回到源码。项目里应该给关键系统加 `TRACE_CPUPROFILER_EVENT_SCOPE` 和 Bookmark，把性能问题从感觉变成可追踪证据。

