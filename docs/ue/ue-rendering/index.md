# UE 渲染详解

## 1. 问题背景

UE 渲染系统负责把场景对象、材质、灯光、阴影、后处理、特效和 UI 组合成最终画面。做项目时常见问题不是“渲染管线是什么”，而是“哪些东西能改，改哪里，成本是什么，怎么做成自己的风格”。

## 2. 源码入口

```text
Engine/Source/Runtime/Engine/Private/SceneRendering.cpp
Engine/Source/Runtime/Renderer/Private/DeferredShadingRenderer.cpp
Engine/Source/Runtime/Renderer/Private/SceneVisibility.cpp
Engine/Source/Runtime/Renderer/Private/BasePassRendering.cpp
Engine/Source/Runtime/Renderer/Private/PostProcess
Engine/Source/Runtime/RenderCore
Engine/Source/Runtime/RHI
```

核心类：

```text
FScene
FSceneRenderer
FDeferredShadingSceneRenderer
FPrimitiveSceneProxy
FMaterial
FMeshBatch
FRDGBuilder
FRHICommandList
```

## 3. 渲染主流程

```text
GameThread 更新 Actor / Component
→ PrimitiveComponent 创建或更新 SceneProxy
→ RenderThread 接收场景代理
→ Visibility / Culling
→ Shadow Pass
→ Depth Prepass
→ Base Pass
→ Lighting
→ Translucency
→ PostProcess
→ Tonemapper
→ Present
```

UE5 中很多渲染 Pass 使用 Render Dependency Graph。RDG 负责描述 Pass 之间的资源依赖，让引擎更好地管理 RenderTarget、UAV、屏障和生命周期。

## 4. 哪些东西能改

常见可改层级：

```text
材质 Material / Material Function
后处理 Post Process Material
光照和曝光配置
CustomDepth / CustomStencil
Niagara 渲染器
Mesh Component / SceneProxy
Shading Model
Global Shader / Compute Shader
Renderer Pass
RHI 级别
```

越往下改，能力越强，成本越高，升级引擎风险越大。

## 5. 改渲染风格的常见路线

轻量路线：

```text
材质风格化
→ LUT / Tonemapper 参数
→ PostProcess 边缘线
→ CustomDepth 分层描边
→ 阴影和 AO 调整
```

中等路线：

```text
统一材质模板
→ 自定义光照函数
→ 特定角色材质走 Custom Shading
→ 后处理做色阶、描边、笔触
```

重度路线：

```text
新增 Shading Model
→ 修改 BasePass / Lighting
→ 修改 GBuffer 编码
→ 自定义 Renderer Pass
→ 维护引擎分支
```

## 6. 二次元风格流程

二次元风格通常不是单个后处理能完成，而是多个环节组合：

```text
角色材质使用 Ramp 或分段光照
→ 控制法线，减少真实 PBR 噪声
→ 用 CustomDepth / CustomStencil 做描边
→ 控制阴影硬边和阴影颜色
→ 后处理做色调统一和轻微线稿
→ 特效和 UI 也统一色彩规则
```

角色面部常需要特殊处理：脸部阴影、眼睛高光、头发透明排序、描边粗细、法线方向都要单独调。

## 7. 描边方案

常见描边方式：

```text
反向壳模型描边
后处理深度/法线描边
CustomDepth/Stencil 分组描边
Mesh 扩张描边
```

后处理描边易接入，但远近、遮挡、透明和细节控制有限。反向壳描边稳定，但需要额外 Mesh Pass 和材质管理。

## 8. 材质风格化

材质层面可以改：

```text
BaseColor 色阶
Roughness / Specular
Normal 强度
Ramp Texture
自定义高光
Fresnel
MatCap
局部遮罩
```

如果项目不想改引擎，优先用材质函数和后处理组合。

## 9. 性能关注点

```text
BasePass draw call
Shadow draw call
Translucency overdraw
PostProcess 分辨率和采样次数
CustomDepth 额外 Pass
Niagara 粒子数量
Virtual Shadow Map 成本
Lumen 成本
Nanite 场景复杂度
```

风格化不一定便宜。描边、后处理、透明头发、粒子和大量阴影都可能成为瓶颈。

## 10. 项目实践建议

先做可控方案：

```text
统一主角/怪物材质模板
→ 用 PostProcess 做整体色调
→ 用 CustomStencil 做角色和交互物描边
→ 只对关键角色做特殊材质
→ 用 Insights / RenderDoc 验证成本
```

只有当材质和后处理无法满足核心美术目标时，再考虑改 Shading Model 或 Renderer。

## 11. 结论

UE 渲染风格改造要按层级推进。材质和后处理最稳，SceneProxy 和 Shader 次之，改 Renderer 和 Shading Model 成本最高。二次元风格的核心不是一个描边，而是光照、材质、阴影、后处理和美术资产规范的组合。

