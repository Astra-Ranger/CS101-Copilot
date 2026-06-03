// History, quiz, highlight, and learning-tool menus.
function formatConversationTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderConversationGroup(container, label, conversations) {
  if (!conversations.length) {
    return;
  }

  const heading = document.createElement("div");
  heading.className = "chat-history-group-title";
  heading.textContent = label;
  container.append(heading);

  conversations.forEach((conversation) => {
    const item = document.createElement("div");
    item.className = "chat-history-item";
    item.classList.toggle(
      "active",
      conversation.id === state.activeConversationId,
    );

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-history-open";

    const title = document.createElement("span");
    title.className = "chat-history-title";
    title.textContent = conversation.title || "未命名对话";

    const meta = document.createElement("span");
    meta.className = "chat-history-meta";
    meta.textContent = `${conversation.courseName || "未知课程"} · ${
      formatConversationTime(conversation.updatedAt) || "刚刚"
    }`;

    button.append(title, meta);
    button.addEventListener("click", () => {
      void loadConversation(conversation.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "chat-history-delete";
    deleteButton.setAttribute("aria-label", "删除对话");
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => {
      void removeConversation(conversation.id);
    });

    item.append(button, deleteButton);
    container.append(item);
  });
}

function renderHistoryMenu() {
  elements.chatHistoryMenu.innerHTML = "";
  elements.chatHistoryMenu.hidden = !state.isHistoryOpen;

  if (!state.isHistoryOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "历史对话";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭历史对话");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.isHistoryOpen = false;
    renderHistoryMenu();
  });

  header.append(title, closeButton);
  dialog.append(header);

  const currentCourseConversations = state.conversations.filter((conversation) =>
    isCurrentCourse(conversation.courseId),
  );
  const otherConversations = state.conversations.filter(
    (conversation) => !isCurrentCourse(conversation.courseId),
  );

  if (!state.conversations.length) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "暂无历史对话";
    dialog.append(empty);
    elements.chatHistoryMenu.append(dialog);
    return;
  }

  renderConversationGroup(
    dialog,
    "当前课",
    currentCourseConversations,
  );
  renderConversationGroup(dialog, "其他课程", otherConversations);
  elements.chatHistoryMenu.append(dialog);
}

function renderQuizMenu() {
  elements.quizMenu.innerHTML = "";
  elements.quizMenu.hidden = !state.quiz.isOpen;
  elements.quizButton.classList.toggle("is-active", state.quiz.isOpen);

  if (!state.quiz.isOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog quiz-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "quiz-title-wrap";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "练习题";

  const subtitle = document.createElement("span");
  subtitle.className = "quiz-subtitle";
  subtitle.textContent = state.currentDeck ? state.currentDeck.title : "当前课程";

  titleWrap.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭练习题");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.quiz.isOpen = false;
    renderQuizMenu();
  });

  header.append(titleWrap, closeButton);
  dialog.append(header);

  const controls = document.createElement("div");
  controls.className = "quiz-controls";

  const countLabel = document.createElement("label");
  countLabel.className = "quiz-count-field";
  countLabel.textContent = "数量";

  const countSelect = document.createElement("select");
  [3, 5, 8].forEach((count) => {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count} 道`;
    option.selected = state.quiz.count === count;
    countSelect.append(option);
  });
  countSelect.addEventListener("change", () => {
    state.quiz.count = Number(countSelect.value) || 5;
  });
  countLabel.append(countSelect);

  const typeBadge = document.createElement("span");
  typeBadge.className = "quiz-type-badge";
  typeBadge.textContent = "单选题 + 判断题";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "quiz-generate-button";
  generateButton.disabled = state.quiz.isGenerating;
  generateButton.textContent = state.quiz.isGenerating ? "生成中..." : "生成题目";
  generateButton.addEventListener("click", () => {
    void handleGenerateQuizClick();
  });

  controls.append(countLabel, typeBadge, generateButton);
  dialog.append(controls);

  if (state.quiz.error) {
    const error = document.createElement("div");
    error.className = "quiz-error";
    error.textContent = state.quiz.error;
    dialog.append(error);
  }

  if (!state.quiz.questions.length && !state.quiz.isGenerating) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "选择数量后生成练习题。";
    dialog.append(empty);
  }

  if (state.quiz.isGenerating) {
    const loading = document.createElement("div");
    loading.className = "chat-inline-status";
    loading.textContent = "正在读取课程资料并生成题目...";
    dialog.append(loading);
  }

  state.quiz.questions.forEach((question, index) => {
    dialog.append(renderQuizQuestion(question, index));
  });

  elements.quizMenu.append(dialog);
}

function renderQuizQuestion(question, index) {
  const card = document.createElement("article");
  card.className = "quiz-question-card";

  const stem = document.createElement("div");
  stem.className = "quiz-question-stem";
  stem.textContent = `${index + 1}. ${question.question || ""}`;
  card.append(stem);

  const selected = state.quiz.selectedAnswers[question.id];
  const options = Array.isArray(question.options) ? question.options : [];
  const optionList = document.createElement("div");
  optionList.className = "quiz-options";

  options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option;

    if (selected !== undefined) {
      button.disabled = true;
      button.classList.toggle("selected", selected === optionIndex);
      button.classList.toggle("correct", question.answerIndex === optionIndex);
      button.classList.toggle(
        "wrong",
        selected === optionIndex && selected !== question.answerIndex,
      );
    }

    button.addEventListener("click", () => {
      state.quiz.selectedAnswers[question.id] = optionIndex;
      renderQuizMenu();
    });
    optionList.append(button);
  });

  card.append(optionList);

  if (selected !== undefined) {
    const result = document.createElement("div");
    result.className = selected === question.answerIndex ? "quiz-result correct" : "quiz-result wrong";
    result.textContent =
      selected === question.answerIndex
        ? "回答正确"
        : `回答错误，正确答案是：${options[question.answerIndex] || ""}`;
    card.append(result);

    const explanation = document.createElement("p");
    explanation.className = "quiz-explanation";
    explanation.textContent = question.explanation || "";
    card.append(explanation);
  }

  if (Array.isArray(question.citations) && question.citations.length) {
    const citations = document.createElement("div");
    citations.className = "quiz-citations";
    question.citations.forEach((citation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "citation-button";
      button.textContent = citation.label || `P${citation.pageNumber}`;
      button.dataset.tooltip = `跳转到第 ${citation.pageNumber} 页`;
      button.addEventListener("click", () => {
        void navigateToCitation(citation.courseId || state.currentCourseId, citation.pageNumber);
      });
      citations.append(button);
    });
    card.append(citations);
  }

  return card;
}

function renderHighlightMenu() {
  elements.highlightMenu.innerHTML = "";
  elements.highlightMenu.hidden = !state.highlights.isOpen;
  elements.highlightButton.classList.toggle("is-active", state.highlights.isOpen);

  if (!state.highlights.isOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog highlight-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "quiz-title-wrap";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "划重点";

  const subtitle = document.createElement("span");
  subtitle.className = "quiz-subtitle";
  subtitle.textContent = state.currentDeck ? state.currentDeck.title : "当前课程";

  titleWrap.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭划重点");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.highlights.isOpen = false;
    renderHighlightMenu();
  });

  header.append(titleWrap, closeButton);
  dialog.append(header);

  const controls = document.createElement("div");
  controls.className = "quiz-controls";

  const countLabel = document.createElement("label");
  countLabel.className = "quiz-count-field";
  countLabel.textContent = "数量";

  const countSelect = document.createElement("select");
  [5, 8, 10].forEach((count) => {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count} 条`;
    option.selected = state.highlights.count === count;
    countSelect.append(option);
  });
  countSelect.addEventListener("change", () => {
    state.highlights.count = Number(countSelect.value) || 8;
  });
  countLabel.append(countSelect);

  const typeBadge = document.createElement("span");
  typeBadge.className = "quiz-type-badge";
  typeBadge.textContent = "当前课程重点";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "quiz-generate-button";
  generateButton.disabled = state.highlights.isGenerating;
  generateButton.textContent = state.highlights.isGenerating ? "提炼中..." : "划重点";
  generateButton.addEventListener("click", () => {
    void handleGenerateHighlightsClick();
  });

  controls.append(countLabel, typeBadge, generateButton);
  dialog.append(controls);

  if (state.highlights.error) {
    const error = document.createElement("div");
    error.className = "quiz-error";
    error.textContent = state.highlights.error;
    dialog.append(error);
  }

  if (!state.highlights.items.length && !state.highlights.isGenerating) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "选择数量后提炼课程重点。";
    dialog.append(empty);
  }

  if (state.highlights.isGenerating) {
    const loading = document.createElement("div");
    loading.className = "chat-inline-status";
    loading.textContent = "正在读取课程资料并提炼重点...";
    dialog.append(loading);
  }

  state.highlights.items.forEach((highlight, index) => {
    dialog.append(renderHighlightItem(highlight, index));
  });

  elements.highlightMenu.append(dialog);
}

function renderHighlightItem(highlight, index) {
  const card = document.createElement("article");
  card.className = "highlight-card";

  const titleRow = document.createElement("div");
  titleRow.className = "highlight-title-row";

  const title = document.createElement("div");
  title.className = "highlight-title";
  title.textContent = `${index + 1}. ${highlight.title || ""}`;

  const importance = document.createElement("span");
  importance.className = `highlight-importance ${highlight.importance || "medium"}`;
  importance.textContent = highlightImportanceLabel(highlight.importance);

  titleRow.append(title, importance);
  card.append(titleRow);

  const summary = document.createElement("p");
  summary.className = "highlight-summary";
  summary.textContent = highlight.summary || "";
  card.append(summary);

  if (Array.isArray(highlight.citations) && highlight.citations.length) {
    const citations = document.createElement("div");
    citations.className = "quiz-citations";
    highlight.citations.forEach((citation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "citation-button";
      button.textContent = citation.label || `P${citation.pageNumber}`;
      button.dataset.tooltip = `跳转到第 ${citation.pageNumber} 页`;
      button.addEventListener("click", () => {
        void navigateToCitation(citation.courseId || state.currentCourseId, citation.pageNumber);
      });
      citations.append(button);
    });
    card.append(citations);
  }

  return card;
}

function highlightImportanceLabel(value) {
  if (value === "high") {
    return "高";
  }
  if (value === "low") {
    return "补充";
  }
  return "中";
}

function renderMindmapMenu() {
  elements.mindmapMenu.innerHTML = "";
  elements.mindmapMenu.hidden = !state.mindmap.isOpen;
  elements.mindmapButton.classList.toggle("is-active", state.mindmap.isOpen);

  if (!state.mindmap.isOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog mindmap-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "quiz-title-wrap";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "思维导图";

  const subtitle = document.createElement("span");
  subtitle.className = "quiz-subtitle";
  subtitle.textContent = state.currentDeck ? state.currentDeck.title : "当前课程";

  titleWrap.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭思维导图");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.mindmap.isOpen = false;
    renderMindmapMenu();
  });

  header.append(titleWrap, closeButton);
  dialog.append(header);

  const controls = document.createElement("div");
  controls.className = "mindmap-controls";

  const depthLabel = document.createElement("label");
  depthLabel.className = "quiz-count-field";
  depthLabel.textContent = "层级";

  const depthSelect = document.createElement("select");
  [2, 3, 4].forEach((depth) => {
    const option = document.createElement("option");
    option.value = String(depth);
    option.textContent = `${depth} 层`;
    option.selected = state.mindmap.depth === depth;
    depthSelect.append(option);
  });
  depthSelect.addEventListener("change", () => {
    state.mindmap.depth = Number(depthSelect.value) || 3;
  });
  depthLabel.append(depthSelect);

  const scopeToggle = document.createElement("div");
  scopeToggle.className = "mindmap-scope-toggle";
  scopeToggle.setAttribute("role", "group");
  scopeToggle.setAttribute("aria-label", "思维导图范围");
  [
    ["current", "当前课件"],
    ["all", "全体课件"],
  ].forEach(([scope, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.classList.toggle("active", state.mindmap.scope === scope);
    button.disabled = state.mindmap.isGenerating;
    button.addEventListener("click", () => {
      if (state.mindmap.scope === scope) {
        return;
      }

      state.mindmap.scope = scope;
      state.mindmap.root = null;
      state.mindmap.collapsed = {};
      state.mindmap.error = "";
      state.mindmap.zoom = 1;
      renderMindmapMenu();
    });
    scopeToggle.append(button);
  });

  const focusInput = document.createElement("input");
  focusInput.type = "text";
  focusInput.value = state.mindmap.focus;
  focusInput.placeholder = "聚焦主题，可留空";
  focusInput.className = "mindmap-focus-input";
  focusInput.addEventListener("input", () => {
    state.mindmap.focus = focusInput.value;
  });

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "quiz-generate-button";
  generateButton.disabled = state.mindmap.isGenerating;
  generateButton.textContent = state.mindmap.isGenerating ? "生成中..." : "生成导图";
  generateButton.addEventListener("click", () => {
    void handleGenerateMindmapClick();
  });

  const zoomOutButton = document.createElement("button");
  zoomOutButton.type = "button";
  zoomOutButton.className = "mindmap-tool-button";
  zoomOutButton.textContent = "-";
  zoomOutButton.disabled = !state.mindmap.root;
  zoomOutButton.addEventListener("click", () => {
    const canvas = elements.mindmapMenu.querySelector(".mindmap-canvas");
    if (canvas) {
      zoomMindmap(state.mindmap.zoom - MINDMAP_WHEEL_ZOOM_STEP, canvas);
    }
  });

  const zoomResetButton = document.createElement("button");
  zoomResetButton.type = "button";
  zoomResetButton.className = "mindmap-tool-button mindmap-zoom-reset";
  zoomResetButton.textContent = `${Math.round(state.mindmap.zoom * 100)}%`;
  zoomResetButton.disabled = !state.mindmap.root;
  zoomResetButton.addEventListener("click", () => {
    const canvas = elements.mindmapMenu.querySelector(".mindmap-canvas");
    if (canvas) {
      zoomMindmap(1, canvas);
    }
  });

  const zoomInButton = document.createElement("button");
  zoomInButton.type = "button";
  zoomInButton.className = "mindmap-tool-button";
  zoomInButton.textContent = "+";
  zoomInButton.disabled = !state.mindmap.root;
  zoomInButton.addEventListener("click", () => {
    const canvas = elements.mindmapMenu.querySelector(".mindmap-canvas");
    if (canvas) {
      zoomMindmap(state.mindmap.zoom + MINDMAP_WHEEL_ZOOM_STEP, canvas);
    }
  });

  const exportPngButton = document.createElement("button");
  exportPngButton.type = "button";
  exportPngButton.className = "mindmap-tool-button";
  exportPngButton.textContent = "PNG";
  exportPngButton.disabled = !state.mindmap.root;
  exportPngButton.addEventListener("click", () => {
    void exportMindmap("png");
  });

  const exportPdfButton = document.createElement("button");
  exportPdfButton.type = "button";
  exportPdfButton.className = "mindmap-tool-button";
  exportPdfButton.textContent = "PDF";
  exportPdfButton.disabled = !state.mindmap.root;
  exportPdfButton.addEventListener("click", () => {
    void exportMindmap("pdf");
  });

  const toolGroup = document.createElement("div");
  toolGroup.className = "mindmap-tool-group";
  toolGroup.append(
    zoomOutButton,
    zoomResetButton,
    zoomInButton,
    exportPngButton,
    exportPdfButton,
  );

  controls.append(
    depthLabel,
    scopeToggle,
    focusInput,
    generateButton,
    toolGroup,
  );
  dialog.append(controls);

  if (state.mindmap.error) {
    const error = document.createElement("div");
    error.className = "quiz-error";
    error.textContent = state.mindmap.error;
    dialog.append(error);
  }

  if (state.mindmap.isGenerating) {
    const loading = document.createElement("div");
    loading.className = "chat-inline-status";
    loading.textContent = "正在读取课程资料并生成思维导图...";
    dialog.append(loading);
  }

  if (!state.mindmap.root && !state.mindmap.isGenerating) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "生成后可点击知识点向 AI 提问，点击小箭头展开子知识点。";
    dialog.append(empty);
  }

  if (state.mindmap.root) {
    const canvas = document.createElement("div");
    canvas.className = "mindmap-canvas";
    canvas.textContent = state.mindmap.d3Status || "正在准备 D3 画布...";
    canvas.addEventListener("wheel", handleMindmapWheel, { passive: false });
    canvas.addEventListener("pointerdown", handleMindmapPointerDown);
    canvas.addEventListener("pointermove", handleMindmapPointerMove);
    canvas.addEventListener("pointerup", handleMindmapPointerEnd);
    canvas.addEventListener("pointercancel", handleMindmapPointerEnd);
    dialog.append(canvas);
    void renderMindmapCanvas(canvas);
  }

  elements.mindmapMenu.append(dialog);
}
