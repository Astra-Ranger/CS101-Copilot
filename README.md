<p align="center">
  <img src="frontend/assets/cs101-copilot-logo.png" alt="CS101_Copilot" width="340" />
</p>

<p align="center">
  <strong>面向 CS101 课程的 AI 学习工作台</strong>
</p>

<p align="center">
  RAG 问答 · 数字人讲解 · 引用溯源 · 智能笔记 · AI 复习工具
</p>

CS101_Copilot 是面向大湾区大学计算机科学导论（CS101）课程开发的 AI 智能学习助手。项目以课程内容为核心构建 RAG 学习工作流，整合课程文本、课件、向量数据库、图片理解和数字人讲解，把问答、笔记、练习、重点、导图和讲解视频串成可溯源、可复盘的复习闭环。

## 设计思想

| 方向 | 说明 |
| --- | --- |
| 看见材料 | 以课件为学习现场，同时理解课程文本与页面图像。 |
| 基于证据 | 回答、视频、导图、练习题和重点提炼都保留来源引用，降低幻觉风险。 |
| 系统视野 | 支持跨课程检索知识点，并指引用户跳转到对应课件位置。 |
| 主动协同 | 不止被动问答，也能在笔记书写、复习整理和数字人讲解中主动辅助。 |
| 形成闭环 | 阅读、提问、讲解、练习和引用回看在同一个工作台内联动。 |

## 功能矩阵

| 模块 | 能力 |
| --- | --- |
| 课件阅读 | 课程选择、slide 浏览、页码跳转、滚动定位、缩放 |
| RAG 课程问答 | 检索向量库并按需读取文本和图片，结合上下文流式回答 |
| 引用溯源跳转 | 圆形引用标记、悬停提示、点击跳转、跨课程跳转 |
| 对话记忆 | 新建对话、历史对话、删除对话、自动恢复最近对话 |
| 对话标题 | 首问生成标题、当前课程优先、课程开场建议 |
| Markdown 笔记 | 多笔记本、自动保存、公式插入、标题生成、导出 `.md` |
| AI 笔记补全 | 结合输入、课件和问答，在书写中给出光标处补全建议 |
| 自动练习题 | 基于课件生成选择题和判断题，支持即时反馈和来源跳转 |
| AI 划重点 | 提炼核心概念、重要程度和复习说明，并保留来源页 |
| 思维导图生成 | 当前课件 / 全体课件、聚焦主题、2-4 层结构 |
| 导图交互 | 展开折叠、缩放、节点追问、导出 PNG / PDF |
| 数字人讲解 | 按本节课或知识点生成讲解视频，显示字幕并同步跳转 slide |
| 设置面板 | 模型接口、thinking 开关、回答语气 |

## 界面能力

- 左侧：课件阅读器和课程笔记，以课件为学习现场。
- 右侧：AI Chat 学习助手，围绕当前内容或全局知识回答。
- 顶部：课程选择和模型设置。
- 学习工具：练习题、划重点、思维导图、数字人讲解。
- 引用系统：回答、题目、重点、导图都能回跳 slide。
- 数字人讲解：选择知识点或本节课，生成带字幕的视频；播放到引用句时自动跳转对应课件页。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端服务 | Flask、Pydantic、SSE、httpx，管理问答、笔记与数字人任务 |
| 检索增强 | ChromaDB、LangChain Chroma、bge-m3 embedding |
| 模型接口 | OpenAI-compatible Chat Completions |
| 数字人视频 | 百度智能云曦灵、WebVTT 字幕、本地媒体存储 |
| 前端工作台 | 原生 HTML、CSS、JavaScript |
| 内容渲染 | Markdown、MathJax、D3 |
| 存储 | 本地 JSON、ChromaDB |

## 项目结构

```text
backend/
  main.py                    # Flask 路由
  rag_service.py             # RAG 与学习工具
  rag_models.py              # 请求和响应模型
  model_client.py            # 模型调用
  baidu_digital_human_client.py
  digital_human_service.py
  digital_human_store.py
  conversation_store.py      # 对话存储
  notebook_store.py          # 笔记本存储
  notebook_service.py        # 笔记服务
  settings_store.py          # 用户设置
  config/
    local_models.json
    siliconflow_models.json
    model_tasks.json
    prompts.json

frontend/
  index.html
  styles.css
  app.js
  js/
    digital-human.js
    state.js
    api.js
    course-slides.js
    markdown.js
    learning-tools.js
    mindmap.js
    chat-rendering.js
    chat-flow.js
    notebook-data.js
    notebook-editor.js
    notebook-autocomplete.js
    notebook-toolbar.js

chroma_db/
course_data/
course_slide/
backend/digital_human_media/
```

## 快速开始

安装依赖：

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

启动服务：

```bash
.venv/bin/python backend/main.py
```

默认访问：

```text
http://127.0.0.1:5001
```

指定地址：

```bash
FLASK_HOST=127.0.0.1 FLASK_PORT=5001 .venv/bin/python backend/main.py
```

## 配置

参考 `.env.example`：

```text
FLASK_HOST=127.0.0.1
FLASK_PORT=5001
FLASK_DEBUG=1
COURSE_SLIDE_ROOT=course_slide
COURSE_NOTES_PATH=backend/user_notes.json
COURSE_CHAT_HISTORY_PATH=backend/chat_conversations.json
COURSE_NOTEBOOK_PATH=backend/note_notebooks.json
COURSE_USER_SETTINGS_PATH=backend/user_settings.json
CHROMA_PERSIST_DIR=chroma_db
CHROMA_COLLECTION_NAME=cs101_course_markdown
EMBEDDING_MODEL=BAAI/bge-m3
HF_ENDPOINT=https://hf-mirror.com

BAIDU_DH_AUTHORIZATION=
BAIDU_DH_BASE_URL=https://open.xiling.baidu.com
BAIDU_DH_FIGURE_ID=2646047
BAIDU_DH_TTS_PERSON=5132
BAIDU_DH_TTS_SPEED=5
BAIDU_DH_TTS_VOLUME=5
BAIDU_DH_TTS_PITCH=5
BAIDU_DH_BACKGROUND_IMAGE_URL=
BAIDU_DH_VIDEO_WIDTH=1280
BAIDU_DH_VIDEO_HEIGHT=720
BAIDU_DH_MEDIA_ROOT=backend/digital_human_media
BAIDU_DH_HISTORY_PATH=backend/digital_human_lectures.json
```

模型配置：

```text
backend/config/local_models.json
backend/config/siliconflow_models.json
backend/config/model_tasks.json
backend/config/prompts.json
```

运行时设置：

```text
backend/user_settings.json
```

## 本地数据

以下文件不建议提交到公开仓库：

```text
backend/user_settings.json
backend/chat_conversations.json
backend/note_notebooks.json
backend/digital_human_lectures.json
backend/digital_human_media/
```

## 许可证

本项目基于 GNU General Public License v2.0 or later 发布。详见 [LICENSE](LICENSE)。

## 作者

- [Sirui Liang](https://astra-ranger.github.io/)
- [Bohan Deng](https://bohan.bohandeng102647.workers.dev/)
- Weinan Guan

## Completed by

[Sirui Liang](https://astra-ranger.github.io/), [Bohan Deng](https://bohan.bohandeng102647.workers.dev/), and Weinan Guan.

## 致谢

感谢徐志伟老师与李晓明老师为计算机科学教育做出的贡献，赋予了本项目最核心的价值。
