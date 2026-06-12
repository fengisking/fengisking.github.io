# 怎么升级引擎？

## 1. 问题背景

引擎升级不是“直接用新版本打开项目”。比如从 5.6 升到 5.7，真正风险来自 C++ API 改动、插件兼容、蓝图重编译、资源版本升级、渲染和物理行为变化、打包链路变化、平台 SDK 变化。正确做法是把升级当成一次工程迁移，而不是一次编辑器启动。

## 2. 升级前准备

升级前必须固定基线：

```text
当前 main 分支能编译
当前 main 分支能打包
当前关键地图能进入
当前自动化测试或 smoke test 能跑
当前性能基线有记录
当前线上配置和插件版本明确
```

如果旧版本本身就不稳定，升级后很难判断问题是新引擎导致的，还是旧问题暴露了。

## 3. 推荐流程

```text
新建 upgrade 分支
→ 安装目标引擎版本
→ 复制或切换 uproject EngineAssociation
→ 生成项目文件
→ 编译 C++ 和插件
→ 修 C++ 编译错误
→ 启动编辑器
→ 修蓝图和资源报错
→ 跑关键地图
→ 跑 Cook / Package
→ 对比性能和行为
→ 合并升级分支
```

不要在主分支直接升级。

## 4. 源码和工具入口

构建相关：

```text
Engine/Source/Programs/UnrealBuildTool
Engine/Source/Programs/AutomationTool
Engine/Build/BatchFiles/GenerateProjectFiles.bat
Engine/Build/BatchFiles/RunUAT.bat
```

项目配置：

```text
*.uproject
Source/*.Target.cs
Source/*.Build.cs
Config/DefaultEngine.ini
Config/DefaultGame.ini
Plugins/*.uplugin
```

## 5. 具体操作：5.6 升 5.7 示例

步骤：

```text
1. 从版本控制拉出 upgrade/ue57 分支
2. 安装 UE 5.7 或切换到 UE 5.7 源码分支
3. 备份 uproject 和 Config
4. 修改 uproject 的 EngineAssociation
5. 右键 uproject Generate Visual Studio project files
6. 编译 Editor Target
7. 修 C++ API 编译错误
8. 启动编辑器并等待资源升级
9. 全量保存需要升级的资源
10. 跑 Cook 和 Package
11. 跑 smoke test
```

如果是源码引擎，还要先编译引擎本身：

```bat
Setup.bat
GenerateProjectFiles.bat
Engine\Build\BatchFiles\Build.bat UnrealEditor Win64 Development
```

## 6. C++ 修复重点

常见错误：

```text
函数签名变化
头文件路径变化
模块依赖变化
枚举或类型重命名
弃用 API 被移除
插件接口变化
Build.cs 依赖缺失
```

修复原则：

```text
先修编译错误，再修运行错误
优先查新版本源码和 release note
不要大范围重构业务
每修一类错误提交一次
```

## 7. 蓝图和资源升级

编辑器启动后要关注：

```text
Blueprint compile error
Missing class
Deprecated node
Redirector
Material shader compile
Niagara 版本变化
Animation 节点变化
DataTable 结构变化
```

如果资源一旦保存成新版本，旧引擎通常打不开，所以升级分支必须和主分支隔离。

## 8. 插件升级

插件是升级高风险区：

```text
第三方插件是否支持目标引擎
源码插件是否能编译
二进制插件是否有新版本
插件模块依赖是否变化
插件资源是否需要升级
```

如果插件没有目标版本支持，要评估替换、修源码或暂时冻结引擎版本。

## 9. 打包验证

升级成功不等于编辑器能打开。必须验证：

```text
Editor 编译
Client 编译
Server 编译
Cook
Package
启动包体
进入主地图
联机连接
关键战斗流程
```

很多问题只在 Cook 或 Shipping 配置暴露，比如资源引用、反射、插件加载、平台宏。

## 10. 性能对比

升级后要对比：

```text
启动时间
主地图加载时间
GameThread
RenderThread
GPU
内存
网络带宽
DS Tick
Shader 编译数量
包体大小
```

如果性能变化明显，用 Unreal Insights 和 stat 命令定位，而不是只凭体感。

## 11. 回滚策略

升级必须能回滚：

```text
升级分支独立
资源保存前确认备份
每个阶段小提交
插件升级单独提交
配置变化单独提交
保留旧版本可打包基线
```

## 12. 结论

引擎升级的本质是工程迁移。正确流程是先锁定旧版本基线，再分支升级，依次修编译、资源、运行、打包和性能问题。不要直接在主分支用新引擎打开项目，更不要在没有可回滚方案时批量保存资源。

## 13. 源码精读：UBT 和 UAT 在升级里分别负责什么

源码位置：

```text
Engine/Source/Programs/UnrealBuildTool
Engine/Source/Programs/AutomationTool
Engine/Build/BatchFiles/Build.bat
Engine/Build/BatchFiles/RunUAT.bat
```

UBT 负责“怎么编译 C++ 模块”，UAT 负责“怎么自动化构建、Cook、打包、归档”。升级时如果是 C++ 编译失败，主要看 UBT；如果打包流程失败，主要看 UAT。

升级验证链路：

```text
GenerateProjectFiles
→ UBT 编译 Editor Target
→ 启动编辑器升级资源
→ UBT 编译 Client / Server Target
→ UAT BuildCookRun
→ Cook / Stage / Package
```

很多项目只验证 Editor 能打开，但没有验证 Client、Server 和 Package，最后 CI 或发包阶段才暴露问题。

## 14. 源码精读：Build.cs 变化为什么常见

源码位置：

```text
Engine/Source/Programs/UnrealBuildTool/System/RulesAssembly.cs
Engine/Source/Programs/UnrealBuildTool/Configuration/ModuleRules.cs
Source/<Project>/<Module>.Build.cs
```

引擎升级后，模块依赖、头文件包含、API 导出宏都可能变化。原来靠间接 include 编译通过的代码，新版本可能失败。

排查顺序：

```text
看第一个编译错误
→ 判断是头文件缺失、模块缺失还是 API 改名
→ 如果类型找不到，先查所属模块
→ 在 Build.cs 加 Public/PrivateDependencyModuleNames
→ 再修 include
```

不要一上来全局 include 大头文件。升级是清理模块边界的机会，应该尽量补正确模块依赖。

## 15. 源码精读：资源版本升级发生在哪里

源码位置：

```text
Engine/Source/Runtime/CoreUObject/Private/Serialization
Engine/Source/Runtime/CoreUObject/Private/UObject/LinkerLoad.cpp
Engine/Source/Runtime/CoreUObject/Private/UObject/Package.cpp
```

资源加载时会通过序列化版本号决定如何读旧数据。引擎版本升级后，一些资源第一次在新版本打开会做版本转换，保存后就写成新版本格式。

流程：

```text
加载 uasset
→ 读取 Package summary 和 custom version
→ LinkerLoad 创建导出对象
→ UObject::Serialize
→ 根据版本做兼容读取
→ PostLoad 修正运行时状态
→ 保存时写成新版本格式
```

所以升级分支里批量保存资源前必须确认可回滚。资源一旦保存，新版本格式可能无法被旧引擎打开。
