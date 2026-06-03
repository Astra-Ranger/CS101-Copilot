// Notebook API helpers, course changes, and chat input handlers.
async function fetchNotebooks() {
  const response = await fetch("/api/notebooks", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("notebook api unavailable");
  }

  return response.json();
}

async function createNotebook() {
  const response = await fetch("/api/notebooks", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("create notebook api unavailable");
  }

  return response.json();
}

async function fetchNotebook(notebookId) {
  const response = await fetch(`/api/notebooks/${encodeURIComponent(notebookId)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("notebook detail api unavailable");
  }

  return response.json();
}

async function saveNotebook(notebookId, content, forceTitle = false) {
  const response = await fetch(`/api/notebooks/${encodeURIComponent(notebookId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, forceTitle }),
  });

  if (!response.ok) {
    throw new Error("notebook save api unavailable");
  }

  return response.json();
}

async function deleteNotebook(notebookId) {
  const response = await fetch(`/api/notebooks/${encodeURIComponent(notebookId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("notebook delete api unavailable");
  }

  return response.json();
}

async function fetchNoteAutocomplete(payload, signal) {
  const response = await fetch("/api/notebooks/autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error("note autocomplete api unavailable");
  }

  return response.json();
}

async function handleCourseChange(event) {
  clearNoteAutocomplete({ abortRequest: true, resetFingerprint: true });
  state.currentCourseId = event.target.value;
  state.activeSlidePage = 1;
  state.userPausedChatAutoScroll = false;
  state.activeConversationId = null;
  state.isHistoryOpen = false;
  state.quiz.questions = [];
  state.quiz.selectedAnswers = {};
  state.quiz.error = "";
  state.highlights.items = [];
  state.highlights.error = "";
  state.mindmap.root = null;
  state.mindmap.collapsed = {};
  state.mindmap.error = "";
  window.history.replaceState(
    {},
    "",
    `/course/${encodeURIComponent(state.currentCourseId)}`,
  );
  await loadCurrentCourse();
  renderQuizMenu();
  renderHighlightMenu();
  renderMindmapMenu();
  await loadLatestConversationForCurrentCourse();
}

async function navigateToCitation(courseId, pageNumber) {
  const targetCourseId = courseId || state.currentCourseId;
  const targetPage = Math.max(1, Math.floor(Number(pageNumber) || 1));

  if (resolveCourseId(targetCourseId) === resolveCourseId(state.currentCourseId)) {
    setActiveSlidePage(targetPage);
    return;
  }

  state.currentCourseId = targetCourseId;
  state.activeSlidePage = targetPage;
  window.history.replaceState(
    {},
    "",
    `/course/${encodeURIComponent(state.currentCourseId)}`,
  );
  await loadCurrentCourse();
  setActiveSlidePage(targetPage);
}

async function loadCurrentCourse() {
  clearNoteAutocomplete({
    abortRequest: true,
    resetFingerprint: true,
  });
  elements.slideList.innerHTML =
    '<div class="empty-state">正在读取课件目录...</div>';
  state.currentDeck = await fetchCourseDeck(state.currentCourseId);
  renderCourseSelect();
  renderSlides();
}

async function handleChatSubmit(event) {
  event.preventDefault();

  const content = elements.chatInput.value.trim();

  if (!content || state.isSending) {
    return;
  }

  const hasConversation = await ensureActiveConversation();

  if (!hasConversation) {
    return;
  }

  const userMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content,
  };

  state.messages.push(userMessage);
  state.isSending = true;
  state.chatStickToBottom = true;
  state.userPausedChatAutoScroll = false;
  resetChatProgress();
  state.pendingMessageId = userMessage.id;
  elements.chatInput.value = "";
  resizeChatInput();
  elements.chatSubmit.disabled = true;
  renderMessages();

  try {
    await sendChatMessage();
  } catch (error) {
    console.error(error);
    state.messages.push({
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      content: "生成失败，请稍后重试。",
    });
  } finally {
    await saveActiveConversation();
    state.isSending = false;
    elements.chatSubmit.disabled = false;
    resetChatProgress();
    renderMessages();
  }
}

function resizeChatInput() {
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${elements.chatInput.scrollHeight}px`;
  elements.chatInput.style.overflowY =
    elements.chatInput.scrollHeight > 132 ? "auto" : "hidden";
}

function handleChatInput() {
  resizeChatInput();
}

function handleChatKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  elements.chatForm.requestSubmit();
}
