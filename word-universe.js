/* Read-only vocabulary maps.  No learning progress, account data or graph data
   is persisted here.  Relationship details are loaded by the selected tile. */
(() => {
  "use strict";

  const STATUS = Object.freeze({ new: "待新学", reinforce: "待强化", review: "待复习", mastered: "已掌握" });
  const TITLES = Object.freeze({ synonym: "近义词宇宙", spelling: "形近词宇宙" });
  const ROOT = new URL("./data/universes/", document.baseURI);
  const MAX_ZOOM = 14;
  const MIN_ZOOM = 0.8;

  function element(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function pointLineDistance(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
  }

  function create({ container, kind, originWord, onClose, scope, bundleVersion }) {
    if (!container || typeof onClose !== "function" || typeof scope !== "function") throw new TypeError("Invalid universe host");
    const abort = new AbortController();
    let destroyed = false, frame = 0, cameraFrame = 0, cameraTarget = null, departingFocus = null, activeRequest = 0;
    let currentKind = kind === "spelling" ? "spelling" : "synonym";
    let nodes = [], byId = new Map(), selectedId = null, selectedSense = "all", activeEdge = null, edges = [];
    let book = null, indexVersion = "", camera = { x: 0, y: 0, zoom: 1 };
    let spatial = { synonym: new Map(), spelling: new Map() };
    let edgeCache = new Map(), statusCache = new Map(), visibleTargets = [], visibleLines = [];
    let activePointer = new Map(), previousPointer = null, pinching = null, moved = false;
    const ui = {};

    // Static application-owned markup only. Vocabulary values are inserted via
    // textContent below, never interpreted as HTML.
    container.innerHTML = `
      <header class="universe-header">
        <div><p class="word-label">词汇探索</p><h1 data-u="title">近义词宇宙</h1></div>
        <button class="secondary-button universe-back" type="button" data-u="back">返回</button>
      </header>
      <div class="universe-kind" role="group" aria-label="选择词汇宇宙">
        <button type="button" data-kind="synonym">近义词</button><button type="button" data-kind="spelling">形近词</button>
      </div>
      <p class="universe-summary" data-u="summary" aria-live="polite"></p>
      <div class="universe-search-wrap">
        <label for="universeSearch">搜索单词</label>
        <input id="universeSearch" type="search" autocomplete="off" spellcheck="false" placeholder="输入英文单词定位" data-u="search" />
        <div class="universe-search-results" data-u="results" aria-label="搜索结果"></div>
      </div>
      <div class="universe-map-wrap">
        <div class="universe-map-controls" aria-label="星图控制">
          <button type="button" data-u="zoomOut" aria-label="缩小">−</button>
          <button type="button" data-u="zoomIn" aria-label="放大">＋</button>
          <button type="button" data-u="overview">全局总览</button>
        </div>
        <canvas class="universe-canvas" data-u="canvas" tabindex="0" aria-label="词汇星图。拖动或方向键移动，滚轮、双指或加减按钮缩放；可通过搜索和关系列表访问任意单词。"></canvas>
        <p class="universe-map-hint" data-u="hint">拖动探索 · 滚轮或双指缩放</p>
      </div>
      <p class="universe-loading" role="status" aria-live="polite" data-u="loading">正在加载词汇地图…</p>
      <p class="universe-legend" aria-label="星球形状说明">● 待新学 · ◆ 待强化 · ○ 待复习 · ◎ 已掌握 · 半环 部分掌握 · ◇ 混合阶段 · □ 词书外 · ⊗ 状态异常</p>
      <div class="universe-selection" data-u="selection" aria-live="polite">
        <p>搜索单词，或放大后选择星球以查看关系。</p>
      </div>
      <p class="universe-note" data-u="note"></p>
    `;
    container.querySelectorAll("[data-u]").forEach((item) => { ui[item.dataset.u] = item; });
    ui.canvas.dataset.cameraMoving = "false";
    const ctx = ui.canvas.getContext("2d");
    const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: abort.signal });
    const listenTemporary = (target, event, callback) => target.addEventListener(event, callback);
    const rootFor = (path) => new URL(path, ROOT);
    let resizeObserver;

    function updateMode() {
      ui.title.textContent = TITLES[currentKind];
      container.querySelectorAll("[data-kind]").forEach((button) => {
        const active = button.dataset.kind === currentKind;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      ui.note.textContent = currentKind === "synonym"
        ? "星球大小随已收录近义词数量变化，受资料覆盖限制；位置靠近不代表近义。资料不足的词按词条估算或放在外围占位。"
        : "星球大小随已收录形近词数量变化（每词最多展示 20 个）；按字母增删、替换和相邻换序计算，形近不代表含义相近。";
    }

    function refreshScope() {
      if (destroyed) return;
      book = scope();
      statusCache.clear();
      ui.summary.textContent = `${book.bookName} · 已掌握 ${book.mastered} / ${book.total} 个义项 · 词书外不计学习状态`;
      updateSelection();
      scheduleDraw();
    }

    function asPoint(node) {
      const position = node[currentKind === "synonym" ? "semantic" : "spelling"];
      return positionPoint(position);
    }

    function positionPoint(position) {
      const width = ui.canvas.clientWidth, height = ui.canvas.clientHeight;
      const unit = Math.min(width, height) / 3000 * camera.zoom;
      return { x: width / 2 + (position[0] - camera.x) * unit,
               y: height / 2 + (position[1] - camera.y) * unit };
    }

    function statusForNode(node) {
      if (statusCache.has(node.id)) return statusCache.get(node.id);
      const statuses = node.senses.map((sense) => book?.senseStatus(node.id, sense.id)).filter((value) => value !== null && value !== undefined);
      let result;
      if (!statuses.length) result = "outside";
      else if (statuses.some((status) => !Object.prototype.hasOwnProperty.call(STATUS, status))) result = "unknown";
      else {
        const mastered = statuses.filter((value) => value === "mastered").length;
        if (mastered === statuses.length) result = "mastered";
        else if (mastered > 0) result = "partial";
        else if (new Set(statuses).size > 1) result = "mixed";
        else if (statuses.includes("reinforce")) result = "reinforce";
        else if (statuses.includes("review")) result = "review";
        else result = "new";
      }
      statusCache.set(node.id, result);
      return result;
    }

    function scheduleDraw() {
      if (destroyed || frame || !ctx || document.hidden) return;
      frame = requestAnimationFrame(() => { frame = 0; draw(); });
    }

    function stopCamera() {
      const wasDeparting = Boolean(departingFocus);
      if (cameraFrame) cancelAnimationFrame(cameraFrame);
      cameraFrame = 0;
      cameraTarget = null;
      departingFocus = null;
      ui.canvas.dataset.cameraMoving = "false";
      if (wasDeparting) scheduleDraw();
    }

    function moveCamera(target, { duration = 280, departure = null } = {}) {
      stopCamera();
      departingFocus = departure;
      const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
      if (!ctx || document.hidden || reduceMotion() ||
          (camera.x === target.x && camera.y === target.y && camera.zoom === target.zoom)) {
        camera = target; departingFocus = null; scheduleDraw(); return;
      }
      const from = { ...camera };
      cameraTarget = target;
      ui.canvas.dataset.cameraMoving = "true";
      let started = null;
      const step = (now) => {
        if (destroyed) return;
        if (document.hidden || reduceMotion()) {
          camera = target; stopCamera(); scheduleDraw(); return;
        }
        started ??= now;
        const progress = Math.min(1, Math.max(0, (now - started) / duration));
        const eased = duration > 500 ? (1 - Math.cos(Math.PI * progress)) / 2 : 1 - (1 - progress) ** 3;
        camera = { x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased,
                   zoom: Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * eased) };
        scheduleDraw();
        if (progress < 1) cameraFrame = requestAnimationFrame(step);
        else stopCamera();
      };
      cameraFrame = requestAnimationFrame(step);
    }

    function drawPlanet(x, y, size, state, highlighted) {
      const colors = { mastered: "#78e4bd", partial: "#b0ddc9", reinforce: "#edb778", review: "#8fbef8", mixed: "#ddb7ef", new: "#95acc4", outside: "#a2b2c1", unknown: "#f0c6d4" };
      const color = colors[state] ?? colors.new;
      const previousAlpha = ctx.globalAlpha;
      ctx.globalAlpha *= state === "outside" ? 0.62 : 0.94;
      ctx.beginPath();
      if (state === "outside") {
        ctx.rect(x - size, y - size, size * 2, size * 2);
      } else if (state === "reinforce" || state === "mixed") {
        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
      } else ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (state === "outside" || state === "review" || state === "mixed") { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
      else ctx.fill();
      if (state === "mastered" && size > 2) {
        ctx.strokeStyle = "#e0fff2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, size + 2, 0, Math.PI * 2); ctx.stroke();
      }
      if (state === "unknown") {
        ctx.strokeStyle = "#182633"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - size / 2, y - size / 2); ctx.lineTo(x + size / 2, y + size / 2); ctx.moveTo(x + size / 2, y - size / 2); ctx.lineTo(x - size / 2, y + size / 2); ctx.stroke();
      }
      if (state === "partial" && size > 2) {
        ctx.strokeStyle = "#ebf6ee"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, size + 2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      }
      if (highlighted) {
        const glow = ctx.createRadialGradient(x - size / 3, y - size / 3, 0, x, y, size * 2.6);
        glow.addColorStop(0, "rgba(255,255,255,.75)"); glow.addColorStop(.35, "rgba(131,226,222,.3)"); glow.addColorStop(1, "rgba(80,180,210,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, size * 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = previousAlpha;
    }

    function relevantEdges() {
      return selectedSense === "all" || currentKind !== "synonym"
        ? edges : edges.filter((edge) => edge.sourceSense === selectedSense);
    }

    function visibleNodes(width, height) {
      const unit = Math.min(width, height) / 3000 * camera.zoom;
      const tile = (value) => Math.max(0, Math.min(7, Math.floor((value + 1500) / 375)));
      const margin = 30 / unit;
      const minX = tile(camera.x - width / (2 * unit) - margin), maxX = tile(camera.x + width / (2 * unit) + margin);
      const minY = tile(camera.y - height / (2 * unit) - margin), maxY = tile(camera.y + height / (2 * unit) + margin);
      const result = [];
      for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
        const group = spatial[currentKind].get(`${x}-${y}`);
        if (group) result.push(...group.nodes);
      }
      return result;
    }

    function draw() {
      if (!ctx) return;
      const width = ui.canvas.clientWidth, height = ui.canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (ui.canvas.width !== Math.round(width * ratio) || ui.canvas.height !== Math.round(height * ratio)) {
        ui.canvas.width = Math.round(width * ratio); ui.canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      visibleTargets = []; visibleLines = [];
      if (!nodes.length) { ui.canvas.dataset.renderedWords = "0"; return; }
      const focus = byId.get(selectedId) || departingFocus?.node;
      const links = selectedId ? relevantEdges() : departingFocus?.links || [];
      const neighborIds = new Set(links.map((edge) => edge.to));
      const focusStrength = focus ? Math.max(0, Math.min(1, (camera.zoom - 1) / 1.8)) : 0;
      if (focus) {
        const from = asPoint(focus);
        for (const edge of links) {
          const other = byId.get(edge.to);
          if (!other) continue;
          const to = asPoint(other);
          if (Math.max(from.x, to.x) < 0 || Math.min(from.x, to.x) > width || Math.max(from.y, to.y) < 0 || Math.min(from.y, to.y) > height) continue;
          const active = activeEdge === edge;
          ctx.globalAlpha = focusStrength;
          ctx.strokeStyle = active ? "rgba(255,213,140,.95)" : "rgba(125,206,205,.53)";
          ctx.lineWidth = active ? 2.5 : 1;
          ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
          if (selectedId && focusStrength > 0.2) visibleLines.push({ from, to, edge });
        }
        ctx.globalAlpha = 1;
      }
      {
        const visible = visibleNodes(width, height);
        const marks = [], background = [], important = [];
        const radius = Math.max(0.48, Math.min(10, camera.zoom * 1.1 - 0.4));
        for (const node of visible) {
          const p = asPoint(node);
          if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
          const focusNode = node.id === focus?.id, neighbor = neighborIds.has(node.id);
          const count = node[currentKind === "synonym" ? "synonymNeighborCount" : "spellingNeighborCount"];
          const relationScale = Number.isInteger(count) && count >= 0
            ? 1 + 0.35 * Math.log1p(Math.min(count, 20)) / Math.log(21) * Math.max(0, Math.min(1, (camera.zoom - 0.8) / 2.6))
            : 1;
          const markRadius = radius * relationScale * (1 + (focusNode ? 0.6 : neighbor ? 0.25 : 0) * focusStrength);
          const mark = { node, p, radius: markRadius, focusNode, neighbor, state: statusForNode(node) };
          marks.push(mark);
          (focusNode || neighbor ? important : background).push(mark);
          visibleTargets.push({ x: p.x, y: p.y, radius: Math.max(markRadius + 4, 8), node });
        }
        // Every mark is an actual word. Batch small background points by
        // status without substituting aggregates or discarding dense stars.
        const colors = { mastered: "#78e4bd", partial: "#b0ddc9", reinforce: "#edb778", review: "#8fbef8", mixed: "#ddb7ef", new: "#b7cadc", outside: "#91a6b7", unknown: "#f0c6d4" };
        const batches = new Map();
        for (const mark of background) {
          if (!batches.has(mark.state)) batches.set(mark.state, []);
          batches.get(mark.state).push(mark);
        }
        for (const [state, group] of batches) {
          ctx.globalAlpha = (state === "outside" ? 0.58 : 0.88) * (1 - 0.76 * focusStrength);
          const color = colors[state] ?? colors.new;
          ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.7, Math.min(1.5, radius));
          ctx.beginPath();
          for (const mark of group) {
            const { x, y } = mark.p, size = mark.radius;
            if (state === "outside") ctx.rect(x - size, y - size, size * 2, size * 2);
            else if (state === "reinforce" || state === "mixed") {
              ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
            } else { ctx.moveTo(x + size, y); ctx.arc(x, y, size, 0, Math.PI * 2); }
          }
          if (state === "outside" || state === "review" || state === "mixed") ctx.stroke(); else ctx.fill();
          if ((state === "mastered" || state === "partial") && radius > 2) {
            ctx.strokeStyle = state === "mastered" ? "#e0fff2" : "#ebf6ee"; ctx.lineWidth = 1; ctx.beginPath();
            for (const mark of group) {
              const start = state === "partial" ? -Math.PI / 2 : 0, end = state === "partial" ? Math.PI / 2 : Math.PI * 2;
              ctx.moveTo(mark.p.x + Math.cos(start) * (mark.radius + 2), mark.p.y + Math.sin(start) * (mark.radius + 2));
              ctx.arc(mark.p.x, mark.p.y, mark.radius + 2, start, end);
            }
            ctx.stroke();
          }
          if (state === "unknown" && radius > 2) {
            ctx.strokeStyle = "#182633"; ctx.lineWidth = 1; ctx.beginPath();
            for (const mark of group) {
              const { x, y } = mark.p;
              const size = mark.radius;
              ctx.moveTo(x - size / 2, y - size / 2); ctx.lineTo(x + size / 2, y + size / 2);
              ctx.moveTo(x + size / 2, y - size / 2); ctx.lineTo(x - size / 2, y + size / 2);
            }
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        for (const mark of important) drawPlanet(mark.p.x, mark.p.y, mark.radius, mark.state, focusStrength > 0.15);
        ui.canvas.dataset.renderedWords = String(marks.length);
        ui.canvas.dataset.aggregateCount = "0";
        ui.canvas.dataset.cameraZoom = camera.zoom.toFixed(4);
        const focusMark = marks.find((mark) => mark.focusNode);
        ui.canvas.dataset.selectedRadius = focusMark ? focusMark.radius.toFixed(4) : "";
        const labelMarks = focus
          ? (focusStrength > 0.25 ? marks.filter((mark) => mark.focusNode).concat(marks.filter((mark) => mark.neighbor)) : [])
          : camera.zoom > 4 ? marks : [];
        const occupied = [];
        for (const mark of labelMarks) {
          if (occupied.length >= 70) break;
          ctx.font = mark.focusNode ? "bold 13px system-ui" : "11px system-ui";
          const textWidth = ctx.measureText(mark.node.word).width;
          const candidates = [mark.p.y - mark.radius - 6, mark.p.y + mark.radius + 13, mark.p.y - mark.radius - 20];
          const y = candidates.find((candidate) => {
            const box = { left: mark.p.x - textWidth / 2 - 2, right: mark.p.x + textWidth / 2 + 2, top: candidate - 12, bottom: candidate + 3 };
            return box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height &&
              !occupied.some((prior) => box.left < prior.right && box.right > prior.left && box.top < prior.bottom && box.bottom > prior.top);
          });
          if (y === undefined) continue;
          occupied.push({ left: mark.p.x - textWidth / 2 - 2, right: mark.p.x + textWidth / 2 + 2, top: y - 12, bottom: y + 3 });
          ctx.fillStyle = mark.focusNode ? "#ffffff" : "#dce8ef";
          ctx.textAlign = "center"; ctx.fillText(mark.node.word, mark.p.x, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    function centerOn(node, zoom = 3.4) {
      const position = node[currentKind === "synonym" ? "semantic" : "spelling"];
      moveCamera({ x: position[0], y: position[1], zoom });
    }

    function senseText(node, senseId) {
      const sense = node?.senses.find((item) => item.id === senseId);
      if (!sense) return "义项资料不足";
      const status = book?.senseStatus(node.id, sense.id);
      return `${sense.pos} ${book?.senseMeaning(node.id, sense.id) ?? ""} · ${status === null ? "词书外" : STATUS[status] ?? "资料不足"}`;
    }

    function updateSelection(message = "") {
      if (!ui.selection || destroyed) return;
      ui.selection.replaceChildren();
      const node = byId.get(selectedId);
      if (!node) {
        ui.selection.append(element("p", "universe-empty", message || "搜索单词，或放大后选择星球以查看关系。"));
        return;
      }
      const heading = element("div", "universe-selection-heading");
      const title = element("h2", "", node.word);
      const count = node.senses.map((sense) => book?.senseStatus(node.id, sense.id)).filter((value) => value != null);
      heading.append(title, element("span", "universe-selection-status", count.length ? `${count.filter((value) => value === "mastered").length} / ${count.length} 义项已掌握` : "当前词书外"));
      ui.selection.append(heading);
      const neighborCount = node[currentKind === "synonym" ? "synonymNeighborCount" : "spellingNeighborCount"];
      if (Number.isInteger(neighborCount) && neighborCount >= 0) {
        const suffix = currentKind === "spelling" ? "（最多显示 20 个）" : "（受资料覆盖限制）";
        ui.selection.append(element("p", "universe-uncertain", `此词已收录 ${neighborCount} 个${currentKind === "synonym" ? "近义词" : "形近词"}${suffix}。`));
      }
      if (currentKind === "synonym" && !node.complete) {
        const placement = node.semanticPlacement === "wordnet-lemma-estimate"
          ? "位置按同拼写的 WordNet 词条估算，不代表已核验这些义项的语义关系。"
          : "外围位置仅作占位，与含义相近无关。";
        ui.selection.append(element("p", "universe-uncertain", `部分义项缺少可靠向量：${placement}不参与整词语义相似度计算。`));
      }
      if (currentKind === "synonym" && node.semanticPlacement === "estimated-from-frozen-anchors") {
        ui.selection.append(element("p", "universe-uncertain", "此词位置根据既有星图估算，仅用于浏览，不代表已核验近义关系。"));
      }
      if (currentKind === "spelling" && !node.spellingSupported) {
        ui.selection.append(element("p", "universe-uncertain", "该词的拼写形式暂不支持自动比较。"));
      }
      if (currentKind === "synonym") {
        const label = element("label", "universe-sense-label", "选择义项");
        const select = element("select", "universe-sense-select");
        select.setAttribute("aria-label", `${node.word} 的义项`);
        const all = element("option", "", "全部义项"); all.value = "all"; select.append(all);
        for (const sense of node.senses) {
          const frequency = sense.frequency === "missing" ? "词频估计" : sense.frequency === "observed-zero" ? "无标注样本" : "标注样本";
          const weight = Number.isFinite(sense.weight) ? ` · 权重 ${(sense.weight * 100).toFixed(1)}%（${frequency}）` : "";
          const option = element("option", "", senseText(node, sense.id) + weight + (sense.verified ? "" : " · 资料不足"));
          option.value = sense.id; select.append(option);
        }
        select.value = selectedSense;
        listenTemporary(select, "change", () => { selectedSense = select.value; activeEdge = null; updateSelection(); scheduleDraw(); });
        label.append(select); ui.selection.append(label);
      } else {
        const senses = element("ul", "universe-senses");
        for (const sense of node.senses) senses.append(element("li", "", senseText(node, sense.id)));
        ui.selection.append(senses);
      }
      if (message) ui.selection.append(element("p", "universe-uncertain", message));
      const chosen = relevantEdges();
      if (!chosen.length && !message) ui.selection.append(element("p", "universe-empty", "暂无可核验的关系；不代表不存在其他关系。"));
      const list = element("div", "universe-relationships");
      for (const edge of chosen) {
        const target = byId.get(edge.to);
        if (!target) continue;
        const button = element("button", "universe-relation", "");
        button.type = "button";
        button.append(element("strong", "", target.word), element("span", "", currentKind === "synonym"
          ? `${senseText(node, edge.sourceSense)} ↔ ${senseText(target, edge.targetSense)}`
          : `拼写编辑距离 ${edge.distance} · 含增删、替换与相邻换序`));
        button.setAttribute("aria-pressed", String(activeEdge === edge));
        listenTemporary(button, "click", () => { activeEdge = edge; updateSelection(); scheduleDraw(); });
        list.append(button);
      }
      ui.selection.append(list);
      if (activeEdge && chosen.includes(activeEdge)) {
        const target = byId.get(activeEdge.to);
        const detail = element("section", "universe-edge-detail");
        detail.append(element("strong", "", `${node.word} ↔ ${target.word}`));
        detail.append(element("p", "", currentKind === "synonym"
          ? `${senseText(node, activeEdge.sourceSense)} ↔ ${senseText(target, activeEdge.targetSense)}。依据：WordNet 3.0 同一词性 synset（${activeEdge.synset}）；具体语境仍需比较。向量余弦仅作参考，不是概率。`
          : `两词拼写的最优字符串对齐距离为 ${activeEdge.distance}；这是字形关系，不代表语义相同。`));
        if (currentKind === "synonym") {
          const source = element("a", "", "查看 WordNet 原始词条（外部链接）");
          const sourceUrl = new URL("https://wordnetweb.princeton.edu/perl/webwn");
          sourceUrl.searchParams.set("s", node.word);
          source.href = sourceUrl.href; source.target = "_blank"; source.rel = "noopener noreferrer";
          const license = element("a", "", "WordNet 许可说明");
          license.href = "https://wordnet.princeton.edu/license-and-commercial-use"; license.target = "_blank"; license.rel = "noopener noreferrer";
          detail.append(source, license);
        }
        const jump = element("button", "secondary-button", `前往 ${target.word}`); jump.type = "button";
        listenTemporary(jump, "click", () => selectWord(target.id));
        detail.append(jump); ui.selection.append(detail);
      }
    }

    async function fetchJson(url, options = {}) {
      const response = await fetch(url, { ...options, signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    async function loadEdges(node, request) {
      const tileId = node[currentKind === "synonym" ? "semanticTile" : "spellingTile"];
      if (!/^\d-\d$/.test(tileId)) throw new Error("invalid tile");
      const key = `${indexVersion}/${currentKind}/${tileId}`;
      let shard = edgeCache.get(key);
      if (!shard) {
        shard = await fetchJson(rootFor(`${key}.json`));
        if (shard.schema !== 1 || shard.version !== indexVersion || shard.kind !== currentKind || shard.tile !== tileId || !shard.adjacency) throw new Error("invalid map shard");
      }
      if (request !== activeRequest || destroyed) return;
      const result = shard.adjacency[node.id];
      if (!Array.isArray(result) || result.some((edge) => {
        const target = byId.get(edge.to);
        if (!target) return true;
        if (currentKind === "spelling") return !Number.isInteger(edge.distance) || edge.distance < 1 || edge.distance > 2;
        const sourceSense = node.senses.find((sense) => sense.id === edge.sourceSense);
        const targetSense = target.senses.find((sense) => sense.id === edge.targetSense);
        return !sourceSense?.verified || !targetSense?.verified || sourceSense.synsetId !== edge.synset ||
          targetSense.synsetId !== edge.synset || !Number.isFinite(edge.cosine) || Math.abs(edge.cosine) > 1.00001;
      })) { edgeCache.delete(key); throw new Error("invalid map relations"); }
      const expectedCount = node[currentKind === "synonym" ? "synonymNeighborCount" : "spellingNeighborCount"];
      if (expectedCount !== undefined && new Set(result.map((edge) => edge.to)).size !== expectedCount) {
        edgeCache.delete(key);
        throw new Error("map relation count mismatch");
      }
      edgeCache.set(key, shard);
      edges = result;
      ui.loading.textContent = "";
      updateSelection(); scheduleDraw();
    }

    async function selectWord(id) {
      const node = byId.get(id);
      if (!node || destroyed) return;
      selectedId = id; selectedSense = "all"; activeEdge = null; edges = [];
      const request = ++activeRequest;
      centerOn(node);
      ui.results.replaceChildren();
      ui.search.value = node.word;
      ui.loading.textContent = `正在加载 ${node.word} 的关系…`;
      updateSelection("正在读取关系…");
      try { await loadEdges(node, request); }
      catch (error) {
        if (destroyed || request !== activeRequest || error?.name === "AbortError") return;
        ui.loading.textContent = "关系加载失败，可重试；学习记录不受影响。";
        updateSelection("关系暂不可用，请重试。");
        const retry = element("button", "secondary-button", "重试关系"); retry.type = "button";
        listenTemporary(retry, "click", () => selectWord(id)); ui.selection.append(retry);
      }
    }

    function updateSearch() {
      ui.results.replaceChildren();
      const query = ui.search.value.trim().toLocaleLowerCase("en");
      if (!query) return;
      const matches = nodes.filter((node) => node.word.toLocaleLowerCase("en").includes(query));
      matches.sort((a, b) => Number(b.word.toLowerCase().startsWith(query)) - Number(a.word.toLowerCase().startsWith(query)) || a.word.localeCompare(b.word));
      for (const node of matches.slice(0, 12)) {
        const button = element("button", "universe-search-result", node.word); button.type = "button";
        listenTemporary(button, "click", () => selectWord(node.id)); ui.results.append(button);
      }
      if (!matches.length) ui.results.append(element("span", "universe-empty", "没有找到这个单词"));
    }

    function zoomAt(factor, x, y) {
      stopCamera();
      const w = ui.canvas.clientWidth, h = ui.canvas.clientHeight, base = Math.min(w, h) / 3000;
      const old = camera.zoom, next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, old * factor));
      const beforeX = camera.x + (x - w / 2) / (base * old);
      const beforeY = camera.y + (y - h / 2) / (base * old);
      camera = { x: beforeX - (x - w / 2) / (base * next), y: beforeY - (y - h / 2) / (base * next), zoom: next };
      scheduleDraw();
    }

    function onMapClick(point) {
      const hits = visibleTargets.map((target) => ({ target, distance: Math.hypot(target.x - point.x, target.y - point.y) }))
        .filter((hit) => hit.distance <= hit.target.radius).sort((a, b) => a.distance - b.distance);
      if (hits.length > 1 && !selectedId && camera.zoom < 2.2) {
        const unit = Math.min(ui.canvas.clientWidth, ui.canvas.clientHeight) / 3000 * camera.zoom;
        moveCamera({ x: camera.x + (point.x - ui.canvas.clientWidth / 2) / unit,
                     y: camera.y + (point.y - ui.canvas.clientHeight / 2) / unit,
                     zoom: Math.min(MAX_ZOOM, camera.zoom * 2.4) }, { duration: 450 });
        return;
      }
      if (hits[0]?.target.node) { selectWord(hits[0].target.node.id); return; }
      const line = visibleLines.map((item) => ({ item, distance: pointLineDistance(point, item.from, item.to) }))
        .filter((hit) => hit.distance <= 9).sort((a, b) => a.distance - b.distance)[0];
      if (line) { activeEdge = line.item.edge; updateSelection(); scheduleDraw(); }
    }

    async function loadIndex() {
      ui.loading.textContent = "正在加载词汇地图…";
      try {
        const manifest = await fetchJson(rootFor("manifest.json"), { cache: "no-cache" });
        if (manifest.schema !== 1 || !/^[a-f0-9]{16}$/.test(manifest.version) || manifest.index !== `./${manifest.version}/index.json`) throw new Error("invalid map manifest");
        if (!/^[a-f0-9]{64}$/.test(bundleVersion || "") || manifest.bundleSha256 !== bundleVersion) throw new Error("map and vocabulary versions do not match");
        const index = await fetchJson(rootFor(manifest.index));
        if (index.schema !== 1 || index.version !== manifest.version || index.bundleSha256 !== bundleVersion || !Array.isArray(index.nodes) || !index.nodes.length) throw new Error("empty or incompatible map");
        const seen = new Set();
        for (const node of index.nodes) {
          if (typeof node.id !== "string" || typeof node.word !== "string" || seen.has(node.id) || !Array.isArray(node.senses) ||
              ![node.semantic, node.spelling].every((pos) => Array.isArray(pos) && pos.length === 2 && pos.every(Number.isFinite))) throw new Error("invalid map node");
          if ([node.synonymNeighborCount, node.spellingNeighborCount].some((count) => count !== undefined &&
              (!Number.isInteger(count) || count < 0 || count >= index.nodes.length))) throw new Error("invalid map relation count");
          seen.add(node.id);
        }
        if (destroyed) return;
        nodes = index.nodes; byId = new Map(nodes.map((node) => [node.id, node])); indexVersion = index.version;
        spatial = { synonym: new Map(), spelling: new Map() };
        for (const node of nodes) for (const [kind, position, tileId] of [
          ["synonym", node.semantic, node.semanticTile], ["spelling", node.spelling, node.spellingTile],
        ]) {
          if (!/^[0-7]-[0-7]$/.test(tileId)) throw new Error("invalid spatial index");
          const cell = (value) => Math.min(7, Math.max(0, Math.floor((value + 1500) / 375)));
          if (tileId !== `${cell(position[0])}-${cell(position[1])}`) throw new Error("spatial index does not match coordinates");
          const group = spatial[kind].get(tileId) ?? { x: 0, y: 0, nodes: [] };
          group.x += position[0]; group.y += position[1]; group.nodes.push(node); spatial[kind].set(tileId, group);
        }
        ui.loading.textContent = `共 ${nodes.length} 个单词；选择星球可查看具体关系。`;
        refreshScope();
        if (originWord && byId.has(originWord)) await selectWord(originWord);
      } catch (error) {
        if (destroyed || error?.name === "AbortError") return;
        nodes = []; byId = new Map(); spatial = { synonym: new Map(), spelling: new Map() };
        scheduleDraw();
        ui.loading.textContent = "地图加载失败、数据不完整或版本不匹配，学习记录不受影响。";
        ui.selection.replaceChildren();
        const retry = element("button", "secondary-button", "重新加载地图"); retry.type = "button";
        listenTemporary(retry, "click", loadIndex); ui.selection.append(retry);
      }
    }

    listen(ui.back, "click", onClose);
    container.querySelectorAll("[data-kind]").forEach((button) => listen(button, "click", () => {
      if (currentKind === button.dataset.kind) return;
      currentKind = button.dataset.kind; activeEdge = null; selectedSense = "all"; edges = [];
      updateMode();
      if (selectedId) selectWord(selectedId); else { moveCamera({ x: 0, y: 0, zoom: 1 }); updateSelection(); scheduleDraw(); }
    }));
    listen(ui.search, "input", updateSearch);
    listen(ui.search, "keydown", (event) => { if (event.key === "Enter") { const first = ui.results.querySelector("button"); if (first) { event.preventDefault(); first.click(); } } });
    listen(ui.zoomIn, "click", () => zoomAt(1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2));
    listen(ui.zoomOut, "click", () => zoomAt(1 / 1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2));
    listen(ui.overview, "click", () => {
      const departure = selectedId && byId.has(selectedId) ? { node: byId.get(selectedId), links: relevantEdges() } : null;
      ++activeRequest; selectedId = null; selectedSense = "all"; activeEdge = null; edges = [];
      moveCamera({ x: 0, y: 0, zoom: 1 }, { duration: 850, departure });
      ui.search.value = ""; ui.results.replaceChildren();
      ui.loading.textContent = `共 ${nodes.length} 个单词；选择星球可查看具体关系。`;
      updateSelection(); scheduleDraw();
    });
    listen(ui.canvas, "wheel", (event) => { event.preventDefault(); const rect = ui.canvas.getBoundingClientRect(); zoomAt(event.deltaY < 0 ? 1.16 : 1 / 1.16, event.clientX - rect.left, event.clientY - rect.top); }, { passive: false });
    listen(ui.canvas, "pointerdown", (event) => {
      stopCamera();
      ui.canvas.setPointerCapture(event.pointerId);
      activePointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
      previousPointer = { x: event.clientX, y: event.clientY }; moved = false;
      if (activePointer.size === 2) {
        const [a, b] = [...activePointer.values()]; pinching = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    listen(ui.canvas, "pointermove", (event) => {
      if (!activePointer.has(event.pointerId)) return;
      activePointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointer.size >= 2) {
        const [a, b] = [...activePointer.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), rect = ui.canvas.getBoundingClientRect();
        if (pinching > 0) zoomAt(dist / pinching, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        pinching = dist; moved = true; return;
      }
      if (!previousPointer) return;
      const dx = event.clientX - previousPointer.x, dy = event.clientY - previousPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      const unit = Math.min(ui.canvas.clientWidth, ui.canvas.clientHeight) / 3000 * camera.zoom;
      camera.x -= dx / unit; camera.y -= dy / unit;
      previousPointer = { x: event.clientX, y: event.clientY }; scheduleDraw();
    });
    const endPointer = (event) => {
      if (!activePointer.has(event.pointerId)) return;
      const rect = ui.canvas.getBoundingClientRect();
      if (!moved && activePointer.size === 1) onMapClick({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      activePointer.delete(event.pointerId); previousPointer = null; pinching = null;
    };
    listen(ui.canvas, "pointerup", endPointer); listen(ui.canvas, "pointercancel", (event) => { activePointer.delete(event.pointerId); previousPointer = null; pinching = null; });
    listen(ui.canvas, "keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(event.key)) stopCamera();
      const step = 180 / camera.zoom;
      if (event.key === "ArrowLeft") camera.x -= step;
      else if (event.key === "ArrowRight") camera.x += step;
      else if (event.key === "ArrowUp") camera.y -= step;
      else if (event.key === "ArrowDown") camera.y += step;
      else if (event.key === "+" || event.key === "=") zoomAt(1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2);
      else if (event.key === "-") zoomAt(1 / 1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2);
      else return;
      event.preventDefault(); scheduleDraw();
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden && cameraTarget) { camera = cameraTarget; stopCamera(); }
      if (!document.hidden) scheduleDraw();
    });
    if (window.ResizeObserver) { resizeObserver = new ResizeObserver(scheduleDraw); resizeObserver.observe(ui.canvas); }
    else listen(window, "resize", scheduleDraw);
    updateMode(); refreshScope();
    if (!ctx) ui.hint.textContent = "当前浏览器不支持星图绘制，仍可使用搜索和关系列表。";
    void loadIndex();
    return {
      refreshScope,
      destroy() { destroyed = true; ++activeRequest; stopCamera(); abort.abort(); resizeObserver?.disconnect(); if (frame) cancelAnimationFrame(frame); edgeCache.clear(); },
    };
  }

  window.SenseVocabUniverse = Object.freeze({ create });
})();
