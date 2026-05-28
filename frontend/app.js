(function () {
  const citationPattern = /【([^】]+)】/g;
  const staticManifest = window.COURSE_SLIDES_MANIFEST || {
    aliases: {},
    courses: [],
  };
  const NOTE_AUTOCOMPLETE_KEY = "cs101-note-autocomplete-enabled";
  const NOTE_AUTOCOMPLETE_DELAY_MS = 500;

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
    activeNotebookId: null,
    activeNotebook: null,
    notebooks: [],
    isNotebookModalOpen: false,
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
    noteRenderFrame: null,
    isComposingNote: false,
    hasUnsavedNote: false,
    noteAutocompleteEnabled: readNoteAutocompleteEnabled(),
    noteAutocompleteSuggestion: "",
    noteAutocompleteTimer: null,
    noteAutocompleteAbortController: null,
    noteAutocompleteRequestId: 0,
    noteAutocompleteFingerprint: "",
    noteAutocompleteSelectionRange: null,
    isSettingsOpen: false,
    answerMode: "friendly",
    localApiOverride: {
      baseUrl: "",
      chatPath: "",
      model: "",
      enableThinking: false,
    },
    autocompleteApiOverride: {
      baseUrl: "",
      chatPath: "",
      model: "",
      enableThinking: false,
    },
    settingsKeyState: {
      localApiOverrideSet: false,
      localApiKeySet: false,
      autocompleteApiOverrideSet: false,
      autocompleteApiKeySet: false,
    },
    settingsSaveState: "",
    settingsSaveError: false,
    isSavingSettings: false,
  };

  const elements = {
    slideTitle: document.querySelector("#slide-title"),
    slideCount: document.querySelector("#slide-count"),
    slideList: document.querySelector("#slide-list"),
    courseSelect: document.querySelector("#course-select"),
    appSettingsButton: document.querySelector("#app-settings-button"),
    appSettingsPanel: document.querySelector("#app-settings-panel"),
    appSettingsClose: document.querySelector("#app-settings-close"),
    settingsSaveButton: document.querySelector("#settings-save-button"),
    settingsSaveState: document.querySelector("#settings-save-state"),
    localBaseUrlInput: document.querySelector("#local-base-url-input"),
    localChatPathInput: document.querySelector("#local-chat-path-input"),
    localModelInput: document.querySelector("#local-model-input"),
    localEnableThinkingInput: document.querySelector("#local-enable-thinking-input"),
    localApiKeyInput: document.querySelector("#local-api-key-input"),
    autocompleteBaseUrlInput: document.querySelector("#autocomplete-base-url-input"),
    autocompleteChatPathInput: document.querySelector("#autocomplete-chat-path-input"),
    autocompleteModelInput: document.querySelector("#autocomplete-model-input"),
    autocompleteEnableThinkingInput: document.querySelector("#autocomplete-enable-thinking-input"),
    autocompleteApiKeyInput: document.querySelector("#autocomplete-api-key-input"),
    localApiOverrideStatus: document.querySelector("#local-api-override-status"),
    autocompleteApiOverrideStatus: document.querySelector("#autocomplete-api-override-status"),
    messageList: document.querySelector("#message-list"),
    chatForm: document.querySelector("#chat-form"),
    chatInput: document.querySelector("#chat-input"),
    chatSubmit: document.querySelector("#chat-submit"),
    newChatButton: document.querySelector("#new-chat-button"),
    chatHistoryButton: document.querySelector("#chat-history-button"),
    chatHistoryMenu: document.querySelector("#chat-history-menu"),
    notebookTitle: document.querySelector("#notebook-title"),
    noteSurface: document.querySelector(".note-surface"),
    noteEditor: document.querySelector("#note-editor"),
    noteAutocompleteToggle: document.querySelector("#note-autocomplete-toggle"),
    noteAutocompleteGhost: document.querySelector("#note-autocomplete-ghost"),
    notebookMenu: document.querySelector("#notebook-menu"),
    newNotebookButton: document.querySelector("#new-notebook-button"),
    notebookListButton: document.querySelector("#notebook-list-button"),
    exportNotebookButton: document.querySelector("#export-notebook-button"),
    formulaButton: document.querySelector("#formula-button"),
    formulaModal: document.querySelector("#formula-modal"),
    formulaInput: document.querySelector("#formula-input"),
    formulaConfirmButton: document.querySelector("#formula-confirm-button"),
    formulaCancelButton: document.querySelector("#formula-cancel-button"),
    formulaCancelIcon: document.querySelector("#formula-cancel-icon"),
    saveState: document.querySelector("#save-state"),
  };

  const slidePointers = new Map();
  const MIN_SLIDE_ZOOM = 1;
  const MAX_SLIDE_ZOOM = 2.6;
  const SLIDE_WHEEL_ZOOM_STEP = 0.08;
  const STATUS_MIN_VISIBLE_MS = 500;
  const LAST_NOTEBOOK_KEY = "cs101-last-notebook-id";
  const MATHJAX_CDN_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
  const MATHJAX_LOCAL_URL = "/vendor/mathjax/tex-mml-chtml.js";
  let mathTypesetInFlight = false;
  let mathTypesetScheduled = false;
  let mathJaxLoadPromise = null;
  const mathTypesetRoots = new Set();
  const streamingViews = new Map();

  function readNoteAutocompleteEnabled() {
    return window.localStorage.getItem(NOTE_AUTOCOMPLETE_KEY) !== "false";
  }

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

  async function fetchSettings() {
    const response = await fetch("/api/settings", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("settings api unavailable");
    }

    return response.json();
  }

  async function saveSettings(payload) {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("settings save api unavailable");
    }

    return response.json();
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

  function applySettings(settings) {
    state.answerMode = settings.answerMode === "serious" ? "serious" : "friendly";
    state.localApiOverride = {
      baseUrl: typeof settings.localBaseUrl === "string" ? settings.localBaseUrl : "",
      chatPath: typeof settings.localChatPath === "string" ? settings.localChatPath : "",
      model: typeof settings.localModel === "string" ? settings.localModel : "",
      enableThinking: Boolean(settings.localEnableThinking),
    };
    state.autocompleteApiOverride = {
      baseUrl: typeof settings.autocompleteBaseUrl === "string"
        ? settings.autocompleteBaseUrl
        : "",
      chatPath: typeof settings.autocompleteChatPath === "string"
        ? settings.autocompleteChatPath
        : "",
      model: typeof settings.autocompleteModel === "string" ? settings.autocompleteModel : "",
      enableThinking: Boolean(settings.autocompleteEnableThinking),
    };
    state.settingsKeyState = {
      localApiOverrideSet: Boolean(settings.localApiOverrideSet),
      localApiKeySet: Boolean(settings.localApiKeySet),
      autocompleteApiOverrideSet: Boolean(settings.autocompleteApiOverrideSet),
      autocompleteApiKeySet: Boolean(settings.autocompleteApiKeySet),
    };

    if (elements.localBaseUrlInput) {
      elements.localBaseUrlInput.value = state.localApiOverride.baseUrl;
    }

    if (elements.localChatPathInput) {
      elements.localChatPathInput.value = state.localApiOverride.chatPath;
    }

    if (elements.localModelInput) {
      elements.localModelInput.value = state.localApiOverride.model;
    }

    if (elements.localEnableThinkingInput) {
      elements.localEnableThinkingInput.checked = state.localApiOverride.enableThinking;
    }

    if (elements.autocompleteBaseUrlInput) {
      elements.autocompleteBaseUrlInput.value = state.autocompleteApiOverride.baseUrl;
    }

    if (elements.autocompleteChatPathInput) {
      elements.autocompleteChatPathInput.value = state.autocompleteApiOverride.chatPath;
    }

    if (elements.autocompleteModelInput) {
      elements.autocompleteModelInput.value = state.autocompleteApiOverride.model;
    }

    if (elements.autocompleteEnableThinkingInput) {
      elements.autocompleteEnableThinkingInput.checked = state.autocompleteApiOverride.enableThinking;
    }

    renderSettingsPanel();
  }

  function renderSettingsPanel() {
    if (!elements.appSettingsPanel) {
      return;
    }

    elements.appSettingsPanel.hidden = !state.isSettingsOpen;

    if (elements.localApiOverrideStatus) {
      if (state.settingsKeyState.localApiOverrideSet && state.settingsKeyState.localApiKeySet) {
        elements.localApiOverrideStatus.textContent = "已替代";
      } else if (state.settingsKeyState.localApiOverrideSet) {
        elements.localApiOverrideStatus.textContent = "缺少 key";
      } else {
        elements.localApiOverrideStatus.textContent = "使用默认";
      }
    }

    if (elements.autocompleteApiOverrideStatus) {
      if (
        state.settingsKeyState.autocompleteApiOverrideSet
        && state.settingsKeyState.autocompleteApiKeySet
      ) {
        elements.autocompleteApiOverrideStatus.textContent = "已替代";
      } else if (state.settingsKeyState.autocompleteApiOverrideSet) {
        elements.autocompleteApiOverrideStatus.textContent = "缺少 key";
      } else {
        elements.autocompleteApiOverrideStatus.textContent = "使用默认";
      }
    }

    document.querySelectorAll("[data-answer-mode]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.answerMode === state.answerMode,
      );
    });

    if (elements.settingsSaveState) {
      elements.settingsSaveState.textContent = state.settingsSaveState;
      elements.settingsSaveState.classList.toggle("error", state.settingsSaveError);
    }

    if (elements.settingsSaveButton) {
      elements.settingsSaveButton.disabled = state.isSavingSettings;
    }
  }

  async function initSettings() {
    try {
      applySettings(await fetchSettings());
    } catch (error) {
      console.warn("读取设置失败。", error);
      renderSettingsPanel();
    }
  }

  function openSettingsPanel() {
    state.isSettingsOpen = true;
    state.settingsSaveState = "";
    state.settingsSaveError = false;
    renderSettingsPanel();
  }

  function closeSettingsPanel() {
    state.isSettingsOpen = false;
    renderSettingsPanel();
  }

  function handleSettingsButtonClick() {
    if (state.isSettingsOpen) {
      closeSettingsPanel();
      return;
    }

    openSettingsPanel();
  }

  function handleAnswerModeClick(event) {
    const mode = event.currentTarget.dataset.answerMode;

    if (mode !== "friendly" && mode !== "serious") {
      return;
    }

    state.answerMode = mode;
    state.settingsSaveState = "";
    state.settingsSaveError = false;
    renderSettingsPanel();
  }

  async function handleSettingsSaveClick() {
    state.isSavingSettings = true;
    state.settingsSaveState = "保存中";
    state.settingsSaveError = false;
    renderSettingsPanel();

    try {
      const nextSettings = await saveSettings({
        answerMode: state.answerMode,
        localBaseUrl: elements.localBaseUrlInput.value,
        localChatPath: elements.localChatPathInput.value,
        localModel: elements.localModelInput.value,
        localEnableThinking: elements.localEnableThinkingInput.checked,
        localApiKey: elements.localApiKeyInput.value,
        autocompleteBaseUrl: elements.autocompleteBaseUrlInput.value,
        autocompleteChatPath: elements.autocompleteChatPathInput.value,
        autocompleteModel: elements.autocompleteModelInput.value,
        autocompleteEnableThinking: elements.autocompleteEnableThinkingInput.checked,
        autocompleteApiKey: elements.autocompleteApiKeyInput.value,
      });

      elements.localApiKeyInput.value = "";
      elements.autocompleteApiKeyInput.value = "";
      applySettings(nextSettings);
      state.settingsSaveState = "已保存";
      state.settingsSaveError = false;
    } catch (error) {
      console.error(error);
      state.settingsSaveState = "保存失败";
      state.settingsSaveError = true;
    } finally {
      state.isSavingSettings = false;
      renderSettingsPanel();
    }
  }

  function setActiveSlidePage(pageNumber) {
    const normalizedPage = clampSlidePage(pageNumber);
    if (normalizedPage !== state.activeSlidePage) {
      clearNoteAutocomplete({
        abortRequest: true,
        resetFingerprint: true,
      });
    }
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

  function appendMarkdown(container, markdown, citationDisplayMap, options = {}) {
    container.classList.add("message-markdown");

    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let index = 0;
    const headingOffset = Number.isInteger(options.headingOffset)
      ? options.headingOffset
      : 2;
    const preserveBlankLines = Boolean(options.preserveBlankLines);
    const inlineOptions = {
      disableCitations: Boolean(options.disableCitations),
    };

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        if (preserveBlankLines) {
          const blank = document.createElement("p");
          blank.className = "markdown-blank-line";
          blank.append(document.createElement("br"));
          container.append(blank);
        }

        index += 1;
        continue;
      }

      const fenceMatch = line.match(/^```(.*)$/);
      if (fenceMatch) {
        const codeLines = [];
        index += 1;

        while (index < lines.length && !lines[index].startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }

        if (index < lines.length) {
          index += 1;
        }

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        const language = fenceMatch[1].trim();

        if (language) {
          code.className = `language-${language.replace(/[^\w-]/g, "")}`;
        }

        code.textContent = codeLines.join("\n");
        pre.append(code);
        container.append(pre);
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const headingLevel = Math.min(6, Math.max(1, headingMatch[1].length + headingOffset));
        const heading = document.createElement(`h${headingLevel}`);
        appendInlineMarkdown(heading, headingMatch[2].trim(), citationDisplayMap, inlineOptions);
        container.append(heading);
        index += 1;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        container.append(document.createElement("hr"));
        index += 1;
        continue;
      }

      if (isTableStart(lines, index)) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");
        const headerRow = document.createElement("tr");

        splitTableRow(lines[index]).forEach((cell) => {
          const th = document.createElement("th");
          appendInlineMarkdown(th, cell, citationDisplayMap, inlineOptions);
          headerRow.append(th);
        });

        thead.append(headerRow);
        table.append(thead);
        index += 2;

        while (index < lines.length && isTableRow(lines[index])) {
          const row = document.createElement("tr");
          splitTableRow(lines[index]).forEach((cell) => {
            const td = document.createElement("td");
            appendInlineMarkdown(td, cell, citationDisplayMap, inlineOptions);
            row.append(td);
          });
          tbody.append(row);
          index += 1;
        }

        table.append(tbody);
        container.append(table);
        continue;
      }

      if (/^>\s?/.test(line)) {
        const blockquote = document.createElement("blockquote");
        const quoteLines = [];

        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }

        appendInlineMarkdown(blockquote, quoteLines.join("\n"), citationDisplayMap, inlineOptions);
        container.append(blockquote);
        continue;
      }

      const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        const ordered = /\d/.test(listMatch[2]);
        const list = document.createElement(ordered ? "ol" : "ul");

        while (index < lines.length) {
          const itemMatch = lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);

          if (!itemMatch || /\d/.test(itemMatch[2]) !== ordered) {
            break;
          }

          const item = document.createElement("li");
          appendInlineMarkdown(item, itemMatch[3], citationDisplayMap, inlineOptions);
          list.append(item);
          index += 1;
        }

        container.append(list);
        continue;
      }

      const paragraphLines = [];

      while (
        index < lines.length &&
        lines[index].trim() &&
        !isMarkdownBlockStart(lines, index)
      ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }

      if (!paragraphLines.length) {
        paragraphLines.push(line);
        index += 1;
      }

      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join("\n"), citationDisplayMap, inlineOptions);
      container.append(paragraph);
    }
  }

  function isMarkdownBlockStart(lines, index) {
    const line = lines[index] || "";
    return (
      /^```/.test(line) ||
      /^(#{1,4})\s+/.test(line) ||
      /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
      /^>\s?/.test(line) ||
      /^(\s*)([-*+]|\d+[.)])\s+.+/.test(line) ||
      isTableStart(lines, index)
    );
  }

  function isTableStart(lines, index) {
    return isTableRow(lines[index]) && isTableDivider(lines[index + 1] || "");
  }

  function isTableRow(line) {
    return Boolean(line && line.includes("|") && line.trim().length > 1);
  }

  function isTableDivider(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function appendInlineMarkdown(container, text, citationDisplayMap, options = {}) {
    const source = String(text || "");
    const token = findNextInlineToken(source);

    if (!token) {
      appendPlainText(container, source);
      return;
    }

    appendPlainText(container, source.slice(0, token.index));

    if (token.type === "math") {
      appendPlainText(container, token.fullText);
    } else if (token.type === "citation") {
      if (options.disableCitations) {
        appendPlainText(container, token.fullText);
      } else {
        appendCitationToken(container, token.fullText, token.value, citationDisplayMap);
      }
    } else if (token.type === "code") {
      const code = document.createElement("code");
      code.textContent = token.value;
      container.append(code);
    } else if (token.type === "link") {
      const anchor = document.createElement("a");
      anchor.href = safeMarkdownHref(token.href);
      anchor.rel = "noreferrer";
      anchor.target = "_blank";
      appendInlineMarkdown(anchor, token.value, citationDisplayMap, options);
      container.append(anchor);
    } else {
      const element = document.createElement(token.type === "bold" ? "strong" : "em");
      appendInlineMarkdown(element, token.value, citationDisplayMap, options);
      container.append(element);
    }

    appendInlineMarkdown(
      container,
      source.slice(token.index + token.fullText.length),
      citationDisplayMap,
      options,
    );
  }

  function findNextInlineToken(text) {
    const patterns = [
      {
        type: "math",
        regex: /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+\$)/,
        build: () => ({}),
      },
      {
        type: "citation",
        regex: /【([^】]+)】/,
        build: (match) => ({ value: match[1] }),
      },
      {
        type: "code",
        regex: /`([^`\n]+)`/,
        build: (match) => ({ value: match[1] }),
      },
      {
        type: "link",
        regex: /\[([^\]\n]+)\]\(([^)\s]+)\)/,
        build: (match) => ({ value: match[1], href: match[2] }),
      },
      {
        type: "bold",
        regex: /\*\*([^*\n][\s\S]*?[^*\n])\*\*/,
        build: (match) => ({ value: match[1] }),
      },
      {
        type: "italic",
        regex: /\*([^*\n]+)\*/,
        build: (match) => ({ value: match[1] }),
      },
    ];

    return patterns.reduce((current, pattern) => {
      const match = pattern.regex.exec(text);

      if (!match) {
        return current;
      }

      if (current && match.index >= current.index) {
        return current;
      }

      return {
        type: pattern.type,
        fullText: match[0],
        index: match.index,
        ...pattern.build(match),
      };
    }, null);
  }

  function safeMarkdownHref(href) {
    const value = String(href || "").trim();

    if (/^(https?:|mailto:|#|\/)/i.test(value)) {
      return value;
    }

    return "#";
  }

  function appendCitationToken(container, fullText, rawLabel, citationDisplayMap) {
    const target = parseCitationTarget(rawLabel);

    if (!target) {
      appendPlainText(container, fullText);
      return;
    }

    const display = getCitationDisplay(citationDisplayMap, target, fullText);
    container.append(
      createCitationButton({
        label: fullText,
        displayNumber: display.number,
        courseId: target.courseId,
        pageNumber: target.page,
      }),
    );
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

    elements.messageList.scrollTop = elements.messageList.scrollHeight;
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
    elements.messageList.scrollTop = elements.messageList.scrollHeight;
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
    state.activeConversationId = null;
    state.isHistoryOpen = false;
    window.history.replaceState(
      {},
      "",
      `/course/${encodeURIComponent(state.currentCourseId)}`,
    );
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
    renderHistoryMenu();
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
    elements.noteEditor.addEventListener("input", handleNoteInput);
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
    await loadCurrentCourse();
    await loadLatestConversationForCurrentCourse();
  }

  init();
})();
