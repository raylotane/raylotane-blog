# Agent for Plan mode

## 核心实现
核心是加了一个 TodoManager 类，用户记录与操作 Plan，然后把 TodoManager.update 方法暴露给 AI 作为一个 Tool，AI 调用此工具来更新计划。


```typescript
import inquirer from "inquirer"
import chalk from "chalk"
import Anthropic from '@anthropic-ai/sdk'
import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const WORKDIR = process.cwd()

const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use the todo tool for multi-step work.
Keep exactly one step in_progress when a task has multiple steps.
Refresh the plan as work advances. Prefer tools over prose.`

const userLog = (message: string) => {
  console.log(chalk.white('user: ' + message))
}

const assistantLog = (type: 'thinking' | 'text', message: string) => {
  if (type === 'thinking') {
    console.log(chalk.gray('thinking: ' + message))
  } else if (type === 'text') {
    console.log(chalk.green('assistant: ' + message))
  } else {
    console.log(chalk.red(`${type}: ${message}`))
  }
}

const PLAN_REMINDER_INTERVAL = 3;

const client = new Anthropic({
  apiKey: "your-apikey", // This is the default and can be omitted
  baseURL: "https://dashscope.aliyuncs.com/apps/anthropic"
});

interface IMessage {
  role: 'user' | 'assistant'
  content: any
}


class PlanItem {
  content: string = ''
  status: "pending" | "in_progress" | "completed" = 'pending'
  active_from: string = ''

}
class PlanningState {
  items: PlanItem[] = []
  rounds_since_update: number = 0
  constructor(items?: PlanItem[]) {
    if (items) {
      this.items = items
    }
  }
}

class TodoManager {
  public state: PlanningState = new PlanningState()
  /**
   * 更新计划
   * @param item 
   */
  update(items: PlanItem[]) {
    /**
     * 将 AI 输入的内容转换为 PlanItem 对象，进行标准化
     */
    const normalized: PlanItem[] = []

    for (const item of items) {
      const normalizedItem = new PlanItem()
      normalizedItem.content = item.content
      normalizedItem.status = item.status
      normalizedItem.active_from = item.active_from
      normalized.push(normalizedItem)
    }

    this.state.items = normalized
    this.state.rounds_since_update = 0

    return this.render()

  }



  /**
   * 不更新计划的回合数
   */
  note_round_without_update() {
    this.state.rounds_since_update++
  }


  /**
   * 提醒更新计划
   * @returns 
   */
  reminder() {
    if (this.state.items.length === 0) {
      return null
    } else if (this.state.rounds_since_update < PLAN_REMINDER_INTERVAL) {
      return null
    } else {
      return "<reminder>Refresh your current plan before continuing.</reminder>"
    }
  }

  render() {
    const markers = {
      "pending": "[ ]",
      "in_progress": "[>]",
      "completed": "[x]",
    }
    let result = ''
    for (const { content, status, active_from } of this.state.items) {
      const marker = markers[status]
      const line = `${marker} ${content}`
      result += line + '\n'
    }
    return result.trim()

  }

}

const todoManager = new TodoManager()

const executeToolCalls = async (message: { name: string, input: any, id: string }) => {
  if (message.name === 'weather') {
    return {
      "type": "tool_result",
      "tool_use_id": message.id,
      content: `${message.input.city} 的天气是晴天`
    }
  } else if (message.name === 'todo') {
    return {
      "type": "tool_result",
      "tool_use_id": message.id,
      content: todoManager.update(message.input.items)
    }
  } else if (message.name === 'bash') {
    try {
      const { stdout, stderr } = await execAsync(message.input.command, { cwd: WORKDIR })
      const output = stderr ? `stdout:\n${stdout}\nstderr:\n${stderr}` : stdout
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: output || "(no output)"
      }
    } catch (error: any) {
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `Error: ${error.message}`
      }
    }
  } else if (message.name === 'read_file') {
    try {
      const filePath = path.resolve(WORKDIR, message.input.path)
      const content = fs.readFileSync(filePath, 'utf-8')
      const limit = message.input.limit
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: limit ? content.substring(0, limit) : content
      }
    } catch (error: any) {
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `Error: ${error.message}`
      }
    }
  } else if (message.name === 'write_file') {
    try {
      const filePath = path.resolve(WORKDIR, message.input.path)
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, message.input.content, 'utf-8')
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `File written successfully: ${message.input.path}`
      }
    } catch (error: any) {
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `Error: ${error.message}`
      }
    }
  } else if (message.name === 'edit_file') {
    try {
      const filePath = path.resolve(WORKDIR, message.input.path)
      let content = fs.readFileSync(filePath, 'utf-8')
      if (!content.includes(message.input.old_text)) {
        return {
          "type": "tool_result",
          "tool_use_id": message.id,
          content: `Error: old_text not found in file`
        }
      }
      content = content.replace(message.input.old_text, message.input.new_text)
      fs.writeFileSync(filePath, content, 'utf-8')
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `File edited successfully: ${message.input.path}`
      }
    } catch (error: any) {
      return {
        "type": "tool_result",
        "tool_use_id": message.id,
        content: `Error: ${error.message}`
      }
    }
  } else {
    return {
      "type": "tool_result",
      "tool_use_id": message.id,
      content: `unsupported tool ${message.name}`
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

  console.log("--------------------")

  const response = await client.messages.create({
    max_tokens: 1024,
    messages: state.messages,
    system: SYSTEM,
    model: 'glm-5',
    tools: [
      {
        "name": "bash",
        "description": "Run a shell command.",
        "input_schema": {
          "type": "object",
          "properties": { "command": { "type": "string" } },
          "required": ["command"],
        },
      },
      {
        "name": "read_file",
        "description": "Read file contents.",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "limit": { "type": "integer" },
          },
          "required": ["path"],
        },
      },
      {
        "name": "write_file",
        "description": "Write content to a file.",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "content": { "type": "string" },
          },
          "required": ["path", "content"],
        },
      },
      {
        "name": "edit_file",
        "description": "Replace exact text in a file once.",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "old_text": { "type": "string" },
            "new_text": { "type": "string" },
          },
          "required": ["path", "old_text", "new_text"],
        },
      },
      {
        "name": "todo",
        "description": "Rewrite the current session plan for multi-step work.",
        "input_schema": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "content": { "type": "string" },
                  "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
                  },
                  "activeForm": {
                    "type": "string",
                    "description": "Optional present-continuous label.",
                  },
                },
                "required": ["content", "status"],
              },
            },
          },
          "required": ["items"],
        },
      },
    ]

  })

  let used_todo = false

  state.messages.push({
    role: 'assistant',
    content: response.content
  })
  for (const element of response.content) {
    const { type, thinking, text, input, id, name } = (element || {}) as any
    if (response.stop_reason !== 'tool_use') {
      assistantLog(type, text || thinking)
    } else if (type === 'tool_use') {
      if (name === 'todo') {
        used_todo = true
      }

      const reuslt = await executeToolCalls({ name, input, id })

      assistantLog(name, reuslt.content)

      state.messages.push({
        role: 'user',
        content: [reuslt]
      })
    }
  }

  if (used_todo) {
    todoManager.state.rounds_since_update = 0;
  } else {
    todoManager.state.rounds_since_update++;
    const reminder = todoManager.reminder()
    if (reminder) {
      state.messages.push({
        role: 'user',
        content: reminder
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
```shell
> 使用计划模式，创建一个 sum 函数，并进行测试
user: 使用计划模式，创建一个 sum 函数，并进行测试
--------------------
todo: [>] 创建 sum.js 文件，实现 sum 函数
[ ] 创建 sum.test.js 文件，编写测试用例
[ ] 运行测试验证功能
--------------------
write_file: File written successfully: /Users/raloy/Desktop/Development/other/workspace/my-coding/mini-agent/sum.js
--------------------
todo: [x] 创建 sum.js 文件，实现 sum 函数
[>] 创建 sum.test.js 文件，编写测试用例
[ ] 运行测试验证功能
--------------------
write_file: File written successfully: /Users/raloy/Desktop/Development/other/workspace/my-coding/mini-agent/sum.test.js
--------------------
todo: [x] 创建 sum.js 文件，实现 sum 函数
[x] 创建 sum.test.js 文件，编写测试用例
[>] 运行测试验证功能
--------------------
bash: 
=== Sum 函数测试 ===

✓ 计算空数组的和应该返回 0
✓ 计算单个数字的数组应该返回该数字
✓ 计算多个正数的和
✓ 计算包含负数的数组
✓ 计算小数的和
✓ 传入非数组应该抛出错误
✓ 数组中包含非数字应该抛出错误
✓ 数组中包含 NaN 应该抛出错误

=== 测试完成 ===


--------------------
todo: [x] 创建 sum.js 文件，实现 sum 函数
[x] 创建 sum.test.js 文件，编写测试用例
[x] 运行测试验证功能
--------------------
thinking: 完美！所有任务都已完成。让我总结一下我做了什么。
assistant: ## 任务完成！✅

我已经成功使用计划模式创建了一个 sum 函数并进行了测试。以下是完成的工作：

### 1. 创建 sum.js 文件
实现了 `sum` 函数，具有以下特性：
- 计算数组中所有数字的和
- 参数验证：确保输入是数组
- 类型验证：确保数组中只包含有效数字
- 使用 ES6 模块语法导出

### 2. 创建 sum.test.js 文件
编写了完整的测试套件，包括：
- ✓ 空数组测试
- ✓ 单个数字测试
- ✓ 多个正数求和测试
- ✓ 包含负数的数组测试
- ✓ 小数求和测试
- ✓ 错误处理测试（非数组输入）
- ✓ 错误处理测试（非数字元素）
- ✓ 错误处理测试（NaN 值）

### 3. 运行测试
所有 8 个测试用例全部通过！✓

函数已经可以正常使用，代码健壮且具有良好的错误处理机制。
```

## 资料
+ [Learn Claude Code Plan 讲解](https://github.com/shareAI-lab/learn-claude-code/blob/main/docs/zh/s03-todo-write.md)
+ [Learn Claude Code Plan 核心实现](https://github.com/shareAI-lab/learn-claude-code/blob/main/agents/s03_todo_write.py)
