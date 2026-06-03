// Application state, DOM references, course manifest helpers.
const citationPattern = /【([^】]+)】/g;
const noteReferencePattern =
  /\[(?:\u5f15\u7528)?\u7b2c\s*(\d+)\s*\u9875\]|\[(?:PPT|ppt|Slide|slide|Page|page)\s*(\d+)\]/g;
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
  quiz: {
    isOpen: false,
    isGenerating: false,
    count: 5,
    questions: [],
    selectedAnswers: {},
    error: "",
  },
  highlights: {
    isOpen: false,
    isGenerating: false,
    count: 8,
    items: [],
    error: "",
  },
  mindmap: {
    isOpen: false,
    isGenerating: false,
    depth: 3,
    scope: "current",
    focus: "",
    root: null,
    collapsed: {},
    zoom: 1,
    error: "",
    d3Status: "",
  },
  isStartingConversation: false,
  starterStatus: "",
  isSending: false,
  chatStickToBottom: true,
  userPausedChatAutoScroll: false,
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
  quizButton: document.querySelector("#quiz-button"),
  quizMenu: document.querySelector("#quiz-menu"),
  highlightButton: document.querySelector("#highlight-button"),
  highlightMenu: document.querySelector("#highlight-menu"),
  mindmapButton: document.querySelector("#mindmap-button"),
  mindmapMenu: document.querySelector("#mindmap-menu"),
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
  noteReferenceList: document.querySelector("#note-reference-list"),
};

const slidePointers = new Map();
const mindmapPointers = new Map();
let mindmapPinch = null;
const MIN_SLIDE_ZOOM = 1;
const MAX_SLIDE_ZOOM = 2.6;
const SLIDE_WHEEL_ZOOM_STEP = 0.08;
const MIN_MINDMAP_ZOOM = 0.65;
const MAX_MINDMAP_ZOOM = 2.8;
const MINDMAP_WHEEL_ZOOM_STEP = 0.1;
const CHAT_BOTTOM_THRESHOLD = 72;
const STATUS_MIN_VISIBLE_MS = 500;
const LAST_NOTEBOOK_KEY = "cs101-last-notebook-id";
const MATHJAX_CDN_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
const MATHJAX_LOCAL_URL = "/vendor/mathjax/tex-mml-chtml.js";
const D3_CDN_URL = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js";
let mathTypesetInFlight = false;
let mathTypesetScheduled = false;
let mathJaxLoadPromise = null;
let d3LoadPromise = null;
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
