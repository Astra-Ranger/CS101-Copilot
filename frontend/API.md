# 前端接口说明

这份文档说明 `frontend/app.js` 这个静态前端期望后端提供的全部接口。

当前 Flask 后端仍然只是一个空壳：它负责启动服务、托管静态前端页面，并为未来业务接口预留路由。除了 `/health` 之外，大多数业务接口目前都会返回 `501 NOT_IMPLEMENTED`。当前前端在课程接口不可用时，会自动回退到 `frontend/slides-manifest.js` 里的本地 mock 数据。

## 通用错误格式

所有 JSON 接口的错误响应建议统一使用下面的格式：

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

字段说明：

- `error`：机器可读的错误码，例如 `COURSE_NOT_FOUND`。
- `message`：给开发者或前端展示用的错误说明。
- `details`：可选字段，用于放更细的错误上下文。

## `GET /health`

用于检查 Flask 服务是否正常运行。

响应示例：

```json
{
  "status": "ok"
}
```

## `GET /api/courses`

返回所有可选课件，用于左侧课件栏顶部的课程选择器。

### 后端实现要求

- 读取环境变量 `COURSE_SLIDE_ROOT` 指向的课件根目录。
- 按两级目录识别课件：`course_slide/<week>/<deckName>`。
- 课程 ID 使用 `{week}--{deckName}` 格式。
- 保留开发别名：`demo-course` 指向 `week16--计科导-16-期末复习`。
- 只统计符合 `page_001.webp`、`page_002.webp` 这类命名规则的文件。
- 课程排序建议使用自然排序，避免 `week10` 排在 `week2` 前面。

### 响应示例

```json
{
  "aliases": {
    "demo-course": "week16--计科导-16-期末复习"
  },
  "courses": [
    {
      "id": "week16--计科导-16-期末复习",
      "week": "week16",
      "title": "计科导-16-期末复习",
      "pageCount": 20
    }
  ]
}
```

### 可能错误

- `500`：课件目录扫描失败或其他未知后端错误。

## `GET /api/slides/<course_id>`

返回某一门课程的 slide 元数据。

### Path Params

- `course_id`：课程 ID，可以是真实 ID，例如 `week16--计科导-16-期末复习`，也可以是别名 `demo-course`。

### 后端实现要求

- 支持课程别名解析。
- 校验课程是否存在。
- 按页码数字顺序返回 slide 列表。
- 返回浏览器可以直接加载的图片 URL。
- 不允许客户端传入原始文件路径，避免路径穿越风险。

### 响应示例

```json
{
  "courseId": "demo-course",
  "resolvedCourseId": "week16--计科导-16-期末复习",
  "week": "week16",
  "title": "计科导-16-期末复习",
  "slides": [
    {
      "pageNumber": 1,
      "title": "第 1 页",
      "imageUrl": "/api/slides/demo-course/pages/1"
    }
  ]
}
```

### 可能错误

- `404 COURSE_NOT_FOUND`：课程 ID 无法解析或课程不存在。
- `500`：未知后端错误。

## `GET /api/slides/<course_id>/pages/<page_number>`

返回某一页真实课件图片。

### Path Params

- `course_id`：课程 ID，规则同 `GET /api/slides/<course_id>`。
- `page_number`：从 1 开始的正整数页码。

### 后端实现要求

- 使用和 `GET /api/slides/<course_id>` 相同的课程解析逻辑。
- 校验页码是否合法。
- 只从可信任的课程目录中解析图片文件。
- 解析最终文件路径后，必须确认它仍然位于 `COURSE_SLIDE_ROOT` 内，防止路径穿越。
- 成功时返回 `Content-Type: image/webp`。

### 成功响应

- `200 image/webp`

### 可能错误

- `400 INVALID_SLIDE_PAGE`：页码非法。
- `404 COURSE_NOT_FOUND`：课程不存在。
- `404 SLIDE_NOT_FOUND`：对应页图片不存在。

## `POST /api/notes/<course_id>`

保存用户在某门课程下的笔记。

### 当前前端行为

- 笔记内容会先立即保存到 `localStorage`。
- 停止输入 2 秒后，前端会执行一次 mock 自动保存，并在控制台输出 `笔记已保存`。
- 当前前端暂时还没有真正调用这个接口，但后端路由已经预留。

### 请求体

```json
{
  "content": "用户笔记内容"
}
```

### 响应示例

```json
{
  "success": true,
  "savedAt": "2026-05-15T12:00:00.000Z"
}
```

### 后端未来实现要求

- 用户身份应该从登录态或 session 中获取，不要从请求体里读取 `userId`。
- 笔记需要按 `userId + courseId` 维度保存。
- `savedAt` 使用服务端时间，并采用 ISO-8601 格式。
- 如果后续引入多人协作或多端编辑，需要增加版本号和冲突处理。

### 可能错误

- `400 INVALID_NOTE_CONTENT`：笔记内容非法。
- `401 UNAUTHENTICATED`：用户未登录。
- `403 COURSE_ACCESS_DENIED`：用户无权访问课程。
- `409 NOTE_VERSION_CONFLICT`：笔记版本冲突。

## `POST /api/chat`

根据当前课程、对话历史和用户笔记，生成 AI 助手回复。

### 当前前端行为

- Chat 当前完全在 `frontend/app.js` 中 mock。
- 前端暂时还没有真正调用这个接口，但后端路由已经预留。

### 请求体

```json
{
  "courseId": "demo-course",
  "currentNote": "当前笔记内容",
  "messages": [
    {
      "role": "user",
      "content": "解释一下第 5 页"
    }
  ]
}
```

字段说明：

- `courseId`：当前课程 ID。
- `currentNote`：右侧笔记编辑器中的当前内容。
- `messages`：历史消息列表，建议按时间升序排列。

消息对象建议格式：

```json
{
  "id": "optional-message-id",
  "role": "user",
  "content": "消息内容"
}
```

`role` 可选值：

- `user`
- `assistant`
- `system`

### 非流式响应示例

```json
{
  "role": "assistant",
  "content": "可以先看定义页 [引用第5页]，再看示例页 [引用第12页]。"
}
```

### 后端未来实现要求

- 根据 `courseId` 检索课程和 slide 上下文。
- 将 `currentNote` 作为用户当前学习上下文传给 RAG/LLM 流程。
- 调用后端的 RAG 或大模型服务生成回复。
- 回复中继续保留 `[引用第5页]` 这样的引用格式，因为前端会把这种文本解析成可点击的 slide 跳转按钮。
- 后续可以升级为流式响应，建议使用 `text/event-stream`，或者兼容 AI SDK 的 message stream 协议。

### 可能错误

- `400 INVALID_CHAT_REQUEST`：请求体格式错误。
- `401 UNAUTHENTICATED`：用户未登录。
- `403 COURSE_ACCESS_DENIED`：用户无权访问课程。
- `429 MODEL_RATE_LIMITED`：模型服务限流。
- `502 MODEL_PROVIDER_ERROR`：模型服务调用失败。

## 前端当前回退逻辑

当前后端业务接口没有实现，所以前端做了下面的兼容：

- 请求 `GET /api/courses` 失败时，回退到 `frontend/slides-manifest.js`。
- 请求 `GET /api/slides/<course_id>` 失败时，根据本地 manifest 生成 slide 列表。
- Chat 不请求后端，直接用 `setTimeout` 生成 mock assistant 消息。
- Notes 不请求后端，先写入 `localStorage`，再执行 mock 自动保存。

等后端实现本文件里的接口后，前端可以逐步移除这些 fallback/mock 逻辑。
