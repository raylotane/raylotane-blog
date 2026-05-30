import { defineConfig } from 'vitepress'
import mermaidPlugin from '@vitepress-plugin/mermaid'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Raylotane",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Inbox', link: '/00_Inbox' },
      { text: '阅读', link: '/03_Reading' },
      {
        text: 'AI工程应用', items: [
          { text: 'AI评估系列', link: '/01_AI_Engineering/ai-evaluation-series/blog-v1-basic-chat' },
          { text: 'Learn Claude Code', link: '/01_AI_Engineering/learn-claude-code/Mini-Agent-Loop' },
        ]
      },
      {
        text: '工程化', items: [
          { text: '基于 Rollup 的多页面构建', link: '/02_Engineering/building-react-mpa-with-morejs-cli.md.md' },
          { text: '从零实现一个插件化 CLI 工具', link: '/02_Engineering/fewjs-plugin-architecture.md' },
        ]
      },
    ],
    sidebar: {
      '/00_Inbox/': [
        {
          text: 'Inbox',
          items: [
            // { text: 'Markdown Examples', link: '/markdown-examples' },
            // { text: 'Runtime API Examples', link: '/api-examples' }
          ]
        }
      ],
      '/01_AI_Engineering/': [
        {
          text: 'AI',
          items: [
            { text: 'MCP 详解', link: '/01_AI_Engineering/MCP-Detail' },
          ]
        },
        {
          text: 'AI 评估系列',
          items: [
            { text: 'v1-基础 Chat：打通 AI SDK 与 Langfuse 的第一次连接', link: '/01_AI_Engineering/ai-evaluation-series/blog-v1-basic-chat' },
            { text: 'v2-引入 RAG 与评估体系：让 AI 回答有据可依、有据可评', link: '/01_AI_Engineering/ai-evaluation-series/blog-v2-rag-evaluation' },
            { text: 'v3-从 RAG 到 Agent：让 AI 学会"动手做事"', link: '/01_AI_Engineering/ai-evaluation-series/blog-v3-agent-tools' },
            // { text: 'Sub Agent Mode', link: '/01_AI/learn-claude-code/SubAgent-Mode' },
          ]
        },
        {
          text: 'Learn Claude Code',
          items: [
            { text: 'Mini Agent Loop', link: '/01_AI_Engineering/learn-claude-code/Mini-Agent-Loop' },
            { text: 'Agent for Plan mode', link: '/01_AI_Engineering/learn-claude-code/Agent-for-Plan-mode' },
            { text: 'Sub Agent Mode', link: '/01_AI_Engineering/learn-claude-code/SubAgent-Mode' },
          ]
        },

      ],
      "/02_Engineering/": [
        {
          // text: '工程化',
          items: [
            { text: '基于 Rollup 的多页面构建', link: '/02_Engineering/building-react-mpa-with-morejs-cli.md.md' },
            { text: '从零实现一个插件化 CLI 工具', link: '/02_Engineering/fewjs-plugin-architecture.md' },
          ]
        }
      ],
      "/03_Reading/": [
        {
          text: '阅读',
          items: [
            { text: '阅览室', link: '/03_Reading' },
            { text: '《了凡四训》—— 命由我作，福自己求', link: '/03_Reading/了凡四训——命由我作，福自己求' },
            { text: '《非线性成长》', link: '/03_Reading/⾮线性成⻓：不确定时代下的职业发展和商业通关策略' },
          ]
        }
      ]
    },
    // sidebar: [
    //   {
    //     text: 'Examples',
    //     items: [
    //       { text: 'Markdown Examples', link: '/markdown-examples' },
    //       { text: 'Runtime API Examples', link: '/api-examples' }
    //     ]
    //   }
    // ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/raylotane/raylotane-blog' }
    ]
  },
  srcDir: 'src',
  vite: {
    plugins: [
      mermaidPlugin(),
    ],
  },
})
