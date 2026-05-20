(function () {
  const citationPattern = /\[(?:引用)?第(\d+)页\]/g;
  const staticManifest = window.COURSE_SLIDES_MANIFEST || {
    aliases: {},
    courses: [],
  };

  const state = {
    currentCourseId: getInitialCourseId(),
    activeSlidePage: 1,
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
  };

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

    state.courseIndex.courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title;
      elements.courseSelect.append(option);
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
    setActiveSlidePage(state.activeSlidePage);
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

  function mockSaveUserNote(courseId, content) {
    void courseId;
    void content;

    return new Promise((resolve) => {
      window.setTimeout(() => {
        resolve({ success: true, savedAt: new Date().toISOString() });
      }, 700);
    });
  }

  async function handleCourseChange(event) {
    state.currentCourseId = event.target.value;
    state.activeSlidePage = 1;
    window.history.replaceState(
      {},
      "",
      `/course/${encodeURIComponent(state.currentCourseId)}`,
    );
    initNotes();
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

  function handleNoteInput(event) {
    state.noteContent = event.target.value;
    window.localStorage.setItem(getStorageKey(), state.noteContent);
    updateSaveState("未保存", false);

    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
    }

    state.saveTimer = window.setTimeout(async () => {
      updateSaveState("保存中", false);

      try {
        await mockSaveUserNote(state.currentCourseId, state.noteContent);
        console.log("笔记已保存");
        updateSaveState("已保存", false);
      } catch (error) {
        console.error(error);
        updateSaveState("保存失败", true);
      }
    }, 2000);
  }

  function initNotes() {
    state.noteContent = window.localStorage.getItem(getStorageKey()) || "";
    elements.noteEditor.value = state.noteContent;
    updateSaveState("未保存", false);
  }

  async function init() {
    initNotes();
    renderMessages();
    resizeChatInput();
    elements.chatForm.addEventListener("submit", handleChatSubmit);
    elements.chatInput.addEventListener("input", handleChatInput);
    elements.chatInput.addEventListener("keydown", handleChatKeydown);
    elements.noteEditor.addEventListener("input", handleNoteInput);
    elements.courseSelect.addEventListener("change", handleCourseChange);
    await fetchCourseIndex();
    renderCourseSelect();
    await loadCurrentCourse();
  }

  init();
})();
