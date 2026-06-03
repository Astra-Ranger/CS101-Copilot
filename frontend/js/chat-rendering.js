// Notebook summaries, chat rendering, MathJax, streaming, and SSE parsing.
function notebookSummaryFromNotebook(notebook) {
  const content = String(notebook.content || "");
  return {
    id: notebook.id,
    title: notebook.title || "未命名笔记",
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
    contentSavedAt: notebook.contentSavedAt,
    titleGeneratedAt: notebook.titleGeneratedAt,
    contentLength: content.trim().length,
    preview: content.replace(/\s+/g, " ").trim().slice(0, 80),
  };
}

function syncNotebookSummary(notebook) {
  if (!notebook || !notebook.id) {
    return;
  }

  const summary = notebookSummaryFromNotebook(notebook);
  const index = state.notebooks.findIndex((item) => item.id === notebook.id);

  if (index >= 0) {
    state.notebooks[index] = summary;
  } else {
    state.notebooks.push(summary);
  }

  state.notebooks.sort((left, right) =>
    String(right.updatedAt || right.createdAt || "").localeCompare(
      String(left.updatedAt || left.createdAt || ""),
    ),
  );
}

function renderNotebookMenu() {
  elements.notebookMenu.innerHTML = "";
  elements.notebookMenu.hidden = !state.isNotebookModalOpen;

  if (!state.isNotebookModalOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "笔记本";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭笔记本列表");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.isNotebookModalOpen = false;
    renderNotebookMenu();
  });

  header.append(title, closeButton);
  dialog.append(header);

  if (!state.notebooks.length) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "暂无笔记本";
    dialog.append(empty);
    elements.notebookMenu.append(dialog);
    return;
  }

  state.notebooks.forEach((notebook) => {
    const item = document.createElement("div");
    item.className = "chat-history-item";
    item.classList.toggle("active", notebook.id === state.activeNotebookId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-history-open";

    const notebookTitle = document.createElement("span");
    notebookTitle.className = "chat-history-title";
    notebookTitle.textContent = notebook.title || "未命名笔记";

    const meta = document.createElement("span");
    meta.className = "chat-history-meta";
    meta.textContent = `${formatConversationTime(notebook.updatedAt) || "刚刚"} · ${
      notebook.contentLength || 0
    } 字`;

    const preview = document.createElement("span");
    preview.className = "notebook-preview-text";
    preview.textContent = notebook.preview || "空笔记本";

    button.append(notebookTitle, meta, preview);
    button.addEventListener("click", () => {
      void loadNotebook(notebook.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "chat-history-delete";
    deleteButton.setAttribute("aria-label", "删除笔记本");
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => {
      void removeNotebook(notebook.id);
    });

    item.append(button, deleteButton);
    dialog.append(item);
  });

  elements.notebookMenu.append(dialog);
}

function renderMessages(options = {}) {
  const shouldTypesetMath = options.typesetMath !== false;
  const shouldCompileStreaming = options.compileStreaming === true;
  const shouldStickToBottom =
    options.stickToBottom !== undefined
      ? Boolean(options.stickToBottom)
      : shouldAutoScrollChat();
  const previousScrollTop = elements.messageList.scrollTop;
  const previousScrollHeight = elements.messageList.scrollHeight;
  streamingViews.clear();
  elements.messageList.innerHTML = "";

  state.messages.forEach((message) => {
    const row = document.createElement("article");
    row.className = `message-row ${message.role}`;
    row.dataset.messageId = message.id || "";

    const stack = document.createElement("div");
    stack.className = "message-stack";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (message.role === "assistant") {
      if (message.isStreaming && !shouldCompileStreaming) {
        appendPlainText(bubble, message.content);
      } else {
        appendMarkdown(
          bubble,
          message.content,
          buildCitationDisplayMap(message.content),
        );
      }
    } else {
      appendTextWithCitations(
        bubble,
        message.content,
        buildCitationDisplayMap(message.content),
      );
    }

    stack.append(bubble);

    if (
      state.isSending &&
      !state.hasAssistantToken &&
      message.id === state.pendingMessageId &&
      state.pendingStatus
    ) {
      const status = document.createElement("div");
      status.className = "message-status";
      status.textContent = `${state.pendingStatus}...`;
      stack.append(status);
    }

    row.append(stack);
    elements.messageList.append(row);
  });

  if (state.isStartingConversation && state.starterStatus) {
    const status = document.createElement("div");
    status.className = "chat-inline-status";
    status.textContent = state.starterStatus;
    elements.messageList.append(status);
  }

  if (shouldStickToBottom) {
    scrollChatToBottom();
  } else {
    const heightDelta = elements.messageList.scrollHeight - previousScrollHeight;
    elements.messageList.scrollTop = Math.max(0, previousScrollTop + heightDelta);
  }
  renderHistoryMenu();
  if (shouldTypesetMath && !state.isSending && !state.isStartingConversation) {
    queueMathTypeset();
  }
}

function queueMathTypeset(root = elements.messageList) {
  if (!root || !hasMathContent(root.textContent || "")) {
    return;
  }

  mathTypesetRoots.add(root);

  if (mathTypesetScheduled || mathTypesetInFlight) {
    return;
  }

  mathTypesetScheduled = true;
  window.requestAnimationFrame(() => {
    mathTypesetScheduled = false;
    void typesetMathNow();
  });
}

async function typesetMathNow() {
  if (mathTypesetInFlight || !mathTypesetRoots.size) {
    return;
  }

  const roots = Array.from(mathTypesetRoots).filter((root) => root.isConnected);
  mathTypesetRoots.clear();

  if (!roots.length) {
    return;
  }

  const mathJax = await ensureMathJax();

  if (!mathJax || typeof mathJax.typesetPromise !== "function") {
    return;
  }

  mathTypesetInFlight = true;

  if (typeof mathJax.typesetClear === "function") {
    mathJax.typesetClear(roots);
  }

  try {
    await mathJax.typesetPromise(roots);
  } catch (error) {
    console.warn("MathJax typeset failed.", error);
  } finally {
    mathTypesetInFlight = false;

    if (mathTypesetRoots.size) {
      queueMathTypeset(Array.from(mathTypesetRoots)[0]);
    }
  }
}

function ensureMathJax() {
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    return Promise.resolve(window.MathJax);
  }

  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }

  mathJaxLoadPromise = loadMathJaxScript(MATHJAX_CDN_URL).then((mathJax) => {
    if (mathJax && typeof mathJax.typesetPromise === "function") {
      return mathJax;
    }

    return loadMathJaxScript(MATHJAX_LOCAL_URL);
  });

  return mathJaxLoadPromise;
}

function loadMathJaxScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    let settled = false;

    script.id = src === MATHJAX_CDN_URL ? "MathJax-cdn-script" : "MathJax-local-script";
    script.src = src;
    script.async = true;

    const finish = (mathJax) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      resolve(mathJax);
    };

    const timeout = window.setTimeout(() => {
      script.remove();
      finish(null);
    }, 2500);

    script.addEventListener("load", () => {
      finish(window.MathJax || null);
    });
    script.addEventListener("error", () => {
      script.remove();
      finish(null);
    });
    document.head.append(script);
  });
}

function hasMathContent(text) {
  return /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+\$)/.test(
    text,
  );
}

function isChatNearBottom() {
  const distance =
    elements.messageList.scrollHeight -
    elements.messageList.scrollTop -
    elements.messageList.clientHeight;
  return distance <= CHAT_BOTTOM_THRESHOLD;
}

function shouldAutoScrollChat() {
  return state.chatStickToBottom && !state.userPausedChatAutoScroll;
}

function scrollChatToBottom() {
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
  state.chatStickToBottom = true;
  state.userPausedChatAutoScroll = false;
}

function handleMessageListScroll() {
  const nearBottom = isChatNearBottom();
  state.chatStickToBottom = nearBottom;
  if (nearBottom) {
    state.userPausedChatAutoScroll = false;
  }
}

function handleMessageListWheel(event) {
  if (event.deltaY < 0) {
    state.userPausedChatAutoScroll = true;
    state.chatStickToBottom = false;
    return;
  }

  window.requestAnimationFrame(handleMessageListScroll);
}

function scheduleStreamingRender(message) {
  if (message) {
    renderStreamingMessage(message);
  }
}

function flushStreamingRender(message) {
  if (message) {
    renderStreamingMessage(message, { flush: true });
  }
}

function renderStreamingMessage(message, options = {}) {
  clearTransientChatStatus();
  const shouldStickToBottom = shouldAutoScrollChat();
  const view = ensureStreamingView(message);
  const content = String(message.content || "");
  const stableEnd = options.flush
    ? content.length
    : findStableMarkdownBoundary(content, view.committedLength);

  if (stableEnd > view.committedLength) {
    const stableText = content.slice(view.committedLength, stableEnd);
    const block = document.createElement("div");
    block.className = "streaming-block";
    appendMarkdown(
      block,
      stableText,
      buildCitationDisplayMap(content),
    );
    view.committedContainer.append(block);
    queueMathTypeset(block);
    view.committedLength = stableEnd;
  }

  const tailText = content.slice(view.committedLength);
  view.tail.textContent = tailText;
  if (shouldStickToBottom) {
    scrollChatToBottom();
  }
}

function clearTransientChatStatus() {
  if (state.hasAssistantToken) {
    elements.messageList
      .querySelectorAll(".message-status")
      .forEach((node) => node.remove());
  }

  if (!state.isStartingConversation) {
    elements.messageList
      .querySelectorAll(".chat-inline-status")
      .forEach((node) => node.remove());
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value || ""));
  }

  return String(value || "").replace(/["\\]/g, "\\$&");
}

function ensureStreamingView(message) {
  const cachedView = streamingViews.get(message.id);

  if (cachedView && cachedView.row.isConnected) {
    return cachedView;
  }

  const existingRow = elements.messageList.querySelector(
    `[data-message-id="${cssEscape(message.id)}"]`,
  );

  if (existingRow) {
    existingRow.remove();
  }

  const row = document.createElement("article");
  row.className = `message-row ${message.role}`;
  row.dataset.messageId = message.id;

  const stack = document.createElement("div");
  stack.className = "message-stack";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble message-markdown";

  const committedContainer = document.createElement("div");
  committedContainer.className = "streaming-committed";

  const tail = document.createElement("span");
  tail.className = "streaming-tail";

  bubble.append(committedContainer, tail);
  stack.append(bubble);
  row.append(stack);
  elements.messageList.append(row);

  const view = {
    row,
    bubble,
    committedContainer,
    tail,
    committedLength: 0,
  };

  streamingViews.set(message.id, view);
  return view;
}

function findStableMarkdownBoundary(text, minIndex) {
  const searchStart = Math.max(0, minIndex);
  let boundary = -1;
  let index = searchStart;
  let inFence = false;
  let inMathBlock = false;

  while (index < text.length) {
    const lineEnd = text.indexOf("\n", index);
    const lineStop = lineEnd === -1 ? text.length : lineEnd;
    const line = text.slice(index, lineStop);
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      if (!inFence && lineEnd !== -1) {
        boundary = lineEnd + 1;
      }
    } else if (!inFence) {
      const mathState = getMathBlockState(trimmed, inMathBlock);

      if (mathState.started) {
        inMathBlock = true;
      }

      if (mathState.ended) {
        inMathBlock = false;

        if (lineEnd !== -1) {
          boundary = lineEnd + 1;
        }
      } else if (!inMathBlock && trimmed === "" && lineEnd !== -1) {
        boundary = lineEnd + 1;
      }
    }

    if (lineEnd === -1) {
      break;
    }

    index = lineEnd + 1;
  }

  return boundary > minIndex ? boundary : minIndex;
}

function getMathBlockState(trimmedLine, inMathBlock) {
  if (!trimmedLine) {
    return {
      started: false,
      ended: false,
    };
  }

  const startsDollarBlock = trimmedLine.startsWith("$$");
  const endsDollarBlock = trimmedLine.endsWith("$$") && trimmedLine.length > 2;
  const startsBracketBlock = trimmedLine.startsWith("\\[");
  const endsBracketBlock = trimmedLine.endsWith("\\]") && trimmedLine.length > 2;

  if (inMathBlock) {
    return {
      started: false,
      ended:
        trimmedLine === "$$" ||
        trimmedLine === "\\]" ||
        endsDollarBlock ||
        endsBracketBlock,
    };
  }

  return {
    started:
      (startsDollarBlock && !endsDollarBlock) ||
      (startsBracketBlock && !endsBracketBlock),
    ended:
      (startsDollarBlock && endsDollarBlock) ||
      (startsBracketBlock && endsBracketBlock),
  };
}

function clearPendingStatusTimer() {
  if (state.pendingStatusTimer) {
    window.clearTimeout(state.pendingStatusTimer);
    state.pendingStatusTimer = null;
  }
}

function resetChatProgress() {
  clearPendingStatusTimer();
  state.pendingStatus = "";
  state.pendingStatusSince = 0;
  state.pendingMessageId = null;
  state.hasAssistantToken = false;
}

function updatePendingStatus(label) {
  if (!label || !state.isSending || state.hasAssistantToken) {
    return;
  }

  const applyStatus = () => {
    if (!state.isSending || state.hasAssistantToken) {
      return;
    }

    state.pendingStatus = label;
    state.pendingStatusSince = Date.now();
    renderMessages();
  };

  clearPendingStatusTimer();

  if (!state.pendingStatusSince) {
    applyStatus();
    return;
  }

  const elapsed = Date.now() - state.pendingStatusSince;

  if (elapsed >= STATUS_MIN_VISIBLE_MS) {
    applyStatus();
    return;
  }

  state.pendingStatusTimer = window.setTimeout(
    applyStatus,
    STATUS_MIN_VISIBLE_MS - elapsed,
  );
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  });

  const dataText = dataLines.join("\n");

  return {
    event,
    data: dataText ? JSON.parse(dataText) : {},
  };
}

async function readSseStream(response, handleEvent) {
  if (!response.body) {
    throw new Error("chat stream unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (block.trim()) {
        handleEvent(parseSseBlock(block));
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    handleEvent(parseSseBlock(buffer));
  }
}
