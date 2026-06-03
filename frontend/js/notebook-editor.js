// Markdown note editor rendering, saving, and serialization.
function updateSaveState(label, isError) {
  elements.saveState.textContent = label;
  elements.saveState.classList.toggle("error", Boolean(isError));
}

function renderNoteHeader() {
  elements.notebookTitle.textContent =
    (state.activeNotebook && state.activeNotebook.title) || "课程笔记";
  elements.exportNotebookButton.disabled = !state.activeNotebookId;
}

function renderNoteEditor(options = {}) {
  const selectionRange =
    options.selectionRange || (options.restoreSelection ? getNoteSelectionRange() : null);
  const shouldRefocus = options.keepFocus && document.activeElement === elements.noteEditor;

  renderNoteHeader();
  elements.noteEditor.dataset.rawMode = "false";
  elements.noteEditor.innerHTML = "";

  if (state.noteContent.trim()) {
    appendMarkdown(
      elements.noteEditor,
      state.noteContent,
      null,
      {
        disableCitations: true,
        headingOffset: 0,
        preserveBlankLines: true,
      },
    );
  }

  if (shouldRefocus) {
    elements.noteEditor.focus();
  }

  if (selectionRange) {
    setNoteSelectionRange(selectionRange.start, selectionRange.end);
  }
}

function scheduleNoteMarkdownRender(selectionRange) {
  if (state.isComposingNote) {
    return;
  }

  if (state.noteRenderFrame) {
    window.cancelAnimationFrame(state.noteRenderFrame);
  }

  state.noteRenderFrame = window.requestAnimationFrame(() => {
    state.noteRenderFrame = null;
    renderNoteEditor({
      restoreSelection: true,
      keepFocus: true,
      selectionRange,
    });
  });
}

function prepareNoteSourceEditing() {
  if (elements.noteEditor.dataset.rawMode === "true") {
    return;
  }

  elements.noteEditor.dataset.rawMode = "true";
  elements.noteEditor.textContent = state.noteContent;
  elements.noteEditor.focus();
  setNoteSelectionRange(state.noteContent.length, state.noteContent.length);
}

async function saveCurrentNote(options = {}) {
  if (!state.activeNotebookId) {
    await ensureActiveNotebook();
  }

  if (!state.activeNotebookId) {
    updateSaveState("保存失败", true);
    return;
  }

  const notebookId = state.activeNotebookId;
  const content = state.noteContent;

  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }

  updateSaveState("保存中", false);

  try {
    const result = await saveNotebook(
      notebookId,
      content,
      Boolean(options.forceTitle),
    );

    if (notebookId !== state.activeNotebookId) {
      return;
    }

    if (!result.saved) {
      state.hasUnsavedNote = true;
      updateSaveState("未保存", false);
      return;
    }

    state.activeNotebook = result.notebook;
    state.noteContent = result.notebook.content || content;
    state.hasUnsavedNote = false;
    syncNotebookSummary(result.notebook);
    renderNoteHeader();
    renderNotebookMenu();
    updateSaveState("已保存", false);

    if (elements.noteEditor.dataset.rawMode !== "true") {
      renderNoteEditor();
    }
  } catch (error) {
    console.error(error);

    if (notebookId === state.activeNotebookId) {
      state.hasUnsavedNote = true;
      updateSaveState("保存失败", true);
    }
  }
}

function scheduleAutoSaveNote() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
  }

  state.saveTimer = window.setTimeout(() => {
    void saveCurrentNote();
  }, 1800);
}

function setNoteContent(content, options = {}) {
  const changed = content !== state.noteContent;
  state.noteContent = content;

  if (changed) {
    state.hasUnsavedNote = true;
    updateSaveState("未保存", false);
  }

  if (changed && options.scheduleSave !== false) {
    scheduleAutoSaveNote();
  }
}

function handleNoteInput(event) {
  clearNoteAutocomplete({ abortRequest: true });
  const selectionRange = getNoteSelectionRange();
  setNoteContent(getNoteEditorMarkdown());
  scheduleNoteMarkdownRender(selectionRange);
  scheduleNoteAutocomplete();
}

function handleNoteFocus() {
  elements.noteEditor.dataset.rawMode = "false";
}

function handleNoteBlur() {
  clearNoteAutocomplete({ abortRequest: true });
  setNoteContent(getNoteEditorMarkdown(), { scheduleSave: false });
  renderNoteEditor();
}

function handleNoteCompositionStart() {
  state.isComposingNote = true;
  clearNoteAutocomplete({ abortRequest: true });
}

function handleNoteCompositionEnd() {
  state.isComposingNote = false;
  handleNoteInput();
}

function handleNotebookListClick() {
  state.isNotebookModalOpen = !state.isNotebookModalOpen;
  renderNotebookMenu();
}

function handleNewNotebookClick() {
  void startNewNotebook();
}

function handleExportNotebookClick() {
  if (!state.activeNotebookId) {
    return;
  }

  window.location.href = `/api/notebooks/${encodeURIComponent(
    state.activeNotebookId,
  )}/export`;
}

function handleHistoryClick() {
  state.isHistoryOpen = !state.isHistoryOpen;
  if (state.isHistoryOpen) {
    state.quiz.isOpen = false;
    state.highlights.isOpen = false;
    state.mindmap.isOpen = false;
    renderQuizMenu();
    renderHighlightMenu();
    renderMindmapMenu();
  }
  renderHistoryMenu();
}

function handleQuizClick() {
  state.quiz.isOpen = !state.quiz.isOpen;
  if (state.quiz.isOpen) {
    state.isHistoryOpen = false;
    state.highlights.isOpen = false;
    state.mindmap.isOpen = false;
    renderHistoryMenu();
    renderHighlightMenu();
    renderMindmapMenu();
  }
  renderQuizMenu();
}

function handleHighlightClick() {
  state.highlights.isOpen = !state.highlights.isOpen;
  if (state.highlights.isOpen) {
    state.isHistoryOpen = false;
    state.quiz.isOpen = false;
    state.mindmap.isOpen = false;
    renderHistoryMenu();
    renderQuizMenu();
    renderMindmapMenu();
  }
  renderHighlightMenu();
}

function handleMindmapClick() {
  state.mindmap.isOpen = !state.mindmap.isOpen;
  if (state.mindmap.isOpen) {
    state.isHistoryOpen = false;
    state.quiz.isOpen = false;
    state.highlights.isOpen = false;
    renderHistoryMenu();
    renderQuizMenu();
    renderHighlightMenu();
  }
  renderMindmapMenu();
}

async function handleGenerateQuizClick() {
  if (state.quiz.isGenerating) {
    return;
  }

  state.quiz.isGenerating = true;
  state.quiz.error = "";
  state.quiz.selectedAnswers = {};
  renderQuizMenu();

  try {
    const data = await generateCourseQuestions(state.currentCourseId, {
      count: state.quiz.count,
      types: ["single_choice", "true_false"],
      currentNote: state.noteContent,
    });
    state.quiz.questions = Array.isArray(data.questions) ? data.questions : [];
    if (!state.quiz.questions.length) {
      state.quiz.error = "没有生成可用题目，请稍后再试。";
    }
  } catch (error) {
    console.error(error);
    state.quiz.questions = [];
    state.quiz.error = error.message || "题目生成失败，请稍后重试。";
  } finally {
    state.quiz.isGenerating = false;
    renderQuizMenu();
  }
}

async function handleGenerateHighlightsClick() {
  if (state.highlights.isGenerating) {
    return;
  }

  state.highlights.isGenerating = true;
  state.highlights.error = "";
  renderHighlightMenu();

  try {
    const data = await generateCourseHighlights(state.currentCourseId, {
      count: state.highlights.count,
      scope: "current",
      currentNote: state.noteContent,
    });
    state.highlights.items = Array.isArray(data.highlights) ? data.highlights : [];
    if (!state.highlights.items.length) {
      state.highlights.error = "没有提炼出可用重点，请稍后再试。";
    }
  } catch (error) {
    console.error(error);
    state.highlights.items = [];
    state.highlights.error = error.message || "划重点失败，请稍后重试。";
  } finally {
    state.highlights.isGenerating = false;
    renderHighlightMenu();
  }
}

async function handleGenerateMindmapClick() {
  if (state.mindmap.isGenerating) {
    return;
  }

  state.mindmap.isGenerating = true;
  state.mindmap.error = "";
  state.mindmap.d3Status = "";
  renderMindmapMenu();

  try {
    const data = await generateCourseMindmap(state.currentCourseId, {
      depth: state.mindmap.depth,
      scope: state.mindmap.scope,
      focus: state.mindmap.focus,
      currentNote: state.noteContent,
    });
    state.mindmap.root = data.mindmap || null;
    state.mindmap.collapsed = {};
    if (!state.mindmap.root) {
      state.mindmap.error = "没有生成可用思维导图，请稍后再试。";
    }
  } catch (error) {
    console.error(error);
    state.mindmap.root = null;
    state.mindmap.error = error.message || "思维导图生成失败，请稍后重试。";
  } finally {
    state.mindmap.isGenerating = false;
    renderMindmapMenu();
  }
}

function handleNewChatClick() {
  void startNewConversation();
}

function applyNotebook(notebook) {
  clearNoteAutocomplete({
    abortRequest: true,
    resetFingerprint: true,
  });
  state.activeNotebookId = notebook.id || null;
  state.activeNotebook = notebook;
  state.noteContent = notebook.content || "";
  state.hasUnsavedNote = false;
  state.isNotebookModalOpen = false;
  window.localStorage.setItem(LAST_NOTEBOOK_KEY, state.activeNotebookId || "");
  updateSaveState(notebook.contentSavedAt ? "已保存" : "未保存", false);
  syncNotebookSummary(notebook);
  renderNoteEditor();
  renderNotebookMenu();
}

async function refreshNotebooks() {
  try {
    const data = await fetchNotebooks();
    state.notebooks = Array.isArray(data.notebooks) ? data.notebooks : [];
  } catch (error) {
    console.warn("读取笔记本列表失败。", error);
    state.notebooks = [];
  }

  renderNotebookMenu();
}

async function loadNotebook(notebookId, options = {}) {
  try {
    const data = await fetchNotebook(notebookId);

    if (!data.notebook) {
      throw new Error("notebook missing");
    }

    applyNotebook(data.notebook);

    if (options.keepModalOpen) {
      state.isNotebookModalOpen = true;
      renderNotebookMenu();
    }
  } catch (error) {
    console.error(error);
    updateSaveState("读取失败", true);
  }
}

async function startNewNotebook() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }

  try {
    const data = await createNotebook();

    if (!data.notebook) {
      throw new Error("notebook missing");
    }

    applyNotebook(data.notebook);
    await refreshNotebooks();
    updateSaveState("未保存", false);
    return data.notebook;
  } catch (error) {
    console.error(error);
    updateSaveState("新建失败", true);
    return null;
  }
}

async function ensureActiveNotebook() {
  if (state.activeNotebookId) {
    return state.activeNotebook;
  }

  return startNewNotebook();
}

async function removeNotebook(notebookId) {
  try {
    await deleteNotebook(notebookId);
    await refreshNotebooks();

    if (notebookId !== state.activeNotebookId) {
      return;
    }

    state.activeNotebookId = null;
    state.activeNotebook = null;
    state.noteContent = "";

    if (state.notebooks.length) {
      await loadNotebook(state.notebooks[0].id, { keepModalOpen: true });
    } else {
      await startNewNotebook();
      state.isNotebookModalOpen = true;
      renderNotebookMenu();
    }
  } catch (error) {
    console.error(error);
    updateSaveState("删除失败", true);
  }
}

async function initNotes() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }

  updateSaveState("读取中", false);
  await refreshNotebooks();

  const lastNotebookId = window.localStorage.getItem(LAST_NOTEBOOK_KEY);
  const targetNotebook =
    state.notebooks.find((notebook) => notebook.id === lastNotebookId) ||
    state.notebooks[0];

  if (targetNotebook) {
    await loadNotebook(targetNotebook.id, { keepModalOpen: false });
    return;
  }

  await startNewNotebook();
}

function getNoteEditorText() {
  return String(elements.noteEditor.innerText || elements.noteEditor.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function getNoteEditorMarkdown() {
  if (elements.noteEditor.dataset.rawMode === "true") {
    return normalizeSerializedMarkdown(elements.noteEditor.textContent || "");
  }

  return normalizeSerializedMarkdown(serializeMarkdownBlocks(elements.noteEditor));
}

function serializeMarkdownBlocks(container) {
  const blocks = Array.from(container.childNodes)
    .map((node) => serializeMarkdownBlock(node))
    .filter((value) => value.length > 0);

  return blocks.reduce((output, block) => {
    if (block === "\n") {
      return `${output}\n`;
    }

    if (!output) {
      return block;
    }

    return output.endsWith("\n\n")
      ? `${output}${block}`
      : `${output}${output.endsWith("\n") ? "\n" : "\n\n"}${block}`;
  }, "");
}

function serializeMarkdownBlock(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeEditorText(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tagName = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tagName)) {
    const level = Math.min(6, Math.max(1, Number(tagName.slice(1))));
    return `${"#".repeat(level)} ${serializeMarkdownInlineChildren(element).trim()}`;
  }

  if (tagName === "pre") {
    const code = element.querySelector("code");
    return `\`\`\`\n${normalizeEditorText((code || element).textContent || "")}\n\`\`\``;
  }

  if (tagName === "ul" || tagName === "ol") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const prefix = tagName === "ol" ? `${index + 1}. ` : "- ";
        return `${prefix}${serializeMarkdownInlineChildren(child).trim()}`;
      })
      .join("\n");
  }

  if (tagName === "blockquote") {
    return serializeMarkdownInlineChildren(element)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tagName === "table") {
    return serializeMarkdownTable(element);
  }

  if (tagName === "br") {
    return "\n";
  }

  return trimInlineWhitespace(serializeMarkdownInlineChildren(element));
}

function serializeMarkdownInlineChildren(element) {
  return Array.from(element.childNodes)
    .map((node) => serializeMarkdownInline(node))
    .join("");
}

function serializeMarkdownInline(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeEditorText(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tagName = element.tagName.toLowerCase();

  if (tagName === "br") {
    return "\n";
  }

  if (tagName === "strong" || tagName === "b") {
    return `**${serializeMarkdownInlineChildren(element)}**`;
  }

  if (tagName === "em" || tagName === "i") {
    return `*${serializeMarkdownInlineChildren(element)}*`;
  }

  if (tagName === "code") {
    return `\`${normalizeEditorText(element.textContent || "")}\``;
  }

  if (tagName === "a") {
    const text = serializeMarkdownInlineChildren(element);
    const href = element.getAttribute("href") || "";
    return href ? `[${text}](${href})` : text;
  }

  return serializeMarkdownInlineChildren(element);
}

function serializeMarkdownTable(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => serializeMarkdownInlineChildren(cell).trim()),
  );

  if (!rows.length) {
    return "";
  }

  const header = rows[0];
  const divider = header.map(() => "---");
  const body = rows.slice(1);
  return [header, divider, ...body]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function normalizeEditorText(text) {
  return String(text || "").replace(/\u00a0/g, " ");
}

function trimInlineWhitespace(text) {
  return String(text || "").replace(/^[ \t]+|[ \t]+$/g, "");
}

function normalizeSerializedMarkdown(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n");
}
