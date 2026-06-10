# UE 打包与动态资源：资源为什么会遗漏

## 1. 问题背景

项目中经常会因为字符串路径、动态加载、脚本引用等原因导致资源没有被 Cook 进包体。

## 2. 需要研究的源码方向

```text
Engine/Source/Editor/UnrealEd/Private/Cook*
Engine/Source/Runtime/AssetRegistry/
Engine/Source/Runtime/CoreUObject/Private/UObject/SavePackage*
```

## 3. 待整理问题

- 硬引用和软引用在 Cook 中有什么区别。
- AssetRegistry 如何记录依赖。
- PrimaryAssetLabel 如何影响打包。
- 动态资源注册系统如何设计。