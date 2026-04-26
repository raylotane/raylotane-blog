# 前置知识
> 文章：MCP stdio 传输机制 [https://blog.csdn.net/bit_mike/article/details/149883247](https://blog.csdn.net/bit_mike/article/details/149883247)
>

+ Process
+ Stdio
+ json-rpc

## Process
process，进程，某个数据集合的一次运行活动，一个应用会有多个进程。



终端也是一个进程、NodeJS 也是。

+ iterm2 终端进程

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760574275054-4b845fa9-d322-4ec6-87aa-2a906a090ace.png" width="1282" title="" crop="0,0,1,1" id="u22456e6b" class="ne-image">

+ Node 进程

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760574998641-d3948559-0ec0-4971-bc4b-b45acd4902b3.png" width="1468" title="" crop="0,0,1,1" id="yg2JY" class="ne-image">



## stdio
stdio（**<font style="color:rgb(25, 27, 31);">Standard Input and Output</font>**），标准输入输出协议。



<font style="color:rgb(25, 27, 31);">通过标准</font><font style="color:rgb(25, 27, 31);">输入</font><font style="color:rgb(25, 27, 31);">、</font><font style="color:rgb(25, 27, 31);">输出</font><font style="color:rgb(25, 27, 31);">和</font><font style="color:rgb(25, 27, 31);">错误</font><font style="color:#DF2A3F;">流</font><font style="color:rgb(25, 27, 31);">来进行数据的传输。</font>

+ **<font style="color:rgb(25, 27, 31);">标准输入（stdin）</font>**<font style="color:rgb(25, 27, 31);">：接收用户或系统输入的数据</font>
+ **<font style="color:rgb(25, 27, 31);">标准输出（stdout）</font>**<font style="color:rgb(25, 27, 31);">：将处理后的数据输出到终端或文件</font>
+ **<font style="color:rgb(25, 27, 31);">标准错误（stderr）</font>**<font style="color:rgb(25, 27, 31);">：输出错误信息，便于调试</font>

<font style="color:rgb(25, 27, 31);"></font>

<font style="color:rgb(25, 27, 31);">打印 Node 进程</font>

```tsx
process.stdout.write("hello world, node process: " + process.pid + "\n")

process.stdin.on("data", data => {
    console.log(data);
})
```

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760574998641-d3948559-0ec0-4971-bc4b-b45acd4902b3.png" width="1468" title="" crop="0,0,1,1" id="h1TG3" class="ne-image">

终端进程与 Node 进程通过 stdio 进行通信

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760575217746-ecbaa044-6b55-4af5-9ca0-fbd3d1e653a6.png" width="2004" title="" crop="0,0,1,1" id="W9zJ7" class="ne-image">

1. 终端启动 node 应用，参数为 server.js，node 新创建了一个子进程，父进程（终端）监听子进程
2. node 通过 stout 传输了数据（hello world, node process: 19418），终端收到后，显示了。
3. 终端通过 stin 传输了数据（how are you?）给子进程
4. 子进程收到后，通过 stout 传输数据（回复: how are you?）给父进程，父进程收到显示。

## json-rpc
> [JSON-RPC 2.0 规范(中文版)](https://wiki.geekdream.com/Specification/json-rpc_2.0.html)
>

JSON-RPC（**<font style="color:rgb(37, 41, 51);">Remote Procedure Call</font>**） 是一种基于 JSON 格式的轻量级远程过程调用（RPC）协议。也可以理解为**通信格式，通信双方约定的消息格式。**



**请求格式(****<font style="color:rgb(37, 41, 51);">Request</font>****)**

| 字段 | 值类型 | 备注 |
| --- | --- | --- |
| jsonrpc | string | 2.0 |
| method | string | 大写的方法名 |
| params | Array | object |  |
| id | number | string | null | <font style="color:rgb(37, 41, 51);">用于关联请求和响应的标识符。</font><br/><font style="color:rgb(37, 41, 51);"> 如果是 </font>`<font style="color:rgb(255, 80, 44);background-color:rgb(255, 245, 245);">null</font>`<font style="color:rgb(37, 41, 51);">，则表示这是一个通知 (Notification)，服务器不需要返回响应</font> |


```tsx
{
  "jsonrpc": "2.0", // 
  "method": "subtract",
  "params": [42, 23],
  "id": 1
}
```



**响应格式（****<font style="color:rgb(37, 41, 51);">Response</font>****）**

| 字段 | 值类型 | 备注 |
| --- | --- | --- |
| jsonrpc | string | 2.0 |
| result | string | 结果 |
| id | number | string | null | 同 Request |


```tsx
{
  "jsonrpc": "2.0",
  "result": 19, // 结果
  "id": 1
}
```

```tsx
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601, // 错误代码
    "message": "Method not found" // 错误信息
  },
  "id": 1
}
```

# 使用studio结合JOSN-PRC进行通信
<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760623315462-b7b889ec-519b-42ae-9130-597f86a6b2d7.png" width="892" title="" crop="0,0,1,1" id="u3b26cf61" class="ne-image">

```tsx
const fs = require("fs")

const add = ({ a, b }) => {
    return a + b
}

const createFile = ({ filePath, content }) => {
    fs.writeFileSync(filePath, content, { encoding: 'utf-8' })
    return "create file success in path: " + filePath
}

const utils = {
    add,
    createFile,
}

process.stdin.on("data", data => {
    const requestObj = JSON.parse(data)
    const id = requestObj.id
    const method = requestObj.method
    const params = requestObj.params
    const result = utils[method](params)

    const response = {
        jsonrpc: "2.0",
        result,
        id,
    }

    process.stdout.write("回复: " + JSON.stringify(response) + '\n')
})
```

```tsx
{"jsonrpc":"2.0","method":"add","params":{"a":33,"b":55},"id":1}

{"jsonrpc":"2.0","method":"createFile","params":{"filePath":"/Users/raloy/Desktop/demo.txt","content":"hello world!"},"id":1}
```

# MCP
**<font style="color:rgb(77, 77, 77);">MCP（Model Context Protocol），</font>**<font style="color:rgb(62, 62, 62);">为应用程序向 LLM 提供上下文的方式进行了标准化，为 AI 模型连接各种数据源和工具提供了标准化的接口。</font>

<font style="color:rgb(62, 62, 62);"></font>

## <font style="color:rgb(62, 62, 62);">通用架构</font>
> [https://mcp-docs.cn/introduction#%E9%80%9A%E7%94%A8%E6%9E%B6%E6%9E%84](https://mcp-docs.cn/introduction#%E9%80%9A%E7%94%A8%E6%9E%B6%E6%9E%84)
>

<font style="color:rgb(62, 62, 62);">MCP 核心采用客户端-服务器架构，主机应用可以连接多个服务器：</font>

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760657683954-0d911db7-61de-410c-b7cd-7e9f185dbe17.png" width="1366" title="" crop="0,0,1,1" id="u81b48b9f" class="ne-image">

+ **<font style="color:rgb(23, 23, 23);">MCP Hosts</font>**<font style="color:rgb(62, 62, 62);">: 如 Claude Desktop、IDE 或 AI 工具，希望通过 MCP 访问数据的程序</font>
+ **<font style="color:rgb(23, 23, 23);">MCP Clients</font>**<font style="color:rgb(62, 62, 62);">: 维护与服务器一对一连接的协议客户端</font>
+ **<font style="color:rgb(23, 23, 23);">MCP Servers</font>**<font style="color:rgb(62, 62, 62);">: 轻量级程序，通过标准的 Model Context Protocol 提供特定能力</font>
+ **<font style="color:rgb(23, 23, 23);">本地数据源</font>**<font style="color:rgb(62, 62, 62);">: MCP 服务器可安全访问的计算机文件、数据库和服务</font>
+ **<font style="color:rgb(23, 23, 23);">远程服务</font>**<font style="color:rgb(62, 62, 62);">: MCP 服务器可连接的互联网上的外部系统（如通过 APIs）</font>



## MCP 通信格式标准
<font style="color:rgb(62, 62, 62);">MCP 使用 </font>[<font style="color:rgb(17, 24, 39);">JSON-RPC</font>](https://www.jsonrpc.org/)<font style="color:rgb(62, 62, 62);"> 2.0 作为其传输格式，分别有三种类型：</font>

+ 请求
+ 响应
+ 通知



```tsx
{
  jsonrpc: "2.0",
  id: number | string,
  method: string,
  params?: object // 具体看官网，对不同的请求，有不同的要求
}
```

```tsx
{
  jsonrpc: "2.0",
  id: number | string,
  result?: object
  error?: {
    code: number,
    message: string,
    data?: unknown
  }
}

```

```tsx
{
  jsonrpc: "2.0",
  method: string | 'notifications/initialized',
  params?: object
}
```

## MCP 交互链路
> **<font style="color:rgb(77, 77, 77);">MCP 完整交互链路解读：</font>**[**https://zhuanlan.zhihu.com/p/30515707345**](https://zhuanlan.zhihu.com/p/30515707345)
>

核心交互

![](https://cdn.nlark.com/yuque/__puml/ad74f28ef0a9d16374e22f45e2432580.svg)

## MCP-MVP
> MCP核心实现
>
> 1. 首先使用JS，依据MCP协议规范书写相关的方法的请求与响应处理：initialize、tools/list、tools/call
> + 在 server.js 目录执行 `npx @modelcontextprotocol/inspector`进行测试
>

```tsx
process.stdin.setEncoding('utf-8')

const utils = require("./utils")

process.stdin.on("data", data => {

    const requestObj = JSON.parse(data)
    const id = requestObj.id
    const { method, params } = requestObj
    let result = null;
    if (method === 'tools/call') {
        result = utils[method](params)

    } else if (method in utils) {
        result = utils[method](params)

    } else {
        return
    }

    const response = {
        jsonrpc: "2.0",
        result,
        id,
    }

    process.stdout.write(JSON.stringify(response) + '\n')
})
```

```tsx
const fs = require("fs")

const add = ({ a, b }) => {
    return {
        content: [{
            type: 'text',
            text: a + b + ""
        }]
    }
}

const createFile = ({ filePath, content }) => {
    fs.writeFileSync(filePath, content, { encoding: 'utf-8' })
    return {
        content: [{
            type: 'text',
            text: "create file success in path: " + filePath
        }]
    }
}

const utils = {
    add,
    createFile,
}

const initialize = () => {
    return {
        "protocolVersion": "2025-06-18",
        "capabilities": {
            "tools": {
                "listChanged": true
            },
            "resources": {}
        },
        "serverInfo": {
            "name": "example-server",
            "version": "1.0.0"
        }
    }
}

const toolList = () => {
    return {
        "tools": [
            {
                "name": "add",
                "description": "计算两个数的和",
                "inputSchema": {
                    type: "object",
                    properties: {
                        a: {
                            type: 'number',
                            descrition: '第一个数'
                        },
                        b: {
                            type: 'number',
                            descrition: '第二个数'
                        }
                    }
                }
            },
            {
                "name": "createFile",
                "description": "创建文件",
                "inputSchema": {
                    type: "object",
                    properties: {
                        filePath: {
                            type: 'string',
                            descrition: '完整的文件路径'
                        },
                        content: {
                            type: 'string',
                            descrition: '文件内容'
                        }
                    }
                }
            }
        ]
    }
}

const toolCall = ({ name, arguments }) => {
    const result = utils[name](arguments)
    return result
}

module.exports = {
    initialize,
    "tools/list": toolList,
    "tools/call": toolCall,
}
```

<img src="https://cdn.nlark.com/yuque/0/2025/png/2679454/1760712973105-9ca17b67-5c58-473e-82a3-ab8f817eeb7f.png" width="3204" title="" crop="0,0,1,1" id="u04a52d3d" class="ne-image">
