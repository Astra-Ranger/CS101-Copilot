<p align="center">
  <img src="frontend/assets/cs101-copilot-logo.png" alt="CS101_Copilot" width="520" />
</p>

CS101 Copilot 是一个面向大湾区大学《计算机科学导论》课程的智能学习助手。项目将ChromaDB 向量检索、课件、多轮对话、笔记本和模型配置整合在同一个 Flask + 静态前端应用中，帮助学生围绕当前课件完成提问、复习、记录和跳转溯源。

## 项目定位

这是一个课程学习类 RAG 应用，核心目标不是做通用聊天机器人，而是围绕 CS101 课件提供“能引用来源、有全局视野、能保存学习过程”的学习工作台。

系统会根据用户问题判断是否需要读取课程知识库、当前 slide 图片或仅进行普通对话；回答中会保留可点击的页码引用，方便学生回到对应课件页验证内容。

## 核心功能

- 课程课件浏览：加载 `course_slide/` 中的课件页图片，支持按课程和页码阅读。
- RAG 问答：基于 `chroma_db/` 中的 `cs101_course_markdown` collection 检索课程 Markdown 切块。
- 多模态回答：涉及“这页、图中、公式、代码”等问题时，会读取当前页 WebP 图片并传给模型。
- 溯源引用：回答中以 `【P5】` 或 `【courseId-5】` 标注来源，前端可点击跳转到对应 slide。
- 流式状态：聊天过程中通过 SSE 实时显示“分析输入”“读取知识库”“思考”等状态。
- 对话记忆：支持新建对话、历史对话、删除历史，并保存完整消息。
- 课程开场总结：新对话会根据当前课程在 Chroma 中的标题大纲生成简短学习建议。
- 多笔记本：左侧笔记不绑定课程，支持自动保存、Markdown 编辑、导出 `.md`。
- AI 自动补全：笔记区可基于当前页文本和上一条 AI 回答生成灰色补全，按 Tab 接受。
- 模型设置：右上角设置面板可配置替代本地部署 API、自动补全 API 和回答模式。

## 技术栈

- 后端：Flask、SSE、Pydantic、httpx
- 检索：ChromaDB、LangChain Chroma、HuggingFace Embeddings
- 模型接口：OpenAI-compatible `/v1/chat/completions`
- 前端：原生 HTML / CSS / JavaScript
- Markdown 与公式：自写 Markdown 渲染逻辑 + 本地 MathJax
- 持久化：本地 JSON 文件保存对话、笔记本和用户设置

## 目录结构

```text
backend/
  main.py                  # Flask 路由、SSE 桥接、静态资源入口
  rag_service.py           # RAG 路由、检索、多模态装配、最终回答
  model_client.py          # 模型 provider、任务映射和 OpenAI-compatible 调用
  settings_store.py        # 本地用户设置读写
  conversation_store.py    # 对话历史存储
  notebook_store.py        # 笔记本 JSON 存储
  notebook_service.py      # 笔记保存、标题生成、导出逻辑
  config/
    local_models.json      # 本地部署模型默认配置
    siliconflow_models.json# 外部模型默认配置
    model_tasks.json       # 各任务使用的 provider
    prompts.json           # Router、回答、标题、补全等 prompt

frontend/
  index.html               # 主页面
  styles.css               # UI 样式
  app.js                   # 课件、聊天、笔记和设置交互
  assets/                  # 前端图形资源

chroma_db/                 # ChromaDB 向量库
course_data/               # 课程 Markdown
course_slide/              # 课件页图片
```

## 本地运行

先安装后端依赖：

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

启动 Flask：

```bash
.venv/bin/python backend/main.py
```

默认访问地址：

```text
http://127.0.0.1:5001
```

可以通过环境变量调整服务地址：

```bash
FLASK_HOST=127.0.0.1 FLASK_PORT=5001 .venv/bin/python backend/main.py
```

## 模型配置

默认模型 provider 写在：

- `backend/config/local_models.json`
- `backend/config/siliconflow_models.json`
- `backend/config/model_tasks.json`

页面右上角“三点”设置面板可以覆盖运行时配置：

- 替代本地部署 API：用于替换本地 `qwen` / `deepseek` provider。
- 自动补全 API：用于替换笔记自动补全 provider。
- 回答模式：可在“友好”和“严肃”之间切换，只影响最终回答语气。

用户运行时设置会保存到：

```text
backend/user_settings.json
```

该文件只用于本地单用户配置，不应提交到 Git。
