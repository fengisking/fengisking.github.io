import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '潘天峰的技术主页',
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
          text: 'UE 源码笔记',
          items: [
            { text: 'UE 笔记总览', link: '/ue/' },
            { text: 'CharacterMovement 源码阅读', link: '/ue/character-movement' },
            { text: 'AI Perception 源码阅读', link: '/ue/ai-perception' },
            { text: 'Behavior Tree 设计复盘', link: '/ue/behavior-tree' },
            { text: '打包与动态资源', link: '/ue/package-assets' }
          ]
        }
      ],

      '/projects/': [
        {
          text: '项目复盘',
          items: [
            { text: '项目总览', link: '/projects/' },
            { text: '机甲 PVE AI 自动跑测', link: '/projects/mech-pve-ai' },
            { text: 'UE 工具链复盘', link: '/projects/ue-tools' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pantianfeng' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'UE Gameplay / AI / Tools / Engine Notes',
      copyright: 'Copyright © 2026 pantianfeng'
    }
  }
})