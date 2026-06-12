# UE 反射详解

## 1. 问题背景

UE 的反射系统解决的是 C++ 原生语言缺失运行时类型信息、属性遍历、序列化、编辑器暴露、蓝图调用、网络复制、GC 引用发现等能力的问题。普通 C++ 的类在编译后基本只剩机器码，运行时无法直接知道一个对象有哪些属性、某个函数能不能被名字调用、某个属性是否应该保存到磁盘。UE 通过 UHT 和 generated 代码，在 C++ 编译前生成一套元数据，把类型信息保存到 `UClass`、`FProperty`、`UFunction` 等对象里。

## 2. 核心概念

反射系统的核心对象：

```text
UObject    所有可反射对象的基类
UClass     记录一个 UObject 类的元信息
UStruct    记录结构体或类的字段、函数、继承关系
FProperty  记录属性类型、偏移、标记、序列化规则
UFunction  记录函数参数、返回值、调用方式
UPackage   组织反射对象和资源对象
```

常见宏的作用：

```text
UCLASS     标记类需要进入反射系统
USTRUCT    标记结构体需要反射
UENUM      标记枚举需要反射
UPROPERTY  标记字段需要元数据、序列化、GC、编辑器或网络处理
UFUNCTION  标记函数需要反射调用、RPC、蓝图或编辑器处理
GENERATED_BODY 插入 UHT 生成的 glue code
```

## 3. 源码入口

主要源码路径：

```text
Engine/Source/Runtime/CoreUObject/Public/UObject/Object.h
Engine/Source/Runtime/CoreUObject/Public/UObject/Class.h
Engine/Source/Runtime/CoreUObject/Public/UObject/UObjectGlobals.h
Engine/Source/Runtime/CoreUObject/Private/UObject/Class.cpp
Engine/Source/Runtime/CoreUObject/Private/UObject/UObjectGlobals.cpp
Engine/Source/Runtime/CoreUObject/Private/UObject/Obj.cpp
Engine/Source/Programs/UnrealHeaderTool/
```

UHT 相关路径：

```text
Engine/Source/Programs/UnrealHeaderTool/Private
Engine/Source/Programs/UnrealHeaderTool/Private/ParserClass.cpp
Engine/Source/Programs/UnrealHeaderTool/Private/UhtHeaderFileParser.cpp
Engine/Source/Programs/UnrealHeaderTool/Private/CodeGenerator.cpp
```

不同引擎版本文件名会变化，但模块边界基本稳定：运行时反射在 `CoreUObject`，代码生成在 `UnrealHeaderTool`。

## 4. UHT 是什么

UHT，全称 Unreal Header Tool，是 UE 编译链里的头文件扫描和代码生成工具。它不是 C++ 编译器，而是 UE 自己的预处理工具。它读取带有 `UCLASS`、`UPROPERTY`、`UFUNCTION` 等宏的头文件，解析出 UE 关心的类型和元数据，然后生成 `.generated.h` 和 `.gen.cpp`。

典型构建链：

```text
UBT 读取 Target.cs / Build.cs
→ 判断哪些模块需要运行 UHT
→ UHT 扫描头文件里的 UCLASS / USTRUCT / UENUM / UFUNCTION / UPROPERTY
→ 生成 *.generated.h 和 *.gen.cpp
→ C++ 编译器编译原始 cpp + 生成 cpp
→ 模块加载时注册 UClass / FProperty / UFunction
```

## 5. `.generated.h` 的作用

`.generated.h` 是 UHT 生成的头文件，通常必须放在用户头文件 include 的最后。它会插入：

```text
类声明辅助代码
StaticClass 声明
反射注册声明
序列化声明
RPC wrapper 声明
构造器辅助宏
属性偏移和访问辅助
```

例如你写：

```cpp
UCLASS()
class AMyActor : public AActor
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere)
    int32 Health;
};
```

UHT 会生成一批和 `AMyActor` 相关的注册代码，把 `Health` 变成一个 `FIntProperty`，并记录它在对象内存里的偏移、编辑器标记、序列化标记等。

## 6. `.gen.cpp` 做了什么

`.gen.cpp` 会生成真正用于注册反射对象的代码。核心是构造类似这样的数据：

```text
类名
父类
ClassFlags
属性数组
函数数组
元数据 key-value
构造函数指针
依赖对象
```

模块加载时，这些注册函数会把类型信息注册到全局对象系统。之后 `StaticClass()`、`FindObject<UClass>()`、蓝图调用、属性面板、序列化、复制系统都能通过这些元数据工作。

## 7. 反射对象如何被创建

运行时对象创建入口常见是：

```text
NewObject<T>
→ StaticConstructObject_Internal
→ StaticAllocateObject
→ UObject 构造
→ FObjectInitializer 初始化默认子对象和属性
→ PostInitProperties
```

类对象本身也会被注册：

```text
Z_Construct_UClass_AMyActor
→ UECodeGen_Private::ConstructUClass
→ 构造 UClass
→ 绑定属性和函数
→ 链接父类、接口、元数据
```

## 8. 序列化是什么

序列化是把对象状态转换成可存储或可传输的数据，再反向恢复。UE 里的序列化不仅用于保存资源，也用于加载资源、复制、Undo、Cook、热重载和编辑器事务。

核心接口是：

```text
UObject::Serialize(FArchive& Ar)
FProperty::SerializeItem
FArchive
FStructuredArchive
```

调用链可以理解为：

```text
加载 Package
→ 创建 UObject
→ UObject::Serialize
→ 遍历反射属性
→ FProperty 根据类型读写数据
→ 修复对象引用
→ PostLoad
```

反射让序列化不需要每个类都手写全部字段。只要字段有 `UPROPERTY`，引擎就知道这个字段的位置、类型和标记，能自动参与保存、加载、复制和 GC 引用收集。

## 9. 反射和 GC 的关系

GC 需要知道一个 UObject 引用了哪些 UObject。普通 C++ 指针引擎看不到，但 `UPROPERTY()` 标记的 UObject 指针会生成 `FObjectProperty`，GC 可以通过 `UClass` 的属性链遍历引用。

这也是为什么 UObject 成员引用通常要写：

```cpp
UPROPERTY()
UObject* Target;
```

而不是裸指针长期持有。裸指针可以临时用，但不会自动参与 GC 引用追踪。

## 10. 反射和蓝图、RPC 的关系

蓝图调用依赖 `UFunction` 元数据。RPC 也依赖 `UFUNCTION(Server)`、`UFUNCTION(Client)`、`UFUNCTION(NetMulticast)` 生成的 wrapper。UHT 会为 RPC 生成参数结构和调用 thunk，网络层收到 RPC 后通过函数索引和反射数据调用目标函数。

## 11. 踩坑

不要把 UE 宏当普通 C++ 宏理解。`UCLASS` 本身不是全部，真正关键是 UHT 扫描到这些宏后生成的代码。

不要在 `.generated.h` 后继续 include 其他头文件。它通常要求放在当前头文件最后，避免生成宏依赖被破坏。

不要以为所有 C++ 字段都会序列化、复制或被 GC 扫描。只有被反射系统知道的字段，才能进入这些通用流程。

## 12. 结论

UE 反射系统的本质是“编译期生成运行时元数据”。UHT 负责把宏标记的 C++ 声明转成生成代码；`.generated.h` 和 `.gen.cpp` 把类型、属性、函数注册到对象系统；运行时的序列化、蓝图、GC、复制、编辑器都基于这套元数据工作。

