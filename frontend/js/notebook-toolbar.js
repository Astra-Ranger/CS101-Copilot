// Markdown toolbar, formula modal, global shortcuts, bootstrap, and note references.
function insertIntoNoteEditor(text, selectionStart, selectionEnd, options = {}) {
  prepareNoteSourceEditing();
  const range = getNoteSelectionRange();
  const start = Number.isInteger(selectionStart) ? selectionStart : range.start;
  const end = Number.isInteger(selectionEnd) ? selectionEnd : range.end;
  const current = getNoteEditorText();
  const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
  setNoteContent(next);
  elements.noteEditor.textContent = next;

  if (options.renderAfterInsert !== false) {
    renderNoteEditor({
      keepFocus: true,
      selectionRange: {
        start: start + text.length,
        end: start + text.length,
      },
    });
    return;
  }

  elements.noteEditor.focus();
  setNoteSelectionRange(start + text.length, start + text.length);
}

function wrapNoteSelection(before, after, placeholder) {
  prepareNoteSourceEditing();
  const range = getNoteSelectionRange();
  const start = range.start;
  const end = range.end;
  const current = getNoteEditorText();
  const selected = current.slice(start, end) || placeholder;
  const snippet = `${before}${selected}${after}`;
  insertIntoNoteEditor(snippet, start, end);
  setNoteSelectionRange(start + before.length, start + before.length + selected.length);
}

function prefixNoteSelection(prefix, placeholder) {
  prepareNoteSourceEditing();
  const range = getNoteSelectionRange();
  const start = range.start;
  const end = range.end;
  const current = getNoteEditorText();
  const selected = current.slice(start, end) || placeholder;
  const snippet = selected
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
  insertIntoNoteEditor(snippet, start, end);
}

function handleMarkdownToolClick(event) {
  const command = event.currentTarget.dataset.markdownCommand;

  if (command === "h1") {
    prefixNoteSelection("# ", "标题");
  } else if (command === "h2") {
    prefixNoteSelection("## ", "标题");
  } else if (command === "h3") {
    prefixNoteSelection("### ", "标题");
  } else if (command === "bold") {
    wrapNoteSelection("**", "**", "加粗文字");
  } else if (command === "italic") {
    wrapNoteSelection("*", "*", "斜体文字");
  } else if (command === "code") {
    wrapNoteSelection("`", "`", "code");
  } else if (command === "list") {
    prefixNoteSelection("- ", "列表项");
  } else if (command === "link") {
    wrapNoteSelection("[", "](https://)", "链接文本");
  }
}

function openFormulaModal() {
  elements.formulaInput.value = "";
  elements.formulaModal.hidden = false;
  elements.formulaInput.focus();
}

function closeFormulaModal() {
  elements.formulaModal.hidden = true;
}

function confirmFormula() {
  const formula = elements.formulaInput.value.trim();

  if (!formula) {
    elements.formulaInput.focus();
    return;
  }

  const snippet = `\n$$\n${formula}\n$$\n`;

  insertIntoNoteEditor(snippet, undefined, undefined, {
    renderAfterInsert: true,
  });
  closeFormulaModal();
}

function handleGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveCurrentNote();
    return;
  }

  if (event.key === "Escape" && !elements.formulaModal.hidden) {
    closeFormulaModal();
    return;
  }

  if (event.key === "Escape" && state.isSettingsOpen) {
    closeSettingsPanel();
  }
}

async function init() {
  renderMessages();
  resizeChatInput();
  updateNoteAutocompleteToggle();
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.chatInput.addEventListener("input", handleChatInput);
  elements.chatInput.addEventListener("keydown", handleChatKeydown);
  elements.messageList.addEventListener("scroll", handleMessageListScroll, {
    passive: true,
  });
  elements.messageList.addEventListener("wheel", handleMessageListWheel, {
    passive: true,
  });
  elements.appSettingsButton.addEventListener("click", handleSettingsButtonClick);
  elements.appSettingsClose.addEventListener("click", closeSettingsPanel);
  elements.settingsSaveButton.addEventListener("click", handleSettingsSaveClick);
  document.querySelectorAll("[data-answer-mode]").forEach((button) => {
    button.addEventListener("click", handleAnswerModeClick);
  });
  elements.slideList.addEventListener("pointerdown", handleSlidePointerDown);
  elements.slideList.addEventListener("pointermove", handleSlidePointerMove);
  elements.slideList.addEventListener("pointerup", handleSlidePointerEnd);
  elements.slideList.addEventListener("pointercancel", handleSlidePointerEnd);
  elements.slideList.addEventListener("wheel", handleSlideWheel, {
    passive: false,
  });
  elements.newChatButton.addEventListener("click", handleNewChatClick);
  elements.chatHistoryButton.addEventListener("click", handleHistoryClick);
  elements.quizButton.addEventListener("click", handleQuizClick);
  elements.highlightButton.addEventListener("click", handleHighlightClick);
  elements.mindmapButton.addEventListener("click", handleMindmapClick);
  elements.noteEditor.addEventListener("input", handleNoteInput);
  elements.noteEditor.addEventListener("input", renderNoteReferences);
  elements.noteEditor.addEventListener("keydown", handleNoteEditorKeydown);
  elements.noteEditor.addEventListener("focus", handleNoteFocus);
  elements.noteEditor.addEventListener("blur", handleNoteBlur);
  elements.noteEditor.addEventListener("scroll", () => {
    clearNoteAutocomplete();
  });
  elements.noteEditor.addEventListener("compositionstart", handleNoteCompositionStart);
  elements.noteEditor.addEventListener("compositionend", handleNoteCompositionEnd);
  elements.noteAutocompleteToggle.addEventListener(
    "click",
    handleNoteAutocompleteToggleClick,
  );
  elements.newNotebookButton.addEventListener("click", handleNewNotebookClick);
  elements.notebookListButton.addEventListener("click", handleNotebookListClick);
  elements.exportNotebookButton.addEventListener("click", handleExportNotebookClick);
  elements.formulaButton.addEventListener("click", openFormulaModal);
  elements.formulaConfirmButton.addEventListener("click", confirmFormula);
  elements.formulaCancelButton.addEventListener("click", closeFormulaModal);
  elements.formulaCancelIcon.addEventListener("click", closeFormulaModal);
  document
    .querySelectorAll("[data-markdown-command]")
    .forEach((button) => {
      button.addEventListener("click", handleMarkdownToolClick);
  });
  document.addEventListener("keydown", handleGlobalKeydown);
  elements.courseSelect.addEventListener("change", handleCourseChange);
  await initSettings();
  await fetchCourseIndex();
  renderCourseSelect();
  await initNotes();
  renderNoteReferences();
  renderNoteReferences();
  await loadCurrentCourse();
  renderQuizMenu();
  renderHighlightMenu();
  renderMindmapMenu();
  await loadLatestConversationForCurrentCourse();
}

function getNoteReferences(text) {
  const references = [];
  const seenPages = new Set();

  for (const match of text.matchAll(noteReferencePattern)) {
    const pageNumber = Number(match[1] || match[2]);

    if (!Number.isFinite(pageNumber) || pageNumber < 1 || seenPages.has(pageNumber)) {
      continue;
    }

    seenPages.add(pageNumber);
    references.push(pageNumber);
  }

  return references;
}

function renderNoteReferences() {
  if (!elements.noteReferenceList) {
    return;
  }

  elements.noteReferenceList.innerHTML = "";

  getNoteReferences(state.noteContent).forEach((pageNumber) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-reference-button";
    button.textContent = `第 ${pageNumber} 页`;
    button.addEventListener("click", () => setActiveSlidePage(pageNumber));
    elements.noteReferenceList.append(button);
  });
}
init();
