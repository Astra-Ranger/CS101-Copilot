// HTTP, SSE-facing API helpers, and course index loading.
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

async function generateCourseQuestions(courseId, payload) {
  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/questions/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || "question generation api unavailable";
    throw new Error(message);
  }

  return data;
}

async function generateCourseHighlights(courseId, payload) {
  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/highlights/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || "highlight generation api unavailable";
    throw new Error(message);
  }

  return data;
}

async function generateCourseMindmap(courseId, payload) {
  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/mindmap/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || "mind map generation api unavailable";
    throw new Error(message);
  }

  return data;
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
