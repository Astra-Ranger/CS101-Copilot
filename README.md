<p align="center">
  <img src="frontend/assets/cs101-copilot-logo.png" alt="CS101_Copilot" width="340" />
</p>

<p align="center">
  <strong>面向 CS101 课程的 AI 学习工作台</strong>
</p>

<p align="center">
  课件阅读 · RAG 问答 · 引用跳转 · 智能笔记 · 练习题 · 划重点 · 思维导图
</p>

CS101_Copilot 将课程 slide、Markdown 资料、ChromaDB 向量库和多模型接口整合在同一个 Flask + 原生前端应用中。学生可以边看课件边提问、记录笔记、生成练习题、提炼重点，并通过引用快速跳回来源页核对内容。

## 功能矩阵

| 模块 | 能力 |
| --- | --- |
| 课件阅读 | 课程选择、slide 浏览、页码跳转、滚动定位、缩放 |
| RAG 问答 | 意图路由、向量检索、当前页图片理解、流式回答 |
| 来源引用 | 圆形引用标记、悬停提示、点击跳转、跨课程跳转 |
| 对话记忆 | 新建对话、历史对话、删除对话、自动恢复最近对话 |
| 对话标题 | 首问生成标题、当前课程优先、课程开场建议 |
| Markdown 笔记 | 多笔记本、自动保存、公式插入、标题生成、导出 `.md` |
| AI 补全 | 光标处 ghost、`Tab` 接受、可独立配置模型 |
| 练习题 | 自动出题、选择题、判断题、即时反馈、来源跳转 |
| 划重点 | 重点提炼、重要程度标签、复习说明、来源跳转 |
| 思维导图 | 当前课件 / 全体课件、聚焦主题、2-4 层结构 |
| 导图交互 | 展开折叠、缩放、节点追问、导出 PNG / PDF |
| 设置面板 | 模型接口、thinking 开关、回答语气 |

## 界面能力

- 左侧：课件阅读器和课程笔记。
- 右侧：AI Chat 学习助手。
- 顶部：课程选择和模型设置。
- 学习工具：练习题、划重点、思维导图。
- 引用系统：回答、题目、重点、导图都能回跳 slide。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Flask、SSE、Pydantic、httpx |
| 检索 | ChromaDB、LangChain Chroma |
| 模型 | OpenAI-compatible Chat Completions |
| 前端 | HTML、CSS、JavaScript |
| 渲染 | Markdown、MathJax、D3 |
| 存储 | 本地 JSON、ChromaDB |

## 项目结构

```text
backend/
  main.py                    # Flask 路由
  rag_service.py             # RAG 与学习工具
  rag_models.py              # 请求和响应模型
  model_client.py            # 模型调用
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

## 公开发布脱敏

`backend/config/siliconflow_models.json` 已被 Git 跟踪。公开发布到 GitHub 前，请生成脱敏 worktree：

```bash
python3 scripts/prepare_github_public_branch.py
cd /private/tmp/cs101-copilot-github-public
git add -A
git commit -m "Update public release"
git push github HEAD:main
```

该流程会清空公开版本中的 `api_key` 字段，同时保留内部仓库的默认 key。

## 本地数据

以下文件不建议提交到公开仓库：

```text
backend/user_settings.json
backend/chat_conversations.json
backend/note_notebooks.json
```

公开发布前也请确认课程资料可分发：

```text
course_data/
course_slide/
chroma_db/
```

## 开发检查

后端检查：

```bash
PYTHONPYCACHEPREFIX=/private/tmp/codex_pycache python3 -m py_compile backend/main.py backend/model_client.py backend/rag_service.py backend/rag_models.py backend/config_loader.py backend/settings_store.py
```

前端检查：

```bash
for f in frontend/js/*.js frontend/app.js; do node --check "$f" || exit 1; done
```

配置检查：

```bash
python3 -m json.tool backend/config/local_models.json
python3 -m json.tool backend/config/siliconflow_models.json
python3 -m json.tool backend/config/model_tasks.json
python3 -m json.tool backend/config/prompts.json
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
