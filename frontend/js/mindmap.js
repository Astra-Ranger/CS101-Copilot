// Mind map rendering, interaction, and export helpers.
async function loadD3() {
  if (window.d3) {
    return window.d3;
  }

  if (d3LoadPromise) {
    return d3LoadPromise;
  }

  d3LoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = D3_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.d3) {
        resolve(window.d3);
        return;
      }
      reject(new Error("D3.js did not initialize."));
    };
    script.onerror = () => reject(new Error("D3.js 加载失败。"));
    document.head.append(script);
  });

  return d3LoadPromise;
}

async function renderMindmapCanvas(container) {
  if (!state.mindmap.root) {
    return;
  }

  let d3;
  try {
    d3 = await loadD3();
  } catch (error) {
    container.textContent = error.message || "D3.js 加载失败。";
    return;
  }

  if (!state.mindmap.isOpen || !container.isConnected) {
    return;
  }

  container.innerHTML = "";
  const visibleRoot = buildVisibleMindmapNode(state.mindmap.root);
  const root = d3.hierarchy(visibleRoot);
  d3.tree().nodeSize([78, 190])(root);

  const nodes = root.descendants();
  const links = root.links();
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const viewWidth = Math.max(560, maxY - minY + 320);
  const viewHeight = Math.max(280, maxX - minX + 140);
  const offsetX = minY - 110;
  const offsetY = minX - 70;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "mindmap-svg")
    .attr("viewBox", `${offsetX} ${offsetY} ${viewWidth} ${viewHeight}`)
    .attr("data-base-width", viewWidth)
    .attr("data-base-height", viewHeight)
    .attr("width", viewWidth * state.mindmap.zoom)
    .attr("height", viewHeight * state.mindmap.zoom)
    .attr("role", "img")
    .attr("aria-label", "课程思维导图");

  svg
    .append("g")
    .attr("class", "mindmap-links")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr(
      "d",
      (link) => {
        const sourceX = link.source.y + mindmapNodeWidth(link.source.data.title) + 34;
        const targetX = link.target.y - 8;
        const midX = sourceX + (targetX - sourceX) / 2;
        return `M${sourceX},${link.source.x}H${midX}V${link.target.x}H${targetX}`;
      },
    );

  const node = svg
    .append("g")
    .attr("class", "mindmap-nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "mindmap-node")
    .attr("transform", (item) => `translate(${item.y},${item.x})`);

  const toggle = node
    .filter((item) => item.data._hasChildren)
    .append("g")
    .attr("class", "mindmap-toggle")
    .attr(
      "transform",
      (item) => `translate(${mindmapNodeWidth(item.data.title) + 20},0)`,
    )
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", "展开或折叠知识点")
    .on("click", (event, item) => {
      event.stopPropagation();
      toggleMindmapNode(item.data);
    })
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      toggleMindmapNode(item.data);
    });

  toggle.append("circle").attr("r", 11);
  toggle
    .append("path")
    .attr("d", (item) =>
      state.mindmap.collapsed[item.data.id]
        ? "M -4.5 -6 L 5 0 L -4.5 6 Z"
        : "M -6 -4.5 L 0 5 L 6 -4.5 Z",
    );

  const titleGroup = node
    .append("g")
    .attr("class", "mindmap-title-hit")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", "向 AI 提问这个知识点")
    .on("click", (_event, item) => {
      askMindmapNode(item.data);
    })
    .on("keydown", (event, item) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      askMindmapNode(item.data);
    });

  titleGroup
    .append("rect")
    .attr("x", -4)
    .attr("y", -18)
    .attr("width", (item) => mindmapNodeWidth(item.data.title))
    .attr("height", 36)
    .attr("rx", 8);

  titleGroup
    .append("text")
    .attr("x", 10)
    .attr("dy", "0.35em")
    .text((item) => truncateMindmapTitle(item.data.title));
}

function handleMindmapWheel(event) {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const direction = event.deltaY < 0 ? 1 : -1;
  zoomMindmap(
    state.mindmap.zoom + direction * MINDMAP_WHEEL_ZOOM_STEP,
    event.currentTarget,
    {
      clientX: event.clientX,
      clientY: event.clientY,
    },
  );
}

function handleMindmapPointerDown(event) {
  if (event.pointerType !== "touch") {
    return;
  }

  mindmapPointers.set(event.pointerId, event);
  event.currentTarget.setPointerCapture(event.pointerId);

  if (mindmapPointers.size === 2) {
    const [pointA, pointB] = [...mindmapPointers.values()];
    mindmapPinch = {
      distance: getDistance(pointA, pointB),
      zoom: state.mindmap.zoom,
    };
    event.currentTarget.classList.add("is-pinching");
  }
}

function handleMindmapPointerMove(event) {
  if (!mindmapPointers.has(event.pointerId)) {
    return;
  }

  mindmapPointers.set(event.pointerId, event);

  if (mindmapPointers.size !== 2 || !mindmapPinch) {
    return;
  }

  event.preventDefault();

  const [pointA, pointB] = [...mindmapPointers.values()];
  const distance = getDistance(pointA, pointB);

  if (!mindmapPinch.distance) {
    return;
  }

  zoomMindmap(
    mindmapPinch.zoom * (distance / mindmapPinch.distance),
    event.currentTarget,
    getMidpoint(pointA, pointB),
  );
}

function handleMindmapPointerEnd(event) {
  mindmapPointers.delete(event.pointerId);

  if (mindmapPointers.size < 2) {
    mindmapPinch = null;
    event.currentTarget.classList.remove("is-pinching");
  }
}

function zoomMindmap(nextZoom, container, anchorPoint) {
  if (!container) {
    return;
  }

  const previousZoom = state.mindmap.zoom;
  const zoom = clampMindmapZoom(nextZoom);
  if (Math.abs(zoom - previousZoom) < 0.001) {
    return;
  }

  const viewportRect = container.getBoundingClientRect();
  const anchor = anchorPoint || {
    clientX: viewportRect.left + viewportRect.width / 2,
    clientY: viewportRect.top + viewportRect.height / 2,
  };
  const anchorX = anchor.clientX - viewportRect.left;
  const anchorY = anchor.clientY - viewportRect.top;
  const contentX = container.scrollLeft + anchorX;
  const contentY = container.scrollTop + anchorY;
  const anchorRatioX = container.scrollWidth
    ? clampUnit(contentX / container.scrollWidth)
    : 0.5;
  const anchorRatioY = container.scrollHeight
    ? clampUnit(contentY / container.scrollHeight)
    : 0.5;
  const previousScrollBehavior = container.style.scrollBehavior;

  container.style.scrollBehavior = "auto";
  state.mindmap.zoom = zoom;
  applyMindmapZoom(container);
  container.scrollLeft = anchorRatioX * container.scrollWidth - anchorX;
  container.scrollTop = anchorRatioY * container.scrollHeight - anchorY;
  updateMindmapZoomControls();

  window.requestAnimationFrame(() => {
    container.style.scrollBehavior = previousScrollBehavior;
  });
}

function applyMindmapZoom(container) {
  const svg = container.querySelector(".mindmap-svg");
  if (!svg) {
    return;
  }

  const baseWidth = Number(svg.dataset.baseWidth) || 560;
  const baseHeight = Number(svg.dataset.baseHeight) || 320;
  svg.setAttribute("width", String(baseWidth * state.mindmap.zoom));
  svg.setAttribute("height", String(baseHeight * state.mindmap.zoom));
}

function updateMindmapZoomControls() {
  const resetButton = elements.mindmapMenu.querySelector(".mindmap-zoom-reset");
  if (resetButton) {
    resetButton.textContent = `${Math.round(state.mindmap.zoom * 100)}%`;
  }
}

async function exportMindmap(format) {
  const svg = elements.mindmapMenu.querySelector(".mindmap-svg");
  if (!svg) {
    return;
  }

  try {
    const raster = await rasterizeMindmapSvg(svg, 2);
    const filenameBase = mindmapExportFilename();

    if (format === "pdf") {
      const pdfBlob = await mindmapPdfBlob(raster.canvas);
      downloadBlob(pdfBlob, `${filenameBase}.pdf`);
      return;
    }

    raster.canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${filenameBase}.png`);
      }
    }, "image/png");
  } catch (error) {
    console.error(error);
    state.mindmap.error = error.message || "导出失败，请稍后再试。";
    renderMindmapMenu();
  }
}

function mindmapExportFilename() {
  const title = state.currentDeck ? state.currentDeck.title : "mindmap";
  return `${String(title || "mindmap").replace(/[\\/:*?"<>|]+/g, "-")}-mindmap`;
}

function cloneMindmapSvgForExport(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", svg.getAttribute("width") || "900");
  clone.setAttribute("height", svg.getAttribute("height") || "560");

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .mindmap-links path { fill: none; stroke: #cbd5e1; stroke-width: 1.8; stroke-linecap: square; stroke-linejoin: miter; }
    .mindmap-title-hit rect { fill: #fff; stroke: #bfdbfe; stroke-width: 1.2; }
    .mindmap-title-hit text { fill: #18181b; font: 800 12px sans-serif; }
    .mindmap-toggle circle { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1.2; }
    .mindmap-toggle path { fill: #2563eb; }
  `;
  clone.insertBefore(style, clone.firstChild);
  return clone;
}

function rasterizeMindmapSvg(svg, scale = 1) {
  return new Promise((resolve, reject) => {
    const clone = cloneMindmapSvgForExport(svg);
    const width = Math.max(1, Math.ceil(Number(clone.getAttribute("width")) || 900));
    const height = Math.max(1, Math.ceil(Number(clone.getAttribute("height")) || 560));
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ canvas, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法渲染思维导图。"));
    };
    image.src = url;
  });
}

async function mindmapPdfBlob(canvas) {
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const imageBytes = dataUrlToBytes(jpegDataUrl);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 32;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const imageRatio = canvas.width / canvas.height;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / imageRatio;

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * imageRatio;
  }

  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = (pageHeight - drawHeight) / 2;
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im1 Do\nQ\n`;

  return buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
    {
      header: `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>`,
      stream: imageBytes,
    },
    {
      header: `<< /Length ${new TextEncoder().encode(content).length} >>`,
      stream: new TextEncoder().encode(content),
    },
  ]);
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildPdf(objects) {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode("%PDF-1.4\n")];
  const offsets = [];
  let length = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const objectNumber = index + 1;
    if (typeof object === "string") {
      const chunk = encoder.encode(`${objectNumber} 0 obj\n${object}\nendobj\n`);
      chunks.push(chunk);
      length += chunk.length;
      return;
    }

    const header = encoder.encode(`${objectNumber} 0 obj\n${object.header}\nstream\n`);
    const footer = encoder.encode("\nendstream\nendobj\n");
    chunks.push(header, object.stream, footer);
    length += header.length + object.stream.length + footer.length;
  });

  const xrefOffset = length;
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ];
  chunks.push(encoder.encode(`${xrefLines.join("\n")}\n`));
  return new Blob(chunks, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildVisibleMindmapNode(node) {
  const children = Array.isArray(node.children) ? node.children : [];
  const collapsed = Boolean(state.mindmap.collapsed[node.id]);

  return {
    ...node,
    _hasChildren: children.length > 0,
    children: collapsed ? [] : children.map(buildVisibleMindmapNode),
  };
}

function mindmapNodeWidth(title) {
  return Math.min(178, Math.max(76, String(title || "").length * 13 + 24));
}

function truncateMindmapTitle(title) {
  const value = String(title || "");
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

function toggleMindmapNode(node) {
  if (!node || !node.id) {
    return;
  }

  state.mindmap.collapsed[node.id] = !state.mindmap.collapsed[node.id];
  renderMindmapMenu();
}

function askMindmapNode(node) {
  if (!node || !node.title) {
    return;
  }

  const citations = Array.isArray(node.citations)
    ? node.citations.map((citation) => citation.label || `P${citation.pageNumber}`).join("、")
    : "";
  const prompt = [
    `请围绕思维导图中的“${node.title}”讲解。`,
    node.summary ? `我看到的摘要：${node.summary}` : "",
    citations ? `相关课件位置：${citations}` : "",
    "请结合当前课程资料，说明它的含义、和上下级知识点的关系，以及我应该如何复习。",
  ]
    .filter(Boolean)
    .join("\n");

  state.mindmap.isOpen = false;
  renderMindmapMenu();
  elements.chatInput.value = prompt;
  resizeChatInput();
  elements.chatInput.focus();
  elements.chatForm.requestSubmit();
}
