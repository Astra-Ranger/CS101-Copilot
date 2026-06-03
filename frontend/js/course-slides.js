// Course selector, settings panel, and slide navigation.
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

function clampMindmapZoom(value) {
  return Math.min(MAX_MINDMAP_ZOOM, Math.max(MIN_MINDMAP_ZOOM, value));
}

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
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

  const viewportRect = elements.slideList.getBoundingClientRect();
  const anchor = anchorPoint || {
    clientX: viewportRect.left + viewportRect.width / 2,
    clientY: viewportRect.top + viewportRect.height / 2,
  };
  const anchorX = anchor.clientX - viewportRect.left;
  const anchorY = anchor.clientY - viewportRect.top;
  const contentX = elements.slideList.scrollLeft + anchorX;
  const contentY = elements.slideList.scrollTop + anchorY;
  const anchorRatioX = elements.slideList.scrollWidth
    ? clampUnit(contentX / elements.slideList.scrollWidth)
    : 0.5;
  const anchorRatioY = elements.slideList.scrollHeight
    ? clampUnit(contentY / elements.slideList.scrollHeight)
    : 0.5;
  const previousScrollBehavior = elements.slideList.style.scrollBehavior;

  elements.slideList.style.scrollBehavior = "auto";
  state.slideZoom = zoom;
  applySlideZoom();

  elements.slideList.scrollLeft =
    anchorRatioX * elements.slideList.scrollWidth - anchorX;
  elements.slideList.scrollTop =
    anchorRatioY * elements.slideList.scrollHeight - anchorY;

  window.requestAnimationFrame(() => {
    elements.slideList.style.scrollBehavior = previousScrollBehavior;
  });
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
  event.stopPropagation();

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
