// Conversation lifecycle and chat message sending.
function applyConversation(conversation) {
  state.activeConversationId = conversation.id || null;
  state.messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : defaultChatMessages();
  state.lastChatMetadata = null;
  state.isStartingConversation = false;
  state.starterStatus = "";
  resetChatProgress();
  renderMessages();
}

async function refreshConversations() {
  try {
    const data = await fetchChatConversations(state.currentCourseId);
    state.conversations = Array.isArray(data.conversations)
      ? data.conversations
      : [];
  } catch (error) {
    console.warn("读取历史对话失败。", error);
    state.conversations = [];
  }

  renderHistoryMenu();
}

async function loadLatestConversationForCurrentCourse() {
  await refreshConversations();

  const latestCurrentConversation = state.conversations.find((conversation) =>
    isCurrentCourse(conversation.courseId),
  );

  if (!latestCurrentConversation) {
    state.activeConversationId = null;
    await startNewConversation();
    return;
  }

  await loadConversation(latestCurrentConversation.id, { keepHistoryOpen: true });
}

async function loadConversation(conversationId, options = {}) {
  try {
    const data = await fetchChatConversation(conversationId);
    const conversation = data.conversation;

    if (!conversation) {
      throw new Error("conversation missing");
    }

    if (!isCurrentCourse(conversation.courseId)) {
      state.currentCourseId = conversation.courseId;
      state.activeSlidePage = 1;
      window.history.replaceState(
        {},
        "",
        `/course/${encodeURIComponent(state.currentCourseId)}`,
      );
      await loadCurrentCourse();
      await refreshConversations();
    }

    applyConversation(conversation);

    if (!options.keepHistoryOpen) {
      state.isHistoryOpen = false;
      renderHistoryMenu();
    }
  } catch (error) {
    console.error(error);
  }
}

async function removeConversation(conversationId) {
  try {
    await deleteChatConversation(conversationId);
    await refreshConversations();

    if (conversationId !== state.activeConversationId) {
      return;
    }

    const latestCurrentConversation = state.conversations.find((conversation) =>
      isCurrentCourse(conversation.courseId),
    );

    state.activeConversationId = null;
    state.messages = defaultChatMessages();

    if (latestCurrentConversation) {
      await loadConversation(latestCurrentConversation.id, {
        keepHistoryOpen: true,
      });
    } else {
      await startNewConversation();
    }
  } catch (error) {
    console.error(error);
  }
}

async function startNewConversation() {
  if (state.isSending || state.isStartingConversation) {
    return null;
  }

  let conversation = null;
  let assistantMessage = null;

  state.isStartingConversation = true;
  state.chatStickToBottom = true;
  state.userPausedChatAutoScroll = false;
  state.starterStatus = "正在生成总结...";
  state.activeConversationId = null;
  state.messages = [];
  state.lastChatMetadata = null;
  state.isHistoryOpen = false;
  elements.newChatButton.disabled = true;
  elements.chatSubmit.disabled = true;
  renderMessages();

  try {
    await createChatConversationStream(state.currentCourseId, ({ event, data }) => {
      if (event === "metadata" && data.conversation) {
        conversation = data.conversation;
        state.activeConversationId = conversation.id || state.activeConversationId;
        return;
      }

      if (event === "token") {
        const delta = data.delta || "";

        if (!delta) {
          return;
        }

        if (!assistantMessage) {
          assistantMessage = {
            id: `assistant-starter-${Date.now()}`,
            role: "assistant",
            content: "",
            isStreaming: true,
          };
          state.messages = [assistantMessage];
        }

        state.isStartingConversation = false;
        state.starterStatus = "";
        assistantMessage.content += delta;
        scheduleStreamingRender(assistantMessage);
        return;
      }

      if (event === "error") {
        throw new Error(data.message || "conversation stream error");
      }
    });

    state.isStartingConversation = false;
    state.starterStatus = "";
    if (assistantMessage) {
      assistantMessage.isStreaming = false;
    }
    flushStreamingRender(assistantMessage);
    await refreshConversations();
    renderHistoryMenu();
    return conversation;
  } catch (error) {
    console.error(error);
    state.isStartingConversation = false;
    state.starterStatus = "";
    state.messages = [
      {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: "新建对话失败，请稍后重试。",
      },
    ];
    state.activeConversationId = null;
    renderMessages();
    return null;
  } finally {
    state.isStartingConversation = false;
    state.starterStatus = "";
    if (assistantMessage) {
      assistantMessage.isStreaming = false;
    }
    elements.newChatButton.disabled = false;
    elements.chatSubmit.disabled = false;
    renderMessages();
  }
}

async function ensureActiveConversation() {
  if (state.activeConversationId) {
    return true;
  }

  const conversation = await startNewConversation();
  return Boolean(conversation);
}

async function saveActiveConversation() {
  if (!state.activeConversationId) {
    return;
  }

  try {
    await saveChatConversation(state.activeConversationId, state.messages);
    await refreshConversations();
  } catch (error) {
    console.warn("保存历史对话失败。", error);
  }
}

async function sendChatMessage() {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      courseId: state.currentCourseId,
      currentPage: getCurrentVisibleSlidePage(),
      currentNote: state.noteContent,
      messages: state.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error("chat api unavailable");
  }

  let assistantMessage = null;

  await readSseStream(response, ({ event, data }) => {
    if (event === "status") {
      updatePendingStatus(data.label);
      return;
    }

    if (event === "token") {
      const delta = data.delta || "";

      if (!delta) {
        return;
      }

      if (!assistantMessage) {
        assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          citations: [],
          isStreaming: true,
        };
        state.messages.push(assistantMessage);
      }

      clearPendingStatusTimer();
      state.hasAssistantToken = true;
      state.pendingStatus = "";
      assistantMessage.content += delta;
      scheduleStreamingRender(assistantMessage);
      return;
    }

    if (event === "metadata") {
      state.lastChatMetadata = data;

      if (assistantMessage) {
        assistantMessage.citations = data.citations || [];
        assistantMessage.content = canonicalizeCitationText(
          assistantMessage.content,
          assistantMessage.citations,
        );
        scheduleStreamingRender(assistantMessage);
      }
      return;
    }

    if (event === "error") {
      throw new Error(data.message || "chat stream error");
    }
  });

  if (assistantMessage) {
    assistantMessage.isStreaming = false;
    flushStreamingRender(assistantMessage);
  }
}
