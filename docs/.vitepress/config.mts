import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '潘天峰的主页',
  description: 'UE Gameplay / AI / Tools / Engine Notes',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    siteTitle: '潘天峰',

    nav: [
      { text: '首页', link: '/' },
      { text: 'UE 笔记', link: '/ue/' },
      { text: '项目复盘', link: '/projects/' },
      { text: '关于我', link: '/about' }
    ],

    sidebar: {
      '/ue/': [
        {
          text: '学习路线',
          items: [
            { text: 'UE 笔记总览', link: '/ue/' },
            { text: 'UE 学习路线和源码阅读方法', link: '/ue/ue-learning-roadmap-source-reading/' },
            { text: 'UE 源码目录和模块架构', link: '/ue/source-module-architecture/' }
          ]
        },
        {
          text: '核心机制',
          items: [
            { text: 'UE 反射详解', link: '/ue/ue-reflection/' },
            { text: 'UE 的 GC 详解', link: '/ue/ue-gc/' },
            { text: '智能指针和 Delegate 详解', link: '/ue/smart-pointer-delegate/' },
            { text: 'GameplayTag 详解', link: '/ue/gameplay-tag/' },
            { text: 'UE 运行时问题解答', link: '/ue/ue-runtime-questions/' }
          ]
        },
        {
          text: 'Gameplay 和 AI',
          items: [
            { text: 'Enhanced Input 详解', link: '/ue/enhanced-input/' },
            { text: 'CharacterMovement 详解', link: '/ue/character-movement-deep-dive/' },
            { text: 'CharacterMovement 源码阅读', link: '/ue/character-movement/' },
            { text: 'Navigation 详解', link: '/ue/navigation/' },
            { text: 'AI Perception 源码阅读', link: '/ue/ai-perception/' },
            { text: 'GAS 详解', link: '/ue/gas/' },
            { text: 'PCG 详解', link: '/ue/pcg/' },
            { text: 'SmartObject / GameplayInteraction 详解', link: '/ue/smart-object-gameplay-interaction/' },
            { text: 'MassEntity / MassAI 详解', link: '/ue/mass-entity-ai/' }
          ]
        },
        {
          text: '网络、动画和表现',
          items: [
            { text: 'DS 和 RPC 详解', link: '/ue/ds-rpc/' },
            { text: 'Iris Replication 详解', link: '/ue/iris-replication/' },
            { text: 'Animation 详解', link: '/ue/animation/' },
            { text: 'UE 渲染详解', link: '/ue/ue-rendering/' },
            { text: 'Physics 和 Collision 详解', link: '/ue/physics-collision/' }
          ]
        },
        {
          text: '工程化',
          items: [
            { text: '如何打包一个项目', link: '/ue/cook-package/' },
            { text: 'Unreal Insights 如何 Profile', link: '/ue/unreal-insights-profile/' },
            { text: 'World Partition 详解', link: '/ue/world-partition/' },
            { text: '怎么升级引擎？', link: '/ue/engine-upgrade/' }
          ]
        }
      ],

      '/projects/': [
        {
          text: '项目复盘',
          items: [
            { text: '项目总览', link: '/projects/' },
            { text: '机甲 PVE AI 自动跑测', link: '/projects/mech-pve-ai/' },
            { text: '机甲手感参数', link: '/projects/mech-feel-parameters/' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: 'UE Gameplay / AI / Tools / Engine Notes',
      copyright: 'Copyright © 2026 pantianfeng'
    }
  }
})
