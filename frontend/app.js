(function () {
  const citationPattern = /\[(?:引用)?第(\d+)页\]/g;
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
    messages: [
      {
        id: "assistant-welcome",
        role: "assistant",
        content:
          "我已经载入这份课件。你可以先从核心概念页开始看 [引用第5页]，再对照总结页复习 [引用第12页]。",
      },
    ],
    isSending: false,
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

  function appendTextWithCitations(container, text) {
    let lastIndex = 0;

    for (const match of text.matchAll(citationPattern)) {
      const citation = match[0];
      const pageNumber = Number(match[1]);
      const index = match.index || 0;

      appendPlainText(container, text.slice(lastIndex, index));
      container.append(createCitationButton(citation, pageNumber));
      lastIndex = index + citation.length;
    }

    appendPlainText(container, text.slice(lastIndex));
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

  function createCitationButton(label, pageNumber) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "citation-button";
    button.textContent = label;
    button.addEventListener("click", () => setActiveSlidePage(pageNumber));
    return button;
  }

  function renderMessages() {
    elements.messageList.innerHTML = "";

    state.messages.forEach((message) => {
      const row = document.createElement("article");
      row.className = `message-row ${message.role}`;

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      appendTextWithCitations(bubble, message.content);

      row.append(bubble);
      elements.messageList.append(row);
    });

    if (state.isSending) {
      const pending = document.createElement("div");
      pending.className = "empty-state";
      pending.textContent = "正在生成回复...";
      elements.messageList.append(pending);
    }

    elements.messageList.scrollTop = elements.messageList.scrollHeight;
  }

  function mockSendChatMessage(messages, courseId, currentNote) {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const noteHint = currentNote.trim()
      ? "我也参考了你右侧笔记里的当前内容。"
      : "右侧笔记目前还没有额外上下文。";

    return new Promise((resolve) => {
      window.setTimeout(() => {
        resolve({
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `你问的是：“${
            latestUserMessage ? latestUserMessage.content : "这个问题"
          }”。${noteHint}\n\n可以先看课件中对核心概念的定义 [引用第5页]，再对照后面的例子整理成自己的话 [引用第12页]。`,
        });
      }, 900);
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
    window.history.replaceState(
      {},
      "",
      `/course/${encodeURIComponent(state.currentCourseId)}`,
    );
    await initNotes();
    await loadCurrentCourse();
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

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    state.messages.push(userMessage);
    state.isSending = true;
    elements.chatInput.value = "";
    resizeChatInput();
    elements.chatSubmit.disabled = true;
    renderMessages();

    try {
      const assistantMessage = await mockSendChatMessage(
        state.messages,
        state.currentCourseId,
        state.noteContent,
      );
      state.messages.push(assistantMessage);
    } finally {
      state.isSending = false;
      elements.chatSubmit.disabled = false;
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
    elements.noteEditor.addEventListener("input", handleNoteInput);
    elements.courseSelect.addEventListener("change", handleCourseChange);
    await fetchCourseIndex();
    renderCourseSelect();
    await initNotes();
    await loadCurrentCourse();
  }

  init();
})();
