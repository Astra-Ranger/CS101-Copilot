// Digital human lecture generation, history, playback, and slide sync.
const DIGITAL_HUMAN_FINAL_STATUSES = new Set(["ready", "failed"]);
const DIGITAL_HUMAN_ACTIVE_STATUSES = new Set([
  "queued",
  "scripting",
  "submitted",
  "rendering",
  "downloading",
]);

function digitalHumanStatusLabel(status) {
  const labels = {
    queued: "排队中",
    scripting: "生成讲解稿",
    submitted: "提交数字人",
    rendering: "视频合成中",
    downloading: "保存到本地",
    ready: "已完成",
    failed: "生成失败",
  };
  return labels[status] || status || "等待中";
}

function upsertDigitalHumanLecture(lecture) {
  if (!lecture || !lecture.id) {
    return;
  }

  const index = state.digitalHuman.lectures.findIndex((item) => item.id === lecture.id);
  if (index >= 0) {
    state.digitalHuman.lectures[index] = lecture;
  } else {
    state.digitalHuman.lectures.unshift(lecture);
  }

  state.digitalHuman.lectures.sort((left, right) =>
    String(right.updatedAt || right.createdAt || "").localeCompare(
      String(left.updatedAt || left.createdAt || ""),
    ),
  );
}

function visibleDigitalHumanLectures() {
  return state.digitalHuman.lectures.filter((lecture) => lecture.status !== "failed");
}

function getActiveDigitalHumanLecture() {
  const visibleLectures = visibleDigitalHumanLectures();
  return (
    visibleLectures.find(
      (lecture) => lecture.id === state.digitalHuman.activeLectureId,
    ) ||
    visibleLectures[0] ||
    null
  );
}

async function loadDigitalHumanLectures() {
  try {
    const data = await fetchDigitalHumanLectures();
    state.digitalHuman.lectures = Array.isArray(data.lectures) ? data.lectures : [];
    const currentActive = getActiveDigitalHumanLecture();
    state.digitalHuman.activeLectureId = currentActive ? currentActive.id : null;
    const activePending = state.digitalHuman.lectures.find((lecture) =>
      DIGITAL_HUMAN_ACTIVE_STATUSES.has(lecture.status),
    );
    if (activePending) {
      startDigitalHumanPoll(activePending.id);
    }
  } catch (error) {
    console.warn("读取数字人讲解历史失败。", error);
    state.digitalHuman.lectures = [];
  }
}

function handleDigitalHumanClick() {
  state.digitalHuman.isOpen = !state.digitalHuman.isOpen;
  if (state.digitalHuman.isOpen) {
    state.isHistoryOpen = false;
    state.quiz.isOpen = false;
    state.highlights.isOpen = false;
    state.mindmap.isOpen = false;
    void loadDigitalHumanLectures().then(renderDigitalHumanMenu);
  }
  renderHistoryMenu();
  renderQuizMenu();
  renderHighlightMenu();
  renderMindmapMenu();
  renderDigitalHumanMenu();
}

function renderDigitalHumanMenu() {
  if (!elements.digitalHumanMenu || !elements.digitalHumanButton) {
    return;
  }

  elements.digitalHumanMenu.innerHTML = "";
  elements.digitalHumanMenu.hidden = !state.digitalHuman.isOpen;
  elements.digitalHumanButton.classList.toggle("is-active", state.digitalHuman.isOpen);

  if (!state.digitalHuman.isOpen) {
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "chat-history-dialog digital-human-dialog";

  const header = document.createElement("div");
  header.className = "chat-history-dialog-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "quiz-title-wrap";

  const title = document.createElement("div");
  title.className = "chat-history-dialog-title";
  title.textContent = "数字人讲解";

  const subtitle = document.createElement("span");
  subtitle.className = "quiz-subtitle";
  subtitle.textContent = state.currentDeck ? state.currentDeck.title : "当前课程";

  titleWrap.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-history-close";
  closeButton.setAttribute("aria-label", "关闭数字人讲解");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    state.digitalHuman.isOpen = false;
    renderDigitalHumanMenu();
  });

  header.append(titleWrap, closeButton);
  dialog.append(header);
  dialog.append(renderDigitalHumanControls());

  if (state.digitalHuman.error) {
    const error = document.createElement("div");
    error.className = "quiz-error";
    error.textContent = state.digitalHuman.error;
    dialog.append(error);
  }

  const activeLecture = getActiveDigitalHumanLecture();
  if (activeLecture) {
    dialog.append(renderDigitalHumanLecture(activeLecture));
  } else {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "选择讲解范围和时长后生成数字人视频。";
    dialog.append(empty);
  }

  dialog.append(renderDigitalHumanHistory());
  elements.digitalHumanMenu.append(dialog);
}

function renderDigitalHumanControls() {
  const panel = document.createElement("div");
  panel.className = "digital-human-controls";

  const modeGroup = document.createElement("div");
  modeGroup.className = "settings-mode-toggle digital-human-mode-toggle";
  modeGroup.setAttribute("role", "group");
  modeGroup.setAttribute("aria-label", "讲解模式");

  [
    ["lesson", "本节课"],
    ["topic", "知识点"],
  ].forEach(([mode, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.classList.toggle("active", state.digitalHuman.mode === mode);
    button.addEventListener("click", () => {
      state.digitalHuman.mode = mode;
      state.digitalHuman.error = "";
      renderDigitalHumanMenu();
    });
    modeGroup.append(button);
  });

  const durationLabel = document.createElement("label");
  durationLabel.className = "quiz-count-field";
  durationLabel.textContent = "时长";

  const durationSelect = document.createElement("select");
  [1, 2, 3, 4, 5].forEach((duration) => {
    const option = document.createElement("option");
    option.value = String(duration);
    option.textContent = `${duration} 分钟`;
    option.selected = state.digitalHuman.durationMinutes === duration;
    durationSelect.append(option);
  });
  durationSelect.addEventListener("change", () => {
    state.digitalHuman.durationMinutes = Number(durationSelect.value) || 1;
  });
  durationLabel.append(durationSelect);

  const topicInput = document.createElement("input");
  topicInput.className = "digital-human-topic-input";
  topicInput.type = "text";
  topicInput.placeholder = "输入知识点";
  topicInput.value = state.digitalHuman.topic;
  topicInput.hidden = state.digitalHuman.mode !== "topic";
  topicInput.addEventListener("input", () => {
    state.digitalHuman.topic = topicInput.value;
  });

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "quiz-generate-button";
  generateButton.disabled = state.digitalHuman.isGenerating;
  generateButton.textContent = state.digitalHuman.isGenerating ? "生成中..." : "生成视频";
  generateButton.addEventListener("click", () => {
    void handleGenerateDigitalHumanClick();
  });

  panel.append(modeGroup, durationLabel, topicInput, generateButton);
  return panel;
}

function renderDigitalHumanLecture(lecture) {
  const section = document.createElement("section");
  section.className = "digital-human-active";

  const status = document.createElement("div");
  status.className = `digital-human-status ${lecture.status || ""}`;
  status.textContent = digitalHumanStatusLabel(lecture.status);
  section.append(status);

  if (lecture.status === "failed") {
    const error = document.createElement("div");
    error.className = "quiz-error";
    error.textContent = lecture.errorMessage || "数字人视频生成失败。";
    section.append(error);
  }

  if (lecture.videoUrl && lecture.status === "ready") {
    const video = document.createElement("video");
    video.className = "digital-human-video";
    video.src = lecture.videoUrl;
    video.controls = true;
    video.playsInline = true;
    if (lecture.subtitleUrl) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "中文字幕";
      track.srclang = "zh";
      track.src = lecture.subtitleUrl;
      track.default = true;
      track.setAttribute("default", "");
      track.addEventListener("load", () => {
        if (track.track) {
          track.track.mode = "showing";
        }
        showDigitalHumanSubtitles(video);
      });
      video.append(track);
      video.addEventListener("loadedmetadata", () => {
        showDigitalHumanSubtitles(video);
      });
      window.setTimeout(() => showDigitalHumanSubtitles(video), 500);
    }
    video.addEventListener("timeupdate", () => {
      handleDigitalHumanVideoTimeUpdate(video, lecture);
    });
    video.addEventListener("seeked", () => {
      video.dataset.nextTriggerIndex = "0";
    });
    section.append(video);
  }

  return section;
}

function showDigitalHumanSubtitles(video) {
  Array.from(video.textTracks || []).forEach((textTrack) => {
    textTrack.mode = "showing";
  });
}

function renderDigitalHumanHistory() {
  const history = document.createElement("div");
  history.className = "digital-human-history";
  const lectures = visibleDigitalHumanLectures();

  const title = document.createElement("div");
  title.className = "chat-history-group-title";
  title.textContent = "讲解历史";
  history.append(title);

  if (!lectures.length) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "暂无讲解历史";
    history.append(empty);
    return history;
  }

  lectures.forEach((lecture) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "digital-human-history-item";
    item.classList.toggle("active", lecture.id === state.digitalHuman.activeLectureId);

    const name = document.createElement("span");
    name.className = "chat-history-title";
    name.textContent =
      lecture.mode === "topic"
        ? lecture.topic || "知识点讲解"
        : `${lecture.courseName || "当前课程"} 总结`;

    const meta = document.createElement("span");
    meta.className = "chat-history-meta";
    meta.textContent = `${lecture.durationMinutes || 1} 分钟 · ${digitalHumanStatusLabel(
      lecture.status,
    )} · ${formatConversationTime(lecture.updatedAt) || "刚刚"}`;

    item.append(name, meta);
    item.addEventListener("click", () => {
      void activateDigitalHumanLecture(lecture);
    });
    history.append(item);
  });

  return history;
}

async function activateDigitalHumanLecture(lecture) {
  state.digitalHuman.activeLectureId = lecture.id;
  state.digitalHuman.error = "";
  if (DIGITAL_HUMAN_ACTIVE_STATUSES.has(lecture.status)) {
    startDigitalHumanPoll(lecture.id);
  }

  const targetPage = Number(lecture.currentPage || firstDigitalHumanTriggerPage(lecture) || 1);
  await navigateToCitation(lecture.courseId || state.currentCourseId, targetPage);
  renderDigitalHumanMenu();
}

function firstDigitalHumanTriggerPage(lecture) {
  const triggers = Array.isArray(lecture.slideTriggers) ? lecture.slideTriggers : [];
  const firstTrigger = triggers.find((trigger) => Number(trigger.page) > 0);
  return firstTrigger ? firstTrigger.page : null;
}

async function handleGenerateDigitalHumanClick() {
  if (state.digitalHuman.isGenerating) {
    return;
  }

  const topic = state.digitalHuman.topic.trim();
  if (state.digitalHuman.mode === "topic" && !topic) {
    state.digitalHuman.error = "请输入知识点。";
    renderDigitalHumanMenu();
    return;
  }

  state.digitalHuman.isGenerating = true;
  state.digitalHuman.error = "";
  renderDigitalHumanMenu();

  try {
    const data = await createDigitalHumanLecture({
      courseId: state.currentCourseId,
      currentPage: getCurrentVisibleSlidePage(),
      mode: state.digitalHuman.mode,
      topic,
      durationMinutes: state.digitalHuman.durationMinutes,
      conversationId: state.activeConversationId,
    });
    const lecture = data.lecture;
    upsertDigitalHumanLecture(lecture);
    state.digitalHuman.activeLectureId = lecture.id;
    startDigitalHumanPoll(lecture.id);
  } catch (error) {
    console.error(error);
    state.digitalHuman.error = error.message || "数字人讲解生成失败。";
  } finally {
    state.digitalHuman.isGenerating = false;
    renderDigitalHumanMenu();
  }
}

function startDigitalHumanPoll(lectureId) {
  stopDigitalHumanPoll();
  state.digitalHuman.pollTimer = window.setInterval(() => {
    void pollDigitalHumanLecture(lectureId);
  }, 5000);
  void pollDigitalHumanLecture(lectureId);
}

function stopDigitalHumanPoll() {
  if (state.digitalHuman.pollTimer) {
    window.clearInterval(state.digitalHuman.pollTimer);
    state.digitalHuman.pollTimer = null;
  }
}

async function pollDigitalHumanLecture(lectureId) {
  try {
    const data = await fetchDigitalHumanLecture(lectureId);
    const lecture = data.lecture;
    if (lecture.status === "failed") {
      state.digitalHuman.lectures = state.digitalHuman.lectures.filter(
        (item) => item.id !== lectureId,
      );
      if (state.digitalHuman.activeLectureId === lectureId) {
        const nextLecture = visibleDigitalHumanLectures()[0] || null;
        state.digitalHuman.activeLectureId = nextLecture ? nextLecture.id : null;
        state.digitalHuman.error =
          lecture.errorMessage || "数字人讲解生成失败，失败日志已保留在服务端。";
      }
      stopDigitalHumanPoll();
      renderDigitalHumanMenu();
      return;
    }

    upsertDigitalHumanLecture(lecture);
    if (lecture.id === state.digitalHuman.activeLectureId) {
      renderDigitalHumanMenu();
    }
    if (DIGITAL_HUMAN_FINAL_STATUSES.has(lecture.status)) {
      stopDigitalHumanPoll();
    }
  } catch (error) {
    console.warn("轮询数字人讲解失败。", error);
    state.digitalHuman.lectures = state.digitalHuman.lectures.filter(
      (lecture) => lecture.id !== lectureId,
    );
    if (state.digitalHuman.activeLectureId === lectureId) {
      const nextLecture = visibleDigitalHumanLectures()[0] || null;
      state.digitalHuman.activeLectureId = nextLecture ? nextLecture.id : null;
      state.digitalHuman.error = "数字人讲解生成失败。";
    }
    stopDigitalHumanPoll();
    renderDigitalHumanMenu();
  }
}

function handleDigitalHumanVideoTimeUpdate(video, lecture) {
  const triggers = Array.isArray(lecture.slideTriggers)
    ? lecture.slideTriggers.slice().sort((left, right) => (left.timeMs || 0) - (right.timeMs || 0))
    : [];
  if (!triggers.length) {
    return;
  }

  const currentMs = Math.floor(video.currentTime * 1000);
  const lastMs = Number(video.dataset.lastTimeMs || "0");
  let nextIndex = Number(video.dataset.nextTriggerIndex || "0");

  if (currentMs < lastMs - 1000) {
    nextIndex = 0;
  }

  let target = null;
  while (nextIndex < triggers.length && currentMs >= Number(triggers[nextIndex].timeMs || 0)) {
    target = triggers[nextIndex];
    nextIndex += 1;
  }

  video.dataset.nextTriggerIndex = String(nextIndex);
  video.dataset.lastTimeMs = String(currentMs);

  if (target) {
    void navigateToCitation(target.courseId || state.currentCourseId, target.page);
  }
}
