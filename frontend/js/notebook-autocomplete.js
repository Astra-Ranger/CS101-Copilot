// AI note autocomplete and caret positioning.
function updateNoteAutocompleteToggle() {
  if (!elements.noteAutocompleteToggle) {
    return;
  }

  elements.noteAutocompleteToggle.classList.toggle(
    "is-active",
    state.noteAutocompleteEnabled,
  );
  elements.noteAutocompleteToggle.classList.toggle(
    "is-muted",
    !state.noteAutocompleteEnabled,
  );
  elements.noteAutocompleteToggle.setAttribute(
    "aria-pressed",
    String(state.noteAutocompleteEnabled),
  );
  elements.noteAutocompleteToggle.setAttribute(
    "aria-label",
    state.noteAutocompleteEnabled ? "关闭 AI 补全" : "开启 AI 补全",
  );
  elements.noteAutocompleteToggle.dataset.tooltip = state.noteAutocompleteEnabled
    ? "关闭 AI 补全"
    : "开启 AI 补全";
}

function handleNoteAutocompleteToggleClick() {
  state.noteAutocompleteEnabled = !state.noteAutocompleteEnabled;
  window.localStorage.setItem(
    NOTE_AUTOCOMPLETE_KEY,
    state.noteAutocompleteEnabled ? "true" : "false",
  );
  updateNoteAutocompleteToggle();
  clearNoteAutocomplete({
    abortRequest: true,
    resetFingerprint: true,
  });

  if (state.noteAutocompleteEnabled) {
    scheduleNoteAutocomplete();
  }
}

function clearNoteAutocomplete(options = {}) {
  if (state.noteAutocompleteTimer) {
    window.clearTimeout(state.noteAutocompleteTimer);
    state.noteAutocompleteTimer = null;
  }

  state.noteAutocompleteSuggestion = "";
  state.noteAutocompleteSelectionRange = null;

  if (elements.noteAutocompleteGhost) {
    elements.noteAutocompleteGhost.hidden = true;
    elements.noteAutocompleteGhost.textContent = "";
  }

  if (options.resetFingerprint) {
    state.noteAutocompleteFingerprint = "";
  }

  if (options.abortRequest) {
    state.noteAutocompleteRequestId += 1;
    abortNoteAutocompleteRequest();
  }
}

function abortNoteAutocompleteRequest() {
  if (!state.noteAutocompleteAbortController) {
    return;
  }

  state.noteAutocompleteAbortController.abort();
  state.noteAutocompleteAbortController = null;
}

function scheduleNoteAutocomplete() {
  if (!state.noteAutocompleteEnabled || state.isComposingNote) {
    return;
  }

  if (document.activeElement !== elements.noteEditor) {
    return;
  }

  if (state.noteAutocompleteTimer) {
    window.clearTimeout(state.noteAutocompleteTimer);
  }

  state.noteAutocompleteTimer = window.setTimeout(() => {
    state.noteAutocompleteTimer = null;
    void requestNoteAutocomplete();
  }, NOTE_AUTOCOMPLETE_DELAY_MS);
}

async function requestNoteAutocomplete() {
  const payload = buildNoteAutocompletePayload();

  if (!payload) {
    return;
  }

  const fingerprint = JSON.stringify([
    payload.courseId,
    payload.currentPage,
    payload.cursorBefore,
    payload.cursorAfter,
    payload.lastAiAnswer,
  ]);

  if (fingerprint === state.noteAutocompleteFingerprint) {
    return;
  }

  state.noteAutocompleteFingerprint = fingerprint;
  abortNoteAutocompleteRequest();

  const controller = new AbortController();
  const requestId = state.noteAutocompleteRequestId + 1;
  state.noteAutocompleteRequestId = requestId;
  state.noteAutocompleteAbortController = controller;

  try {
    const data = await fetchNoteAutocomplete(payload, controller.signal);

    if (
      requestId !== state.noteAutocompleteRequestId ||
      !state.noteAutocompleteEnabled ||
      document.activeElement !== elements.noteEditor
    ) {
      return;
    }

    const suggestion = String(data.suggestion || "").trim();
    if (!suggestion) {
      clearNoteAutocomplete();
      return;
    }

    state.noteAutocompleteSuggestion = suggestion;
    state.noteAutocompleteSelectionRange = payload.selectionRange;
    showNoteAutocompleteGhost(suggestion);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    state.noteAutocompleteFingerprint = "";
    console.warn("笔记自动补全失败。", error);
    clearNoteAutocomplete();
  } finally {
    if (state.noteAutocompleteAbortController === controller) {
      state.noteAutocompleteAbortController = null;
    }
  }
}

function buildNoteAutocompletePayload() {
  if (!state.noteAutocompleteEnabled || state.isComposingNote) {
    return null;
  }

  if (document.activeElement !== elements.noteEditor) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return null;
  }

  const domRange = selection.getRangeAt(0);
  if (
    !domRange.collapsed ||
    !elements.noteEditor.contains(domRange.startContainer) ||
    !elements.noteEditor.contains(domRange.endContainer)
  ) {
    return null;
  }

  const selectionRange = getNoteSelectionRange();
  if (selectionRange.start !== selectionRange.end) {
    return null;
  }

  const visibleText = getNoteEditorText();
  const cursorBefore = visibleText.slice(0, selectionRange.start);
  const cursorAfter = visibleText.slice(selectionRange.end);

  if (!`${cursorBefore}${cursorAfter}`.trim()) {
    return null;
  }

  return {
    courseId: state.currentCourseId,
    currentPage: getCurrentVisibleSlidePage(),
    noteContent: state.noteContent,
    cursorBefore: trimAutocompleteText(cursorBefore, 1000, true),
    cursorAfter: trimAutocompleteText(cursorAfter, 800, false),
    lastAiAnswer: getLastAssistantAnswer(),
    selectionRange,
  };
}

function trimAutocompleteText(text, limit, fromEnd) {
  const value = String(text || "");

  if (value.length <= limit) {
    return value;
  }

  return fromEnd ? value.slice(-limit) : value.slice(0, limit);
}

function getLastAssistantAnswer() {
  for (const message of [...state.messages].reverse()) {
    const messageId = String(message.id || "");
    const content = String(message.content || "").trim();

    if (
      message.role === "assistant" &&
      content &&
      !messageId.startsWith("assistant-starter-")
    ) {
      return trimAutocompleteText(content, 1200, true);
    }
  }

  return "";
}

function showNoteAutocompleteGhost(suggestion) {
  if (!elements.noteAutocompleteGhost || !suggestion) {
    return;
  }

  elements.noteAutocompleteGhost.textContent = suggestion;
  positionNoteAutocompleteGhost();
  elements.noteAutocompleteGhost.hidden = false;
}

function positionNoteAutocompleteGhost() {
  if (!elements.noteSurface || !elements.noteAutocompleteGhost) {
    return;
  }

  const surfaceRect = elements.noteSurface.getBoundingClientRect();
  const caretRect = getNoteCaretRect();
  const editorRect = elements.noteEditor.getBoundingClientRect();
  let left = editorRect.left - surfaceRect.left + 16;
  let top = editorRect.top - surfaceRect.top + 16;

  if (caretRect) {
    left = caretRect.right - surfaceRect.left;
    top = caretRect.top - surfaceRect.top;
  }

  left = Math.max(8, Math.min(left, Math.max(8, surfaceRect.width - 80)));
  top = Math.max(8, Math.min(top, Math.max(8, surfaceRect.height - 32)));

  elements.noteAutocompleteGhost.style.left = `${left}px`;
  elements.noteAutocompleteGhost.style.top = `${top}px`;
  elements.noteAutocompleteGhost.style.maxWidth = `${Math.max(
    120,
    surfaceRect.width - left - 12,
  )}px`;
}

function getNoteCaretRect() {
  const selection = window.getSelection();

  if (!selection || !selection.rangeCount) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (
    !range.collapsed ||
    !elements.noteEditor.contains(range.startContainer) ||
    !elements.noteEditor.contains(range.endContainer)
  ) {
    return null;
  }

  const rects = range.getClientRects();
  if (rects.length) {
    return rects[rects.length - 1];
  }

  const rect = range.getBoundingClientRect();
  return rect.width || rect.height ? rect : null;
}

function acceptNoteAutocomplete() {
  const suggestion = state.noteAutocompleteSuggestion;
  const selectionRange = state.noteAutocompleteSelectionRange;

  if (!suggestion) {
    return false;
  }

  clearNoteAutocomplete({
    abortRequest: true,
    resetFingerprint: true,
  });
  insertTextAtCurrentNoteSelection(suggestion, selectionRange);
  return true;
}

function insertTextAtCurrentNoteSelection(text, selectionRange) {
  if (selectionRange && Number.isInteger(selectionRange.start)) {
    insertIntoNoteEditor(text, selectionRange.start, selectionRange.end);
    return;
  }

  if (elements.noteEditor.dataset.rawMode === "true") {
    insertIntoNoteEditor(text);
    return;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    insertIntoNoteEditor(text);
    return;
  }

  const range = selection.getRangeAt(0);
  if (
    !elements.noteEditor.contains(range.startContainer) ||
    !elements.noteEditor.contains(range.endContainer)
  ) {
    insertIntoNoteEditor(text);
    return;
  }

  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  const nextSelectionRange = getNoteSelectionRange();
  setNoteContent(getNoteEditorMarkdown());
  renderNoteEditor({
    keepFocus: true,
    selectionRange: nextSelectionRange,
  });
}

function handleNoteEditorKeydown(event) {
  if (event.key !== "Tab" || event.isComposing) {
    return;
  }

  if (!state.noteAutocompleteSuggestion) {
    return;
  }

  event.preventDefault();
  acceptNoteAutocomplete();
}

function getNoteSelectionRange() {
  const text = getNoteEditorText();
  const selection = window.getSelection();

  if (!selection || !selection.rangeCount) {
    return {
      start: text.length,
      end: text.length,
    };
  }

  const range = selection.getRangeAt(0);

  if (
    !elements.noteEditor.contains(range.startContainer) ||
    !elements.noteEditor.contains(range.endContainer)
  ) {
    return {
      start: text.length,
      end: text.length,
    };
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(elements.noteEditor);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(elements.noteEditor);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

function setNoteSelectionRange(start, end) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(
    elements.noteEditor,
    NodeFilter.SHOW_TEXT,
  );
  let currentOffset = 0;
  let startSet = false;
  let endSet = false;
  let node = walker.nextNode();

  while (node) {
    const nextOffset = currentOffset + node.textContent.length;

    if (!startSet && start <= nextOffset) {
      range.setStart(node, Math.max(0, start - currentOffset));
      startSet = true;
    }

    if (!endSet && end <= nextOffset) {
      range.setEnd(node, Math.max(0, end - currentOffset));
      endSet = true;
      break;
    }

    currentOffset = nextOffset;
    node = walker.nextNode();
  }

  if (!startSet || !endSet) {
    range.selectNodeContents(elements.noteEditor);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}
