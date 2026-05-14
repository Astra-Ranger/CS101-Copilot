这是一个非常“专业级”的 UI 设计！Slide（资料源） + Chat（大模型辅助） + 笔记（你的个人产出），这其实已经非常接近现代科研工作者和程序员使用的终极生产力工具形态了。

要支撑这个三栏布局，你的 FastAPI 后端不再仅仅是一个“一问一答”的聊天接口，而需要变成一个**状态管理与数据调度的中枢**。

为了让这三栏完美联动，你的后端需要实现以下**三大核心模块（API 路由群）**：

---
### 一、 核心模块 1：智能聊天与检索 (Chat & RAG API)

这是支撑中间栏（Chat）和联动左栏（Slide）的灵魂。

1. **`POST /api/chat` (核心流式问答)**
* **前端传入：** 用户的提问 (`query`)、历史对话 (`history`)、当前所在的课程/章节 ID (`course_id`)、甚至**当前用户正在编辑的笔记内容 (`current_note`)**。
* **后端处理：**
* 去 ChromaDB / SQLite 向量表中检索与 `query` 相关的 Slide 文本块。
* **高阶玩法（把你的笔记也当 Context）：** 让大模型结合你右侧正在写的笔记，给出更符合你当前思路的回答。


* **后端返回 (Streaming SSE)：** 流式返回 Claude 3.5 的回答字符串，并在最后附加一个 JSON 对象，包含引用来源（如 `{"citations": [{"page": 12, "source": "ep06"}]}`），供前端触发左侧 Slide 翻页。


2. **`POST /api/chat/summarize` (快捷笔记助手)**
* **功能：** 提供一个快捷 API。当你在中间栏觉得 AI 的某个回答特别好时，点击“一键入库”，这个接口负责把口语化的 AI 回答提炼成严谨的 Markdown 格式（确保像 $A \mathbf{x} = \mathbf{b}$ 这样的 LaTeX 公式完好无损），以便前端直接插入到右侧笔记中。



---

### 二、 核心模块 2：个人笔记存储 (Notes CRUD API)

右侧栏不仅是一个前端的文本框，它必须能持久化保存，否则页面一刷新，你辛辛苦苦整理的数学分析推导就全没了。

既然你目前是自己用，后端可以直接用 SQLite 加 `SQLAlchemy` 或 `SQLModel` 来存。

1. **`GET /api/notes/{course_id}` (获取当前笔记)**
* 当你在左侧切换到第五章时，前端调用此接口，后端从 SQLite 中拉取你之前写的关于极限定义的 Markdown 内容并返回，渲染在右侧编辑区。


2. **`POST /api/notes/{course_id}` (自动保存笔记)**
* **前端传入：** 完整的 Markdown 字符串。
* **后端处理：** 接收并覆盖更新数据库中的笔记字段。前端可以做一个防抖（Debounce），比如每停止打字 2 秒钟，就静默调用一次这个接口，实现类似 Notion 的自动保存。



---

### 三、 核心模块 3：课程资料元数据 (Course Metadata API)

前端需要知道左侧栏应该加载多少页 Slide、图片在哪里。

1. **`GET /api/courses` (获取课程目录)**
* 返回你 `course_data` 目录下的层级结构，供前端渲染一个全局的左侧抽屉导航。


2. **`GET /api/slides/{course_id}/{episode_id}` (获取单集详情)**
* 返回这一集的总页数、Slide 图片的静态访问路径（如果你采用 WebP 图片流方案）。例如：返回 `{"total_pages": 35, "base_url": "/static/slides/linear_algebra/ep06/"}`。



---

### 💡 数据库表结构建议 (基于 SQLite/Postgres)

为了支持上述功能，除了你的 ChromaDB 向量库，你的关系型数据库只需两张核心表：

```python
# 这是一段写给后端的伪代码/模型定义
class Course(Model):
    id: str         # 例如 "math_analysis_ch5"
    title: str      # "第五章：极限与连续"
    slide_type: str # "pdf" 或 "webp_images"

class UserNote(Model):
    course_id: str  # 关联到具体课程
    content: str    # 存储右侧栏的完整 Markdown 文本
    updated_at: datetime

```