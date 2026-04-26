
# SubAgent Mode

## 核心实现
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
use ES6 syntax for modules
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

const subAgent = async (code: string) => {
  console.log("subAgent")

  const messages: IMessage[] = [
    { role: 'user', content: "\n\n请审查以下代码：\n" + code }
  ]

  const response = await client.messages.create({
    max_tokens: 1024 * 10,
    messages: messages,
    system: "你是一个专业的 Code Reviewer 助手， 你需要分析开发者编写的代码， 并提供代码审查建议。",
    model: 'glm-5',
  })

  let results = ""
  for (const element of response.content) {
    const { type, thinking, text, input, id, name } = (element || {}) as any
    if (response.stop_reason !== 'tool_use') {
      text && (results += text)
      // assistantLog(type, `**subAgent**${text || thinking}`)
    }

  }
  return results

}

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
  } else if (message.name === 'code_review') {
    const result = await subAgent(message.input.code);
    return {
      "type": "tool_result",
      "tool_use_id": message.id,
      content: result
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
        name: "code_review",
        description: "code review and provide feedback on the code quality, best practices, and potential improvements. ",
        input_schema: {
          type: "object",
          properties: {
            code: {
              type: "string", description: "The code to review"
            },
          },
          required: ["code"],
        },
      },
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
✔ > 写一个 sum 函数，并进行 CR
user: 写一个 sum 函数，并进行 CR
--------------------
write_file: File written successfully: /Users/raloy/Desktop/Development/other/workspace/my-coding/mini-agent/sum.js
--------------------
code_review: 你好！我是你的 Code Reviewer。我已经仔细阅读了你编写的 `sum` 函数代码。

总体来说，这段代码质量很高，逻辑清晰，且具备良好的防御性编程意识。以下是详细的代码审查报告：

### 🌟 优点

1.  **输入校验完善**：
    *   使用了 `Array.isArray()` 来确保输入参数是数组，避免了传入 `null` 或 `undefined` 导致的运行时错误。
    *   使用了 `throw new TypeError` 抛出了明确的错误类型，符合 JavaScript 的异常处理最佳实践。

2.  **数据完整性检查**：
    *   在 `reduce` 循环内部检查了 `typeof curr !== 'number'` 和 `isNaN(curr)`。这一点非常棒，很多开发者容易忽略数组中包含 `NaN` 或非数字类型的情况，你的代码有效地防止了隐式类型转换带来的意外结果（如 `1 + '2' = '12'`）。

3.  **边界情况处理**：
    *   正确处理了空数组的情况，返回 `0`，这在数学上是合理的（空集的和为加法单位元 0）。

4.  **文档注释**：
    *   JSDoc 注释清晰，明确了参数类型和返回值类型。

---

### 💡 建议与改进点

虽然代码已经很棒了，但还有一些细节可以进一步优化：

#### 1. 性能与可读性：`reduce` vs `for...of`
虽然 `reduce` 是函数式编程的常用手段，但在仅仅是为了遍历累加的场景下，`reduce` 并不总是最佳选择：
*   **可读性**：对于初学者来说，`reduce` 的语义不如简单的循环直观。
*   **性能**：在极大规模数组的情况下，`reduce` 的性能通常略逊于传统的 `for` 循环或 `for...of` 循环（虽然 V8 引擎优化得很好，但差距仍存在）。
*   **建议**：如果追求极致性能或代码易读性，可以考虑使用 `for...of`。

#### 2. 使用 `Number.isNaN` 替代 `isNaN`
*   全局函数 `isNaN` 会尝试将参数转换为数字，具有一些怪异行为（例如 `isNaN('abc')` 为 `true`）。
*   ES6 引入的 `Number.isNaN` 更加安全，它只有在值严格为 `NaN` 时才返回 `true`，不会进行强制类型转换。
*   **注意**：在你的代码中，由于前面已经有了 `typeof curr !== 'number'` 的判断，其实已经过滤掉了字符串等情况，所以当前的 `isNaN` 也是安全的。但为了代码风格的现代性和严谨性，推荐使用 `Number.isNaN`。

#### 3. 浮点数精度问题
JavaScript 的数字类型基于 IEEE 754 双精度浮点数。当处理小数时，可能会遇到精度问题。
*   例如：`sum([0.1, 0.2])` 可能会返回 `0.30000000000000004` 而不是 `0.3`。
*   **建议**：这取决于函数的使用场景。如果该函数仅用于整数或一般展示，当前实现没问题。如果是用于金融计算或精确比较，建议在文档中注明，或者引入处理精度的逻辑（通常不在此工具函数内部处理，而是由调用方处理或使用 `BigInt`/第三方库）。

---

### 🛠️ 优化后的代码示例

基于以上建议，这里提供一个结合了 `for...of` 和现代 API 的优化版本供参考：

/**
 * 计算数组中所有元素的和
 * @param {number[]} numbers - 数字数组
 * @returns {number} 数组元素的总和
 */
export function sum(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('参数必须是数组');
  }

  let total = 0;
  
  // 使用 for...of 循环，可读性更好，性能在极端情况下略优
  for (const num of numbers) {
    // 使用 Number.isNaN 更加严谨，且符合 ES6+ 规范
    if (typeof num !== 'number' || Number.isNaN(num)) {
      throw new TypeError(`数组元素必须是有效数字，但发现了: ${num}`);
    }
    total += num;
  }
  
  return total;
}

### 📝 总结
你的原始代码已经达到了**生产环境可用的标准**，逻辑严密且健壮。我的建议更多是关于代码风格偏好和极端情况下的微调。如果这是一个通用工具库的一部分，现在的实现已经非常出色了！

**评分：⭐⭐⭐⭐⭐ (5/5)**
--------------------
thinking: 很好！我已经完成了：
1. 创建了一个 sum 函数，包含了完善的输入校验和错误处理
2. 使用 code_review 工具对代码进行了详细的审查

代码审查给出了很好的反馈，包括优点和建议改进的地方。现在我应该总结一下给用户。
assistant: 我已经完成了 sum 函数的编写和代码审查！

## 📝 代码实现

创建了一个健壮的 `sum` 函数，包含以下特性：
- ✅ 完善的输入校验（检查是否为数组）
- ✅ 元素类型验证（确保都是有效数字）
- ✅ 正确处理空数组（返回 0）
- ✅ 清晰的 JSDoc 文档注释

## 🔍 Code Review 结果

**总体评分：⭐⭐⭐⭐⭐ (5/5)**

**优点：**
- 输入校验完善，使用 `Array.isArray()` 和 `TypeError`
- 数据完整性检查，防止 NaN 和非数字类型
- 边界情况处理得当（空数组返回 0）
- 文档注释清晰

**建议改进：**
1. 可以使用 `for...of` 替代 `reduce` 提升可读性和性能
2. 使用 `Number.isNaN` 替代 `isNaN`（ES6 更严谨）
3. 注意浮点数精度问题的文档说明

代码已经达到生产环境可用标准！如果需要应用优化建议，我可以帮你更新代码。
```

## 资料
+ [SubAgent 讲解](https://github.com/shareAI-lab/learn-claude-code/blob/main/docs/zh/s04-subagent.md)
+ [Core Code for SubAgent](https://github.com/shareAI-lab/learn-claude-code/blob/main/agents/s04_subagent.py)
