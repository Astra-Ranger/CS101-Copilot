// Markdown, inline citation parsing, and citation buttons.
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
