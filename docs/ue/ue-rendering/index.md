# UE 渲染详解

## 0. 读前地图

这篇文章按“能改哪里”来读渲染源码，而不是从图形学概念平铺。项目里想改画风，通常有五个入口：材质、后处理、光照模型、渲染 Pass、资源和 Shader 管线。越靠后成本越高，越需要引擎源码能力。

优先阅读源码：

```text
PrimitiveComponent / SceneProxy：Gameplay 对象进入渲染世界
SceneVisibility：裁剪和可见性
BasePassRendering：基础几何 Pass
DeferredShadingRenderer：延迟渲染主流程
PostProcess：后处理链路
Material / ShaderCompiler：材质和 Shader 编译
RDG / RHI：Render Graph 和底层图形接口
```

建议断点：

```text
UPrimitiveComponent::CreateSceneProxy
FScene::AddPrimitive
FDeferredShadingSceneRenderer::Render
InitViews
RenderBasePass
AddPostProcessingPasses
FMaterial::CacheShaders
```

关键变量：

```text
FPrimitiveSceneProxy：游戏线程组件在渲染线程的代理
FMeshBatch：一次可提交绘制的网格数据
FViewInfo：相机视图和裁剪结果
FRDGBuilder：Render Graph 构建器
FSceneTextures：GBuffer、Depth、SceneColor 等场景纹理
FMaterialShaderMap：材质对应的 Shader 集合
```

二次元风格最小路径：

```text
先用材质和贴图控制基础色块
→ 用后处理做描边、色阶、阴影分层
→ 需要更稳定的卡通光照时改 Shading Model
→ 需要特殊 Pass 时接入 Renderer / RDG
→ 用 Insights / RenderDoc 验证 Pass 成本
```

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

## 12. 源码精读：从组件到 SceneProxy

源码位置：

```text
Engine/Source/Runtime/Engine/Classes/Components/PrimitiveComponent.h
Engine/Source/Runtime/Engine/Private/Components/PrimitiveComponent.cpp
Engine/Source/Runtime/Renderer/Private/PrimitiveSceneInfo.cpp
```

渲染线程不能直接读取 Gameplay 线程上的组件状态。UE 会把可渲染组件转换成 `FPrimitiveSceneProxy`，再提交给渲染场景。

调用链：

```text
UPrimitiveComponent::RegisterComponent
→ CreateRenderState_Concurrent
→ CreateSceneProxy
→ FScene::AddPrimitive
→ 创建 FPrimitiveSceneInfo
→ RenderThread 保存 PrimitiveSceneProxy
→ 后续可见性和绘制使用 Proxy
```

所以如果要自定义一个可渲染组件，关键不是只写 Component，而是实现它如何创建 SceneProxy，SceneProxy 如何提供 MeshBatch、材质、包围盒和渲染标记。

## 13. 源码精读：Deferred Renderer 主流程

源码位置：

```text
Engine/Source/Runtime/Renderer/Private/SceneRendering.cpp
Engine/Source/Runtime/Renderer/Private/DeferredShadingRenderer.cpp
Engine/Source/Runtime/Renderer/Private/BasePassRendering.cpp
Engine/Source/Runtime/Renderer/Private/SceneVisibility.cpp
```

主渲染流程由 `FSceneRenderer` 和 `FDeferredShadingSceneRenderer` 组织。它会先做可见性，再按 Pass 渲染深度、BasePass、阴影、光照、透明和后处理。

简化链路：

```text
UGameViewportClient / Engine Draw
→ FRendererModule::BeginRenderingViewFamily
→ FSceneRenderer::CreateSceneRenderer
→ FDeferredShadingSceneRenderer::Render
→ InitViews / ComputeViewVisibility
→ RenderPrePass
→ RenderBasePass
→ RenderShadowDepthMaps
→ RenderLights
→ RenderTranslucency
→ AddPostProcessingPasses
→ Tonemapper
```

改渲染风格时要先判断目标在哪个阶段实现。如果只是颜色和描边，通常后处理或材质就够；如果要改变光照模型，才需要 Shading Model 或 BasePass/Lighting 层修改。

## 14. 源码精读：后处理为什么适合风格化

源码位置：

```text
Engine/Source/Runtime/Renderer/Private/PostProcess
Engine/Source/Runtime/Renderer/Private/PostProcess/PostProcessing.cpp
Engine/Source/Runtime/Engine/Classes/Engine/Scene.h
```

后处理在场景已经渲染成纹理后执行，可以读取 SceneColor、Depth、Normal、CustomDepth、CustomStencil 等信息。它适合做全屏风格统一，例如色阶、LUT、描边、暗角、屏幕空间线稿。

流程：

```text
BasePass / Lighting 输出 SceneColor
→ 后处理链读取 SceneColor 和 GBuffer
→ PostProcess Material 执行
→ Tonemapper 和输出
```

缺点是它只能基于屏幕空间信息判断，无法天然知道完整物体拓扑。比如后处理描边对遮挡、透明物、细小结构和远距离对象需要额外规则。

## 15. 源码精读：自定义 Shading Model 的代价

源码位置：

```text
Engine/Source/Runtime/Engine/Classes/Materials/Material.h
Engine/Source/Runtime/Engine/Public/MaterialShared.h
Engine/Source/Runtime/Renderer/Private/ShadingModels.ush
Engine/Source/Runtime/Renderer/Private/BasePassPixelShader.usf
```

新增 Shading Model 不是只加一个材质选项。它通常涉及：

```text
枚举增加 ShadingModel
→ Material 编译环境传递宏
→ GBuffer 编码增加标记或参数
→ BasePass 写入数据
→ Lighting 阶段按新模型计算光照
→ 编辑器材质面板暴露选项
```

这会增加引擎分支维护成本。小团队要优先尝试材质函数、Ramp、后处理和 CustomData，只有美术目标无法达成时再改 Shading Model。
