# Mini-Agent-Loop
Agent 本质是循环调用模型。

## 核心实现
```typescript
import inquirer from "inquirer"
import chalk from "chalk"
import Anthropic from '@anthropic-ai/sdk'

const userLog = (message: string) => {
  console.log(chalk.white('user: ' + message))
}

const assistantLog = (type: 'thinking' | 'text', message: string) => {
  if (type === 'thinking') {
    console.log(chalk.gray('thinking: ' + message))
  } else {
    console.log(chalk.green('assistant: ' + message))
  }
}

const client = new Anthropic({
  apiKey: "your-apikey", // This is the default and can be omitted
  baseURL: "https://dashscope.aliyuncs.com/apps/anthropic"
});

interface IMessage {
  role: 'user' | 'assistant'
  content: any
}

const executeToolCalls = (message: { name: string, input: any, id: string }) => {
  if (message.name === 'weather') {
    return {
      "type": "tool_result",
      "tool_use_id": message.id,
      content: `${message.input.city} 的天气是晴天`
    }
  }
}

class LoopState {
  public messages: IMessage[] = []
  public turnCount: number = 1
  public transitionReason: string = ''
  constructor(messages: IMessage[]) {
    this.messages = messages
  }
}
const run_one_turn = async (state: LoopState) => {

  const response = await client.messages.create({
    max_tokens: 1024,
    messages: state.messages,
    model: 'glm-5',
    tools: [{
      name: 'weather',
      description: 'get weather info',
      input_schema: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The city to get weather information for'
          }
        }
      }
    }]

  })

  state.messages.push({
    role: 'assistant',
    content: response.content
  })
  for (const element of response.content) {
    const { type, thinking, text, input, id, name } = (element || {}) as any
    if (response.stop_reason !== 'tool_use') {
      assistantLog(type, text || thinking)
    } else if (type === 'tool_use') {
      const reuslt = executeToolCalls({ name, input, id })
      state.messages.push({
        role: 'user',
        content: [reuslt]
      })
    }
  }

  if (response.stop_reason !== 'tool_use') {
    state.transitionReason = "none"
    return false;
  }

  return true;
}

const agentLoop = async (state: LoopState) => {
  while (await run_one_turn(state)) {

  }
}


const main = async () => {
  const history: IMessage[] = []

  const questions = [
    {
      type: "input",
      name: "message",
      message: ">",
    },
  ]

  while (true) {
    const answers = await inquirer.prompt(questions)
    if (answers.message === 'exit' || answers.message === 'q') {
      // 退出
      break
    }

    history.push({
      role: 'user',
      content: answers.message
    })
    userLog(answers.message)

    const state = new LoopState(history)
    await agentLoop(state)

  }

}

main()
```

## 验证
```markdown
prompt: 获取郑州的天气信息
```

```bash
✔ > 获取郑州的天气信息
user: 获取郑州的天气信息
thinking: 我成功获取了郑州的天气信息，结果显示郑州的天气是晴天。我应该将这个信息以友好的方式呈现给用户。
assistant: 根据查询结果，郑州目前的天气是晴天。天气状况良好，适合外出活动。
```



## 避坑点
1. 返回给模型的工具调用结果携带的是，工具ID，而非 本轮消息ID。
2. 返回给模型的工具调用结果中 content 是一个数组

```typescript
state.messages.push({
  role: 'user',
  content: [{
    "type": "tool_result",
    "tool_use_id": tool.id, // 对应的是模型出参的工具ID
    content: `${message.input.city} 的天气是晴天`
  }]
})
```

## 资料
+ [Agent Loop 讲解](https://github.com/shareAI-lab/learn-claude-code/blob/main/docs/zh/s01-the-agent-loop.md)
+ [Agent Loop Python 实现](https://github.com/shareAI-lab/learn-claude-code/blob/main/agents/s01_agent_loop.py)
