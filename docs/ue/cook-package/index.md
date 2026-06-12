# 如何打包一个项目

## 1. 问题背景

UE 打包不是简单把工程复制出去。它包含编译、Cook、Stage、Package、Archive 等阶段。很多线上资源缺失、蓝图类找不到、软引用没打进去、平台配置不一致的问题，都出在 Cook 和资源引用关系上。

## 2. 关键概念

```text
Build    编译 C++、生成目标平台二进制
Cook     把 uasset 转成目标平台可加载格式
Stage    把可执行文件、Cook 产物、配置、依赖复制到临时目录
Package  生成 pak / iostore / 平台安装包
Archive  归档到最终输出目录
```

## 3. 源码和工具入口

```text
Engine/Source/Programs/AutomationTool
Engine/Source/Programs/UnrealBuildTool
Engine/Source/Editor/UnrealEd/Private/Commandlets/CookCommandlet.cpp
Engine/Source/Runtime/CoreUObject/Private/Serialization/AsyncLoading2.cpp
Engine/Source/Runtime/Engine/Private/AssetManager.cpp
```

常用工具：

```text
UnrealEditor-Cmd.exe
RunUAT.bat
UnrealBuildTool
CookCommandlet
```

## 4. Cook 做了什么

Cook 的目标是把编辑器资源转换成运行时资源。流程可以理解为：

```text
收集需要 Cook 的 Package
→ 加载资源和依赖
→ 平台相关序列化
→ 压缩、裁剪编辑器数据
→ 保存到 Saved/Cooked
→ 生成 AssetRegistry
```

Cook 会根据地图、PrimaryAsset、硬引用、配置目录、显式 Cook 列表收集资源。

## 5. 硬引用和软引用在 Cook 中的区别

硬引用是资源对象直接引用另一个资源。只要入口资源被 Cook，硬引用链上的依赖通常会被一起收集。

软引用保存的是路径，比如 `TSoftObjectPtr`、`FSoftObjectPath`。软引用不会天然保证资源被 Cook，除非：

```text
被 AssetManager PrimaryAsset 规则收集
在 Project Settings 的 Additional Asset Directories to Cook 中
被 PrimaryAssetLabel 标记
代码或配置显式加入 Cook
地图或资源链间接硬引用
```

所以“编辑器能加载，包里找不到”经常是软引用没有进入 Cook。

## 6. 打包执行流程

编辑器点击 Package，本质上也是调用 UAT：

```text
BuildCookRun
→ Build
→ Cook
→ Stage
→ Pak / IoStore
→ Archive
```

典型命令：

```bat
Engine\Build\BatchFiles\RunUAT.bat BuildCookRun ^
  -project="D:\Project\MyGame\MyGame.uproject" ^
  -noP4 ^
  -platform=Win64 ^
  -clientconfig=Development ^
  -serverconfig=Development ^
  -build ^
  -cook ^
  -stage ^
  -pak ^
  -archive ^
  -archivedirectory="D:\Builds\MyGame"
```

如果是 Dedicated Server：

```bat
Engine\Build\BatchFiles\RunUAT.bat BuildCookRun ^
  -project="D:\Project\MyGame\MyGame.uproject" ^
  -noP4 ^
  -platform=Win64 ^
  -server ^
  -serverconfig=Development ^
  -build ^
  -cook ^
  -stage ^
  -pak ^
  -archive ^
  -archivedirectory="D:\Builds\Server"
```

## 7. 不打开编辑器命令行打包

前提：

```text
引擎路径明确
uproject 路径明确
目标平台 SDK 安装
项目 C++ 能编译
Cook 配置完整
```

流程：

```text
清理旧 Saved/Cooked 和 StagedBuilds
→ RunUAT BuildCookRun
→ 检查 Cook warning/error
→ 检查 pak/utoc/ucas 输出
→ 启动包体 smoke test
```

CI 上建议把命令写成脚本，避免手动参数漂移。

## 8. 常见参数

```text
-project       uproject 路径
-platform      目标平台
-clientconfig  客户端配置
-serverconfig  服务端配置
-build         编译
-cook          Cook 资源
-stage         Stage 文件
-pak           生成 pak
-iostore       使用 IoStore
-archive       归档
-map           指定地图
-cookall       Cook 所有资源，不推荐长期使用
-iterate       增量 Cook
```

## 9. 排查资源缺失

优先检查：

```text
资源是否被硬引用
软引用是否被 AssetManager 收集
PrimaryAssetLabel 是否生效
地图是否在打包列表
AssetRegistry 是否包含目标资源
Cook log 是否有 Can't find file
运行时 LoadObject 路径是否正确
```

不要靠 `cookall` 掩盖依赖问题。它会让包变大，也会隐藏资源管理设计缺陷。

## 10. 结论

打包的核心链路是 Build、Cook、Stage、Package。Cook 决定哪些资源进入包体，硬引用通常自动进入依赖链，软引用需要 AssetManager、Label 或配置显式收集。稳定的项目应该把打包命令脚本化，并把资源缺失问题定位到引用和 Cook 规则。

