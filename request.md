# 后端实现要求

本文档整理当前阶段后端需要实现的功能，目标是先打通课件读取、课件图片访问、学习笔记保存和 AI 聊天接口预留。

## 1. 总体目标

第一阶段不要先做复杂 AI，优先完成以下闭环：

1. 后端从本地课件目录读取课程 slide。
2. 前端可以获取某门课程的 slide 元数据。
3. 前端可以通过后端接口加载每一页课件图片。
4. 后端预留学习笔记保存接口。
5. 后端预留基于课程和当前笔记的 AI 聊天接口。

最小可运行版本优先完成：

```text
GET /api/slides/<course_id>
GET /api/slides/<course_id>/pages/<page_number>
```

## 2. 课件目录规则

后端需要读取环境变量：

```text
COURSE_SLIDE_ROOT
```

该变量指向课件根目录。

课件目录结构约定如下：

```text
COURSE_SLIDE_ROOT/
  course_slide/
    week16/
      计科导-16-期末复习/
        page_001.webp
        page_002.webp
        page_003.webp
```

后端按两级目录识别课程：

```text
course_slide/<week>/<deckName>
```

课程真实 ID 使用以下格式：

```text
{week}--{deckName}
```

示例：

```text
week16--计科导-16-期末复习
```

开发阶段需要保留课程别名：

```text
demo-course -> week16--计科导-16-期末复习
```

## 3. Slide 文件规则

后端只统计符合以下命名规则的文件：

```text
page_001.webp
page_002.webp
page_003.webp
```

规则说明：

- 文件名必须匹配 `page_<数字>.webp`。
- 页码从文件名中的数字解析。
- 返回时页码使用整数，例如 `page_001.webp` 对应 `pageNumber: 1`。
- 排序必须使用页码数字顺序，也就是自然排序。
- 不能让 `page_010.webp` 排在 `page_002.webp` 前面。

## 4. 接口一：获取课程 Slide 元数据

```http
GET /api/slides/<course_id>
```

### 作用

返回某门课程的 slide 元数据。

### Path Params

```text
course_id
```

说明：

- 可以是真实课程 ID，例如 `week16--计科导-16-期末复习`。
- 也可以是课程别名，例如 `demo-course`。

### 后端要求

1. 支持课程别名解析。
2. 校验课程目录是否存在。
3. 只扫描可信课件目录下的文件。
4. 只返回符合 `page_001.webp` 这类规则的 slide 文件。
5. 按页码数字顺序返回 slide 列表。
6. 返回浏览器可以直接加载的图片 URL。
7. 不允许把本地原始文件路径返回给前端，避免路径泄露。

### 成功响应示例

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
    },
    {
      "pageNumber": 2,
      "title": "第 2 页",
      "imageUrl": "/api/slides/demo-course/pages/2"
    }
  ]
}
```

### 可能错误

```text
404 COURSE_NOT_FOUND: 课程 ID 无法解析或课程不存在。
500: 课件目录扫描失败或其他未知后端错误。
```

## 5. 接口二：获取某一页课件图片

```http
GET /api/slides/<course_id>/pages/<page_number>
```

### 作用

返回某一页真实课件图片。

### Path Params

```text
course_id: 课程 ID，规则同 GET /api/slides/<course_id>。
page_number: 从 1 开始的正整数页码。
```

### 后端要求

1. 使用和 `GET /api/slides/<course_id>` 相同的课程解析逻辑。
2. 校验课程是否存在。
3. 校验页码是否合法，页码必须是从 1 开始的正整数。
4. 只从可信课程目录中解析图片文件。
5. 最终解析出的图片文件路径必须仍然位于 `COURSE_SLIDE_ROOT` 内，防止路径穿越。
6. 成功时返回图片二进制内容。
7. 成功响应的 `Content-Type` 必须是：

```http
image/webp
```

### 成功响应

```text
200 image/webp
```

### 可能错误

```text
400 INVALID_SLIDE_PAGE: 页码非法。
404 COURSE_NOT_FOUND: 课程不存在。
404 SLIDE_NOT_FOUND: 对应图片不存在。
500: 未知后端错误。
```

## 6. 路径安全要求

后端不能相信客户端传入的路径相关内容。

要求：

1. 客户端只允许传 `course_id` 和 `page_number`。
2. 客户端不能传本地文件路径。
3. 后端根据 `COURSE_SLIDE_ROOT`、`course_id` 和页码自行解析文件路径。
4. 解析路径后必须检查最终路径仍在 `COURSE_SLIDE_ROOT` 内。
5. 不能允许 `../` 等路径穿越行为读取课件目录外的文件。

## 7. 学习笔记保存接口

该接口可以在第二阶段实现，当前可以先预留。

```http
PUT /api/courses/<course_id>/note
```

### 作用

保存用户在某门课程下的学习笔记。

### 请求体

```json
{
  "content": "用户笔记内容"
}
```

### 成功响应示例

```json
{
  "success": true,
  "savedAt": "2026-05-20T12:00:00.000Z"
}
```

### 后端要求

1. 用户身份应从登录态或 session 中获取，不要从请求体读取 `userId`。
2. 笔记按 `userId + courseId` 维度保存。
3. `savedAt` 使用服务端时间。
4. 时间格式采用 ISO-8601。
5. 如果后续支持多人协作或多端编辑，需要增加版本号和冲突处理。

如果当前还没有登录系统，可以临时使用开发用户：

```text
DEV_USER_ID = "dev-user"
```

但接口结构应按真实用户场景设计，方便后续替换。

### 可能错误

```text
400 INVALID_NOTE_CONTENT: 笔记内容非法。
401 UNAUTHENTICATED: 用户未登录。
403 COURSE_ACCESS_DENIED: 用户无权访问课程。
404 COURSE_NOT_FOUND: 课程不存在。
500: 未知后端错误。
```

## 8. AI 聊天接口

该接口可以在第三阶段实现，当前可以先预留普通 JSON 接口，不急着做流式响应。

```http
POST /api/courses/<course_id>/chat
```

### 作用

根据课程内容、slide 上下文和用户当前笔记，生成 AI 回复。

### 请求体

```json
{
  "message": "帮我总结第 5 页",
  "currentNote": "用户当前笔记内容"
}
```

### 后端未来流程

```text
根据 courseId 检索课程和 slide 上下文
读取 currentNote 作为用户当前学习上下文
将课程内容、相关 slide 和 currentNote 交给 RAG/LLM 流程
调用后端 RAG 或大模型服务生成回复
回复中保留 [引用第5页] 这样的引用格式
返回 answer 和 citations
```

### 成功响应示例

```json
{
  "answer": "这里是回答内容，[引用第5页]",
  "citations": [
    {
      "pageNumber": 5,
      "label": "第 5 页"
    }
  ]
}
```

### 后端要求

1. 根据 `courseId` 检索课程和 slide 上下文。
2. 将 `currentNote` 作为用户当前学习上下文传给 RAG/LLM 流程。
3. 调用后端 RAG 或大模型服务生成回复。
4. 回复中继续保留 `[引用第5页]` 这样的引用格式，因为前端会把这种文本解析成可点击的 slide 跳转按钮。
5. 后续可以升级为流式响应，建议使用 `text/event-stream`，或者兼容 AI SDK 的 message stream 协议。

### 可能错误

```text
400 INVALID_CHAT_REQUEST: 请求体格式错误。
401 UNAUTHENTICATED: 用户未登录。
403 COURSE_ACCESS_DENIED: 用户无权访问课程。
404 COURSE_NOT_FOUND: 课程不存在。
429 MODEL_RATE_LIMITED: 模型服务限流。
502 MODEL_PROVIDER_ERROR: 模型服务调用失败。
500: 未知后端错误。
```

## 9. 推荐开发顺序

建议按以下顺序实现：

1. 读取 `COURSE_SLIDE_ROOT` 环境变量。
2. 实现课程 ID 解析函数，支持真实 ID 和 `demo-course`。
3. 实现课程目录定位函数。
4. 实现 slide 文件扫描函数，只识别 `page_001.webp` 这类文件。
5. 实现自然排序，按页码数字排序。
6. 实现 `GET /api/slides/<course_id>`。
7. 实现 `GET /api/slides/<course_id>/pages/<page_number>`。
8. 增加路径安全校验，防止路径穿越。
9. 实现或预留 `PUT /api/courses/<course_id>/note`。
10. 实现或预留 `POST /api/courses/<course_id>/chat`。

## 10. 当前阶段优先级

当前阶段必须先完成：

```text
P0: GET /api/slides/<course_id>
P0: GET /api/slides/<course_id>/pages/<page_number>
```

完成 P0 后，前端就能真正加载课件。

后续再做：

```text
P1: PUT /api/courses/<course_id>/note
P2: POST /api/courses/<course_id>/chat
```
