# UE 的 GC 详解

## 1. 问题背景

UE 的 UObject 不使用普通 C++ 的 `delete` 管理生命周期，而是由 UObject 系统统一分配、注册和垃圾回收。GC 的目标是自动清理不再可达的 UObject，同时保证编辑器、蓝图、资源加载、网络复制、序列化和异步加载都能安全协作。

理解 GC 的关键不是背 API，而是理解“可达性”。只要一个 UObject 能从 Root、当前世界、反射属性、AddReferencedObjects 或 Cluster 链路被找到，它就不会被回收。

## 2. 源码入口

常见源码路径：

```text
Engine/Source/Runtime/CoreUObject/Public/UObject/UObjectArray.h
Engine/Source/Runtime/CoreUObject/Public/UObject/GarbageCollection.h
Engine/Source/Runtime/CoreUObject/Private/UObject/GarbageCollection.cpp
Engine/Source/Runtime/CoreUObject/Private/UObject/UObjectArray.cpp
Engine/Source/Runtime/CoreUObject/Public/UObject/ObjectMacros.h
Engine/Source/Runtime/CoreUObject/Public/UObject/WeakObjectPtr.h
```

核心类型：

```text
FUObjectArray
FUObjectItem
FGCObject
FReferenceCollector
FWeakObjectPtr
UObjectBase
UObject
```

## 3. GC 总流程

一次 GC 可以简化成：

```text
触发 CollectGarbage
→ 标记所有候选 UObject
→ 从 Root 集合开始遍历引用
→ 通过 UPROPERTY / AddReferencedObjects / Cluster 找到可达对象
→ 不可达对象进入 PendingKill / BeginDestroy
→ 等异步资源和引用释放
→ FinishDestroy
→ 释放内存
```

典型调用链：

```text
CollectGarbage
→ CollectGarbageInternal
→ MarkObjectsAsUnreachable
→ ReachabilityAnalysis
→ GatherUnreachableObjects
→ UnhashUnreachableObjects
→ IncrementalDestroyGarbage
→ UObject::BeginDestroy
→ UObject::FinishDestroy
```

具体函数名会随版本调整，但阶段不变：标记、可达性分析、不可达收集、销毁。

## 4. 可达性从哪里来

GC 扫描引用主要来自四类：

```text
Root Set
UPROPERTY 反射属性
AddReferencedObjects 手动上报
Cluster 引用簇
```

Root Set 里的对象永远作为起点，例如引擎对象、加载中的 Package、显式 `AddToRoot` 的对象。

`UPROPERTY()` 是最常见的引用来源：

```cpp
UPROPERTY()
UObject* Target;
```

UHT 会生成属性元数据，GC 通过 `FObjectProperty` 知道这个字段里有 UObject 引用。

非 UObject 类型如果想持有 UObject，需要通过 `FGCObject::AddReferencedObjects` 手动告诉 GC：

```cpp
void FMyHolder::AddReferencedObjects(FReferenceCollector& Collector)
{
    Collector.AddReferencedObject(Target);
}
```

## 5. GC 策略和算法

UE GC 本质上是标记清除。它不是引用计数。引用计数在循环引用里容易失效，而 UObject 之间经常有复杂图结构，比如 Actor、Component、Asset、Blueprint、World、Package。

基本策略：

```text
Mark：先假设对象不可达
Trace：从 Root 出发遍历引用图
Sweep：没有被标记为可达的对象进入销毁流程
```

为了优化大型项目，UE 还有 Cluster。Cluster 可以把一批生命周期强相关的对象作为一个引用簇处理，减少逐个对象遍历成本。典型场景是 Actor 和它的 Component、资源内部对象等。

## 6. UObject 生命周期

对象创建：

```text
NewObject
→ StaticConstructObject_Internal
→ StaticAllocateObject
→ 构造 UObject
→ PostInitProperties
```

对象销毁：

```text
MarkPendingKill / 不可达
→ BeginDestroy
→ 等待资源释放或异步操作完成
→ IsReadyForFinishDestroy
→ FinishDestroy
→ 内存释放
```

不要在 `BeginDestroy` 里假设所有引用都还有效，也不要在析构函数里写复杂 Gameplay 逻辑。Gameplay 层更适合在 `EndPlay`、`OnDestroyed`、组件反注册时释放关系。

## 7. 为什么不能随便用 shared_ptr 管 UObject

`TSharedPtr` / `TSharedRef` 是 C++ 引用计数智能指针，适合管理非 UObject 的普通 C++ 对象。UObject 已经由 UObject 系统管理生命周期，GC 不会因为 `TSharedPtr<UObject>` 的引用计数而认为对象可达。

问题包括：

```text
GC 不认识 shared_ptr 内部引用
shared_ptr 删除器可能和 UObject 销毁流程冲突
UObject 可能被 GC 回收后 shared_ptr 仍以为自己有效
循环引用和 UObject 引用图不在同一套系统
```

正确方式：

```text
强引用：UPROPERTY() TObjectPtr<UObject>
弱引用：TWeakObjectPtr<UObject>
软引用：TSoftObjectPtr<UObject>
临时裸指针：仅限短生命周期，不持久保存
非 UObject 对象：TSharedPtr / TSharedRef
```

## 8. 常见引用类型

`TObjectPtr` 是 UE5 推荐的 UObject 成员指针包装。它仍然依赖 `UPROPERTY` 进入 GC 扫描。

`TWeakObjectPtr` 不阻止 GC，只能安全判断对象是否还有效。

`TSoftObjectPtr` 保存资源路径，适合异步加载和降低硬引用。

`TStrongObjectPtr` 可以在非 UObject 作用域里临时强持有 UObject，但要谨慎控制生命周期。

## 9. 项目应用

项目里排查 UObject 生命周期问题时，优先检查：

```text
长期成员引用是否有 UPROPERTY
非 UObject 容器是否实现 AddReferencedObjects
异步回调里是否使用 TWeakObjectPtr
Actor Destroy 后是否仍被定时器、Delegate、Lambda 捕获
资源软引用是否在使用前 Load
```

## 10. 踩坑

`IsValid(Object)` 不等于对象业务状态正常，它只是检查指针和 PendingKill 等基础状态。

`AddToRoot` 可以阻止 GC，但滥用会造成泄漏。它适合少量全局对象，不适合 Gameplay 临时对象。

`UPROPERTY` 不是万能。容器、结构体、数组、Map 里的 UObject 引用也需要类型本身能被反射系统正确识别。

## 11. 结论

UE GC 的核心是反射驱动的可达性分析。UObject 的生命周期由 UObject 系统和 GC 管理，普通 C++ 智能指针不能替代这套机制。写 Gameplay 代码时，要明确强引用、弱引用、软引用和临时引用的边界。

