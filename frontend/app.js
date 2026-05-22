(function () {
  const citationPattern = /【([^】]+)】/g;
  const staticManifest = window.COURSE_SLIDES_MANIFEST || {
    aliases: {},
    courses: [],
  };

  const state = {
    currentCourseId: getInitialCourseId(),
    activeSlidePage: 1,
    slideZoom: 1,
    pinch: null,
    noteContent: "",
    courseIndex: {
      aliases: staticManifest.aliases || {},
      courses: staticManifest.courses || [],
    },
    currentDeck: null,
    messages: defaultChatMessages(),
    activeConversationId: null,
    conversations: [],
    isHistoryOpen: false,
    isStartingConversation: false,
    starterStatus: "",
    isSending: false,
    pendingStatus: "",
    pendingStatusSince: 0,
    pendingStatusTimer: null,
    pendingMessageId: null,
    hasAssistantToken: false,
    lastChatMetadata: null,
    saveTimer: null,
    saveMode: getInitialSaveMode(),
    hasUnsavedNote: false,
  };

  const elements = {
    slideTitle: document.querySelector("#slide-title"),
    slideCount: document.querySelector("#slide-count"),
    slideList: document.querySelector("#slide-list"),
    courseSelect: document.querySelector("#course-select"),
    messageList: document.querySelector("#message-list"),
    chatForm: document.querySelector("#chat-form"),
    chatInput: document.querySelector("#chat-input"),
    chatSubmit: document.querySelector("#chat-submit"),
    newChatButton: document.querySelector("#new-chat-button"),
    chatHistoryButton: document.querySelector("#chat-history-button"),
    chatHistoryMenu: document.querySelector("#chat-history-menu"),
    noteEditor: document.querySelector("#note-editor"),
    saveState: document.querySelector("#save-state"),
    autoSaveMode: document.querySelector("#auto-save-mode"),
    manualSaveMode: document.querySelector("#manual-save-mode"),
    manualSaveButton: document.querySelector("#manual-save-button"),
  };

  const slidePointers = new Map();
  const MIN_SLIDE_ZOOM = 1;
  const MAX_SLIDE_ZOOM = 2.6;
  const SLIDE_WHEEL_ZOOM_STEP = 0.08;
  const STATUS_MIN_VISIBLE_MS = 500;

  function getInitialCourseId() {
    const url = new URL(window.location.href);
    const courseFromQuery = url.searchParams.get("course");

    if (courseFromQuery) {
      return courseFromQuery;
    }

    const hashMatch = window.location.hash.match(/^#\/course\/(.+)$/);

    if (hashMatch) {
      return decodeURIComponent(hashMatch[1]);
    }

    const pathMatch = window.location.pathname.match(/^\/course\/(.+)$/);

    if (pathMatch) {
      return decodeURIComponent(pathMatch[1]);
    }

    return "demo-course";
  }

  function getInitialSaveMode() {
    return window.localStorage.getItem("cs101-note-save-mode") === "manual"
      ? "manual"
      : "auto";
  }

  function defaultChatMessages() {
    return [];
  }

  function resolveCourseId(courseId) {
    return state.courseIndex.aliases[courseId] || courseId;
  }

  function getCourseSummary(courseId) {
    const resolvedCourseId = resolveCourseId(courseId);
    return (
      state.courseIndex.courses.find((course) => course.id === resolvedCourseId) ||
      state.courseIndex.courses[0] ||
      null
    );
  }

  function getStorageKey() {
    return `cs101-note:${resolveCourseId(state.currentCourseId)}`;
  }

  function encodePathSegments(segments) {
    return segments.map((segment) => encodeURIComponent(segment)).join("/");
  }

  function formatPageFilename(pageNumber) {
    return `page_${String(pageNumber).padStart(3, "0")}.webp`;
  }

  function buildDeckFromManifest(courseId) {
    const course = getCourseSummary(courseId);

    if (!course) {
      return null;
    }

    return {
      courseId,
      resolvedCourseId: course.id,
      week: course.week,
      title: course.title,
      slides: Array.from({ length: course.pageCount }, (_, index) => {
        const pageNumber = index + 1;

        return {
          pageNumber,
          title: `第 ${pageNumber} 页`,
          imageUrl: `/${encodePathSegments(course.pathSegments)}/${formatPageFilename(
            pageNumber,
          )}`,
        };
      }),
    };
  }

  async function fetchCourseIndex() {
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("course index api unavailable");
      }

      state.courseIndex = await response.json();
    } catch (error) {
      console.warn("使用静态课件 manifest 作为回退。", error);
      state.courseIndex = {
        aliases: staticManifest.aliases || {},
        courses: staticManifest.courses || [],
      };
    }
  }

  async function fetchCourseDeck(courseId) {
    try {
      const response = await fetch(`/api/slides/${encodeURIComponent(courseId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("slide api unavailable");
      }

      return response.json();
    } catch (error) {
      console.warn("使用静态课件页列表作为回退。", error);
      return buildDeckFromManifest(courseId);
    }
  }

  async function fetchChatConversations(courseId) {
    const params = new URLSearchParams({ courseId });
    const response = await fetch(`/api/chat/conversations?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("conversation list api unavailable");
    }

    return response.json();
  }

  async function createChatConversation(courseId) {
    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ courseId }),
    });

    if (!response.ok) {
      throw new Error("conversation create api unavailable");
    }

    return response.json();
  }

  async function createChatConversationStream(courseId, handleEvent) {
    const response = await fetch("/api/chat/conversations/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ courseId }),
    });

    if (!response.ok) {
      throw new Error("conversation stream api unavailable");
    }

    await readSseStream(response, handleEvent);
  }

  async function fetchChatConversation(conversationId) {
    const response = await fetch(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("conversation api unavailable");
    }

    return response.json();
  }

  async function deleteChatConversation(conversationId) {
    const response = await fetch(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error("conversation delete api unavailable");
    }

    return response.json();
  }

  async function saveChatConversation(conversationId, messages) {
    const response = await fetch(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: state.currentCourseId,
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            citations: message.citations || [],
          })),
        }),
      },
    );

    if (!response.ok) {
      throw new Error("conversation save api unavailable");
    }

    return response.json();
  }

  function renderCourseSelect() {
    elements.courseSelect.innerHTML = "";

    const categoryOrder = [
      ["lecture", "计科导"],
      ["lab", "实验"],
      ["supplement", "补充材料"],
    ];

    categoryOrder.forEach(([category, label]) => {
      const courses = state.courseIndex.courses.filter(
        (course) => (course.category || "lecture") === category,
      );

      if (!courses.length) {
        return;
      }

      const group = document.createElement("optgroup");
      group.label = label;

      courses.forEach((course) => {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.title;
        group.append(option);
      });

      elements.courseSelect.append(group);
    });

    const selectedCourse = getCourseSummary(state.currentCourseId);

    if (selectedCourse) {
      elements.courseSelect.value = selectedCourse.id;
    }
  }

  function setActiveSlidePage(pageNumber) {
    const normalizedPage = clampSlidePage(pageNumber);
    state.activeSlidePage = normalizedPage;

    const target = document.querySelector(
      `[data-page-number="${normalizedPage}"]`,
    );

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getCurrentVisibleSlidePage() {
    const cards = [...elements.slideList.querySelectorAll("[data-page-number]")];

    if (!cards.length) {
      return state.activeSlidePage;
    }

    const containerRect = elements.slideList.getBoundingClientRect();
    let bestPage = state.activeSlidePage;
    let bestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();

      if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) {
        return;
      }

      const distance = Math.abs(rect.top - containerRect.top);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = Number(card.dataset.pageNumber) || bestPage;
      }
    });

    state.activeSlidePage = clampSlidePage(bestPage);
    return state.activeSlidePage;
  }

  function clampSlidePage(pageNumber) {
    const maxPage = state.currentDeck ? state.currentDeck.slides.length : 1;
    const normalizedPage = Math.max(1, Math.floor(Number(pageNumber) || 1));

    return Math.min(normalizedPage, maxPage);
  }

  function renderSlides() {
    const deck = state.currentDeck;

    if (!deck) {
      elements.slideList.innerHTML =
        '<div class="empty-state">暂无课件，请检查 course_slide 目录</div>';
      elements.slideTitle.textContent = "课件";
      elements.slideCount.textContent = "0 页";
      return;
    }

    elements.slideTitle.textContent = deck.title;
    elements.slideCount.textContent = `${deck.slides.length} 页`;
    state.activeSlidePage = clampSlidePage(state.activeSlidePage);
    elements.slideList.innerHTML = "";

    const stack = document.createElement("div");
    stack.className = "slide-stack";

    deck.slides.forEach((slide) => {
      const card = document.createElement("article");
      card.className = "slide-card";
      card.dataset.pageNumber = String(slide.pageNumber);

      const image = document.createElement("img");
      image.src = slide.imageUrl;
      image.alt = `${deck.title} ${slide.title}`;
      image.loading = "lazy";
      image.onerror = () => {
        image.replaceWith(createImageFallback(slide.pageNumber));
      };

      card.append(image);
      stack.append(card);
    });

    elements.slideList.append(stack);
    applySlideZoom();
    setActiveSlidePage(state.activeSlidePage);
  }

  function clampSlideZoom(value) {
    return Math.min(MAX_SLIDE_ZOOM, Math.max(MIN_SLIDE_ZOOM, value));
  }

  function getSlideStack() {
    return elements.slideList.querySelector(".slide-stack");
  }

  function applySlideZoom() {
    const stack = getSlideStack();

    if (!stack) {
      return;
    }

    stack.style.width = `${state.slideZoom * 100}%`;
  }

  function getDistance(pointA, pointB) {
    return Math.hypot(
      pointA.clientX - pointB.clientX,
      pointA.clientY - pointB.clientY,
    );
  }

  function getMidpoint(pointA, pointB) {
    return {
      clientX: (pointA.clientX + pointB.clientX) / 2,
      clientY: (pointA.clientY + pointB.clientY) / 2,
    };
  }

  function zoomSlides(nextZoom, anchorPoint) {
    const previousZoom = state.slideZoom;
    const zoom = clampSlideZoom(nextZoom);

    if (Math.abs(zoom - previousZoom) < 0.001) {
      return;
    }

    const rect = elements.slideList.getBoundingClientRect();
    const anchorX = anchorPoint ? anchorPoint.clientX - rect.left : rect.width / 2;
    const anchorY = anchorPoint ? anchorPoint.clientY - rect.top : rect.height / 2;
    const contentX = elements.slideList.scrollLeft + anchorX;
    const contentY = elements.slideList.scrollTop + anchorY;

    state.slideZoom = zoom;
    applySlideZoom();

    const scale = zoom / previousZoom;
    elements.slideList.scrollLeft = contentX * scale - anchorX;
    elements.slideList.scrollTop = contentY * scale - anchorY;
  }

  function handleSlidePointerDown(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    slidePointers.set(event.pointerId, event);

    if (slidePointers.size === 2) {
      const [pointA, pointB] = [...slidePointers.values()];
      state.pinch = {
        distance: getDistance(pointA, pointB),
        zoom: state.slideZoom,
      };
      elements.slideList.classList.add("is-pinching");
    }
  }

  function handleSlidePointerMove(event) {
    if (!slidePointers.has(event.pointerId)) {
      return;
    }

    slidePointers.set(event.pointerId, event);

    if (slidePointers.size !== 2 || !state.pinch) {
      return;
    }

    event.preventDefault();

    const [pointA, pointB] = [...slidePointers.values()];
    const distance = getDistance(pointA, pointB);

    if (!state.pinch.distance) {
      return;
    }

    zoomSlides(
      state.pinch.zoom * (distance / state.pinch.distance),
      getMidpoint(pointA, pointB),
    );
  }

  function handleSlidePointerEnd(event) {
    slidePointers.delete(event.pointerId);

    if (slidePointers.size < 2) {
      state.pinch = null;
      elements.slideList.classList.remove("is-pinching");
    }
  }

  function handleSlideWheel(event) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    const direction = event.deltaY < 0 ? 1 : -1;
    zoomSlides(
      state.slideZoom + direction * SLIDE_WHEEL_ZOOM_STEP,
      {
        clientX: event.clientX,
        clientY: event.clientY,
      },
    );
  }

  function createImageFallback(pageNumber) {
    const fallback = document.createElement("div");
    fallback.className = "slide-placeholder";
    fallback.textContent = `第 ${pageNumber} 页图片暂不可用`;
    return fallback;
  }

  function appendTextWithCitations(container, text, citationDisplayMap) {
    let lastIndex = 0;

    for (const match of text.matchAll(citationPattern)) {
      const citation = match[0];
      const target = parseCitationTarget(match[1]);
      const index = match.index || 0;

      appendPlainText(container, text.slice(lastIndex, index));
      if (target) {
        const display = getCitationDisplay(citationDisplayMap, target, citation);
        container.append(
          createCitationButton({
            label: citation,
            displayNumber: display.number,
            courseId: target.courseId,
            pageNumber: target.page,
          }),
        );
      } else {
        appendPlainText(container, citation);
      }
      lastIndex = index + citation.length;
    }

    appendPlainText(container, text.slice(lastIndex));
  }

  function normalizeCourseIdForCitation(courseId) {
    return String(courseId || "").replace(/\s+/g, "");
  }

  function resolveCitationCourseId(courseId) {
    const compactCourseId = normalizeCourseIdForCitation(courseId);
    const courses = state.courseIndex.courses || [];
    const exactCourse = courses.find((course) => course.id === courseId);

    if (exactCourse) {
      return exactCourse.id;
    }

    const compactCourse = courses.find(
      (course) => normalizeCourseIdForCitation(course.id) === compactCourseId,
    );

    return compactCourse ? compactCourse.id : courseId;
  }

  function parseCitationTarget(rawLabel) {
    const label = String(rawLabel || "").trim();
    const currentMatch = label.match(/^P\s*(\d+)$/i);

    if (currentMatch) {
      return {
        courseId: state.currentCourseId,
        page: Number(currentMatch[1]),
      };
    }

    const crossCourseMatch = label.match(/^(.+)-\s*(\d+)$/);

    if (!crossCourseMatch) {
      return null;
    }

    return {
      courseId: resolveCitationCourseId(crossCourseMatch[1].trim()),
      page: Number(crossCourseMatch[2]),
    };
  }

  function citationTargetKey(courseId, pageNumber) {
    return `${normalizeCourseIdForCitation(resolveCitationCourseId(courseId))}:${Number(
      pageNumber,
    )}`;
  }

  function buildCitationDisplayMap(text) {
    const displayMap = new Map();
    let nextNumber = 1;

    for (const match of text.matchAll(citationPattern)) {
      const target = parseCitationTarget(match[1]);

      if (!target) {
        continue;
      }

      const key = citationTargetKey(target.courseId, target.page);

      if (!displayMap.has(key)) {
        displayMap.set(key, {
          number: nextNumber,
        });
        nextNumber += 1;
      }
    }

    return displayMap;
  }

  function getCitationDisplay(displayMap, target, fallbackLabel) {
    const key = citationTargetKey(target.courseId, target.page);
    const display = displayMap.get(key);

    if (display) {
      return display;
    }

    return {
      number: fallbackLabel,
    };
  }

  function canonicalizeCitationText(text, citations) {
    if (!Array.isArray(citations) || !citations.length) {
      return text;
    }

    return text.replace(citationPattern, (fullLabel, rawLabel) => {
      const target = parseCitationTarget(rawLabel);

      if (!target) {
        return fullLabel;
      }

      const matchedCitation = citations.find(
        (citation) =>
          Number(citation.page) === target.page &&
          normalizeCourseIdForCitation(citation.courseId) ===
            normalizeCourseIdForCitation(target.courseId),
      );

      return matchedCitation && matchedCitation.label
        ? matchedCitation.label
        : fullLabel;
    });
  }

  function appendPlainText(container, text) {
    const lines = text.split("\n");

    lines.forEach((line, index) => {
      if (index > 0) {
        container.append(document.createElement("br"));
      }

      if (line) {
        container.append(document.createTextNode(line));
      }
    });
  }

  function createCitationButton({ label, displayNumber, courseId, pageNumber }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "citation-button";
    button.textContent = String(displayNumber);
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      void navigateToCitation(courseId, pageNumber);
    });
    return button;
  }

  function isCurrentCourse(courseId) {
    return resolveCourseId(courseId) === resolveCourseId(state.currentCourseId);
  }

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

  function renderMessages() {
    elements.messageList.innerHTML = "";

    state.messages.forEach((message) => {
      const row = document.createElement("article");
      row.className = `message-row ${message.role}`;

      const stack = document.createElement("div");
      stack.className = "message-stack";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      appendTextWithCitations(
        bubble,
        message.content,
        buildCitationDisplayMap(message.content),
      );

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

    elements.messageList.scrollTop = elements.messageList.scrollHeight;
    renderHistoryMenu();
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
        await initNotes();
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
            };
            state.messages = [assistantMessage];
          }

          state.isStartingConversation = false;
          state.starterStatus = "";
          assistantMessage.content += delta;
          renderMessages();
          return;
        }

        if (event === "error") {
          throw new Error(data.message || "conversation stream error");
        }
      });

      state.isStartingConversation = false;
      state.starterStatus = "";
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
          };
          state.messages.push(assistantMessage);
        }

        clearPendingStatusTimer();
        state.hasAssistantToken = true;
        state.pendingStatus = "";
        assistantMessage.content += delta;
        renderMessages();
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
          renderMessages();
        }
        return;
      }

      if (event === "error") {
        throw new Error(data.message || "chat stream error");
      }
    });
  }

  async function fetchCourseNote(courseId) {
    const response = await fetch(`/api/notes/${encodeURIComponent(courseId)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("note api unavailable");
    }

    return response.json();
  }

  async function saveUserNote(courseId, content) {
    const response = await fetch(`/api/notes/${encodeURIComponent(courseId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error("note save api unavailable");
    }

    return response.json();
  }

  async function handleCourseChange(event) {
    state.currentCourseId = event.target.value;
    state.activeSlidePage = 1;
    state.activeConversationId = null;
    state.isHistoryOpen = false;
    window.history.replaceState(
      {},
      "",
      `/course/${encodeURIComponent(state.currentCourseId)}`,
    );
    await initNotes();
    await loadCurrentCourse();
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
    await initNotes();
    await loadCurrentCourse();
    setActiveSlidePage(targetPage);
  }

  async function loadCurrentCourse() {
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

  function updateSaveState(label, isError) {
    elements.saveState.textContent = label;
    elements.saveState.classList.toggle("error", Boolean(isError));
  }

  function renderSaveMode() {
    const isManual = state.saveMode === "manual";

    elements.autoSaveMode.classList.toggle("active", !isManual);
    elements.manualSaveMode.classList.toggle("active", isManual);
    elements.manualSaveButton.hidden = !isManual;
    elements.manualSaveButton.disabled = !state.hasUnsavedNote;
  }

  function setSaveMode(mode) {
    state.saveMode = mode === "manual" ? "manual" : "auto";
    window.localStorage.setItem("cs101-note-save-mode", state.saveMode);

    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    renderSaveMode();

    if (state.saveMode === "auto" && state.hasUnsavedNote) {
      scheduleAutoSaveNote();
    }
  }

  async function saveCurrentNote() {
    const courseId = state.currentCourseId;
    const content = state.noteContent;

    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    updateSaveState("保存中", false);
    elements.manualSaveButton.disabled = true;

    try {
      await saveUserNote(courseId, content);
      console.log("笔记已保存");

      if (courseId === state.currentCourseId) {
        state.hasUnsavedNote = false;
        updateSaveState("已保存", false);
        renderSaveMode();
      }
    } catch (error) {
      console.error(error);

      if (courseId === state.currentCourseId) {
        state.hasUnsavedNote = true;
        updateSaveState("保存失败", true);
        renderSaveMode();
      }
    }
  }

  function scheduleAutoSaveNote() {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
    }

    state.saveTimer = window.setTimeout(() => {
      void saveCurrentNote();
    }, 2000);
  }

  function handleNoteInput(event) {
    state.noteContent = event.target.value;
    window.localStorage.setItem(getStorageKey(), state.noteContent);
    state.hasUnsavedNote = true;
    updateSaveState("未保存", false);
    renderSaveMode();

    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    if (state.saveMode === "auto") {
      scheduleAutoSaveNote();
    }
  }

  function handleSaveModeClick(event) {
    const mode = event.currentTarget.dataset.saveMode;
    setSaveMode(mode);
  }

  function handleManualSaveClick() {
    void saveCurrentNote();
  }

  function handleHistoryClick() {
    state.isHistoryOpen = !state.isHistoryOpen;
    renderHistoryMenu();
  }

  function handleNewChatClick() {
    void startNewConversation();
  }

  async function initNotes() {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    const storageKey = getStorageKey();
    const localNote = window.localStorage.getItem(storageKey) || "";
    state.noteContent = localNote;
    elements.noteEditor.value = localNote;
    updateSaveState("读取中", false);

    try {
      const note = await fetchCourseNote(state.currentCourseId);
      const hasServerNote = Boolean(note.savedAt);

      if (hasServerNote) {
        state.noteContent = note.content || "";
        elements.noteEditor.value = state.noteContent;
        window.localStorage.setItem(storageKey, state.noteContent);
        state.hasUnsavedNote = false;
        updateSaveState("已保存", false);
      } else {
        state.hasUnsavedNote = Boolean(localNote);
        updateSaveState(localNote ? "本地草稿" : "未保存", false);
      }
    } catch (error) {
      console.warn("使用本地笔记作为回退。", error);
      state.hasUnsavedNote = Boolean(localNote);
      updateSaveState(localNote ? "本地草稿" : "未保存", false);
    }

    renderSaveMode();
  }

  async function init() {
    renderMessages();
    resizeChatInput();
    elements.chatForm.addEventListener("submit", handleChatSubmit);
    elements.chatInput.addEventListener("input", handleChatInput);
    elements.chatInput.addEventListener("keydown", handleChatKeydown);
    elements.slideList.addEventListener("pointerdown", handleSlidePointerDown);
    elements.slideList.addEventListener("pointermove", handleSlidePointerMove);
    elements.slideList.addEventListener("pointerup", handleSlidePointerEnd);
    elements.slideList.addEventListener("pointercancel", handleSlidePointerEnd);
    elements.slideList.addEventListener("wheel", handleSlideWheel, {
      passive: false,
    });
    elements.autoSaveMode.addEventListener("click", handleSaveModeClick);
    elements.manualSaveMode.addEventListener("click", handleSaveModeClick);
    elements.manualSaveButton.addEventListener("click", handleManualSaveClick);
    elements.newChatButton.addEventListener("click", handleNewChatClick);
    elements.chatHistoryButton.addEventListener("click", handleHistoryClick);
    elements.noteEditor.addEventListener("input", handleNoteInput);
    elements.courseSelect.addEventListener("change", handleCourseChange);
    await fetchCourseIndex();
    renderCourseSelect();
    await initNotes();
    await loadCurrentCourse();
    await loadLatestConversationForCurrentCourse();
  }

  init();
})();
