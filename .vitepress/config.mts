import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Raylotan Blog",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Inbox', link: '/00_Inbox' },
      {
        text: 'AI', items: [
          { text: 'Learn Claude Code', link: '/01_AI/Mini-Agent-Loop' },
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
      '/01_AI/': [
        {
          text: 'AI',
          items: [
            { text: 'MCP 详解', link: '/01_AI/MCP-Detail' },
          ]
        },
        {
          text: 'Learn Claude Code',
          items: [
            { text: 'Mini Agent Loop', link: '/01_AI/Mini-Agent-Loop' },
            { text: 'Agent for Plan mode', link: '/01_AI/Agent-for-Plan-mode' },
            { text: 'Sub Agent Mode', link: '/01_AI/SubAgent-Mode' },
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
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  },
  srcDir: 'src'
})
