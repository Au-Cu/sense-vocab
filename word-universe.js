/* Read-only vocabulary maps.  No learning progress, account data or graph data
   is persisted here.  Relationship details are loaded by the selected tile. */
(() => {
  "use strict";

  const STATUS = Object.freeze({ new: "待新学", reinforce: "待强化", review: "待复习", mastered: "已掌握" });
  const TITLES = Object.freeze({ synonym: "近义词宇宙", spelling: "形近词宇宙" });
  const ROOT = typeof document === "undefined" ? null : new URL("./data/universes/", document.baseURI);
  const MAX_ZOOM = 14;
  const MIN_ZOOM = 0.8;
  const PLANET_GAP = 2;

  function computePackedLayout(nodes, kind) {
    if (!nodes.length) return { positions: new Float64Array(0), gap: PLANET_GAP };
    const coordinate = kind === "spelling" ? "spelling" : "semantic";
    const countKey = kind === "spelling" ? "spellingNeighborCount" : "synonymNeighborCount";
    for (const node of nodes) {
      const position = node[coordinate];
      if (!Array.isArray(position) || position.length !== 2 || !position.every(Number.isFinite)) throw new Error("invalid layout coordinate");
    }
    const axisPositions = (axis) => {
      const ordered = nodes.map((_, index) => index).sort((a, b) => nodes[a][coordinate][axis] - nodes[b][coordinate][axis] || a - b);
      const positions = new Float64Array(nodes.length);
      ordered.forEach((index, rank) => { positions[index] = ((rank + 0.5) / nodes.length - 0.5) * 2200; });
      return positions;
    };
    const anchorsX = axisPositions(0), anchorsY = axisPositions(1);
    const cellSize = 20, maxRadius = 8.1, occupied = new Map();
    const result = new Float64Array(nodes.length * 3);
    const cell = (value) => Math.floor(value / cellSize);
    const canPlace = (x, y, radius) => {
      const cx = cell(x), cy = cell(y);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of occupied.get(`${cx + dx},${cy + dy}`) ?? []) {
          const required = radius + other.radius + PLANET_GAP + 0.01;
          if ((x - other.x) ** 2 + (y - other.y) ** 2 < required ** 2) return false;
        }
      }
      return true;
    };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((node, index) => {
      const count = Number.isFinite(node[countKey]) ? Math.max(0, Math.min(20, node[countKey])) : 0;
      const radius = 6 + 2 * Math.log1p(count) / Math.log(21);
      const anchorX = anchorsX[index], anchorY = anchorsY[index];
      let x = anchorX, y = anchorY, attempt = 0;
      while (!canPlace(x, y, radius)) {
        attempt += 1;
        if (attempt > 30000) throw new Error("unable to separate map planets");
        const distance = Math.sqrt(attempt) * (maxRadius + PLANET_GAP);
        const angle = (index + attempt) * 2.399963229728653;
        x = anchorX + Math.cos(angle) * distance;
        y = anchorY + Math.sin(angle) * distance;
      }
      const key = `${cell(x)},${cell(y)}`;
      if (!occupied.has(key)) occupied.set(key, []);
      occupied.get(key).push({ x, y, radius });
      result[index * 3] = x; result[index * 3 + 1] = y; result[index * 3 + 2] = radius;
      minX = Math.min(minX, x - radius); maxX = Math.max(maxX, x + radius);
      minY = Math.min(minY, y - radius); maxY = Math.max(maxY, y + radius);
    });
    const scale = Math.min(1, 2800 / Math.max(1, maxX - minX, maxY - minY));
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    for (let i = 0; i < result.length; i += 3) {
      result[i] = (result[i] - centerX) * scale;
      result[i + 1] = (result[i + 1] - centerY) * scale;
      result[i + 2] *= scale;
    }
    return { positions: result, gap: PLANET_GAP * scale };
  }

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
    let destroyed = false, frame = 0, cameraFrame = 0, cameraTarget = null, departingFocus = null, activeRequest = 0, indexRun = 0;
    let currentKind = kind === "spelling" ? "spelling" : "synonym";
    let nodes = [], byId = new Map(), selectedId = null, selectedSense = "all", activeEdge = null, edges = [];
    let book = null, indexVersion = "", camera = { x: 0, y: 0, zoom: 1 };
    let spatial = { synonym: new Map(), spelling: new Map() };
    let placements = { synonym: new Map(), spelling: new Map() }, layoutWorker = null, indexReady = false, finalLayout = false;
    let insertedIds = new Set(), relationPending = false, relationError = false;
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
      <div class="universe-selection" data-u="selection" aria-live="polite" hidden></div>
      <details class="universe-info"><summary>图谱说明</summary><p>位置经过避让调整，接近不代表近义；部分位置为估计或占位，连线只反映已收录关系。词书外单词不计入当前学习状态。</p></details>
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
    }

    function refreshScope() {
      if (destroyed) return;
      book = scope();
      statusCache.clear();
      updateSelection();
      scheduleDraw();
    }

    function asPoint(node) {
      const position = placements[currentKind].get(node.id);
      return positionPoint(position ? [position.x, position.y] : node[currentKind === "synonym" ? "semantic" : "spelling"]);
    }

    function positionPoint(position) {
      const width = ui.canvas.clientWidth, height = ui.canvas.clientHeight;
      const unit = Math.min(width, height) / 3000 * camera.zoom;
      return { x: width / 2 + (position[0] - camera.x) * unit,
               y: height / 2 + (position[1] - camera.y) * unit };
    }

    function placementMaps(list, layout) {
      const maps = { synonym: new Map(), spelling: new Map() };
      for (const kind of ["synonym", "spelling"]) {
        const values = layout[kind].positions;
        if (values.length !== list.length * 3) throw new Error("invalid map layout");
        list.forEach((node, i) => {
          const x = values[i * 3], y = values[i * 3 + 1], radius = values[i * 3 + 2];
          if (![x, y, radius].every(Number.isFinite) || radius <= 0) throw new Error("invalid map placement");
          maps[kind].set(node.id, { x, y, radius });
        });
      }
      return maps;
    }

    function addSpatialNode(node) {
      if (insertedIds.has(node.id)) return;
      for (const kind of ["synonym", "spelling"]) {
        const position = placements[kind].get(node.id);
        if (!position) throw new Error("missing map placement");
        const cell = (value) => Math.min(7, Math.max(0, Math.floor((value + 1500) / 375)));
        const key = `${cell(position.x)}-${cell(position.y)}`;
        const group = spatial[kind].get(key) ?? { nodes: [] };
        group.nodes.push(node); spatial[kind].set(key, group);
      }
      insertedIds.add(node.id);
    }

    function showPriority(node, links = []) {
      if (indexReady || !node) return;
      const ids = [...new Set([node.id, ...links.map((edge) => edge.to)])];
      const priority = ids.map((id) => byId.get(id)).filter(Boolean);
      if (!finalLayout) {
        const preview = (kind) => {
          const values = new Float64Array(priority.length * 3);
          priority.forEach((item, index) => {
            const ring = Math.ceil(index / 8), angle = ((index - 1) % 8) * Math.PI / 4 + ring * 0.17;
            const count = item[kind === "synonym" ? "synonymNeighborCount" : "spellingNeighborCount"] ?? 0;
            values[index * 3] = index ? Math.cos(angle) * ring * 60 : 0;
            values[index * 3 + 1] = index ? Math.sin(angle) * ring * 60 : 0;
            values[index * 3 + 2] = 6 + 2 * Math.log1p(Math.max(0, Math.min(20, count))) / Math.log(21);
          });
          return { positions: values, gap: PLANET_GAP };
        };
        placements = placementMaps(priority, { synonym: preview("synonym"), spelling: preview("spelling") });
        spatial = { synonym: new Map(), spelling: new Map() };
        insertedIds = new Set();
      }
      priority.forEach(addSpatialNode);
      ui.canvas.dataset.indexedWords = String(insertedIds.size);
      ui.canvas.dataset.layoutPhase = "focus";
      scheduleDraw();
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

    function planetBodyRadius(outer, state, lineWidth) {
      const inner = Math.max(0.001, outer - lineWidth / 2);
      if (state === "outside") return inner / Math.SQRT2;
      return state === "mastered" || state === "partial" ? inner * 0.78 : inner;
    }

    function drawPlanet(x, y, outer, state, highlighted) {
      const colors = { mastered: "#78e4bd", partial: "#b0ddc9", reinforce: "#edb778", review: "#8fbef8", mixed: "#ddb7ef", new: "#95acc4", outside: "#a2b2c1", unknown: "#f0c6d4" };
      const color = colors[state] ?? colors.new;
      const previousAlpha = ctx.globalAlpha;
      const lineWidth = Math.min(1.2, outer * 0.2);
      const size = planetBodyRadius(outer, state, lineWidth);
      ctx.globalAlpha *= state === "outside" ? 0.62 : 0.94;
      ctx.beginPath();
      if (state === "outside") {
        ctx.rect(x - size, y - size, size * 2, size * 2);
      } else if (state === "reinforce" || state === "mixed") {
        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
      } else ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (state === "outside" || state === "review" || state === "mixed") { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke(); }
      else ctx.fill();
      if (state === "mastered" && outer > 2) {
        ctx.strokeStyle = "#e0fff2"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.arc(x, y, outer - lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
      }
      if (state === "unknown") {
        ctx.strokeStyle = "#182633"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(x - size / 2, y - size / 2); ctx.lineTo(x + size / 2, y + size / 2); ctx.moveTo(x + size / 2, y - size / 2); ctx.lineTo(x - size / 2, y + size / 2); ctx.stroke();
      }
      if (state === "partial" && outer > 2) {
        ctx.strokeStyle = "#ebf6ee"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.arc(x, y, outer - lineWidth / 2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      }
      if (highlighted) {
        const glow = ctx.createRadialGradient(x - size / 3, y - size / 3, 0, x, y, outer);
        glow.addColorStop(0, "rgba(255,255,255,.75)"); glow.addColorStop(.35, "rgba(131,226,222,.3)"); glow.addColorStop(1, "rgba(80,180,210,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2); ctx.fill();
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
      const focusStrength = focus ? (selectedId ? 1 : Math.max(0, Math.min(1, (camera.zoom - 1) / 1.8))) : 0;
      ui.canvas.dataset.focusStrength = focusStrength.toFixed(2);
      ui.canvas.dataset.visibleLines = "0";
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
        ui.canvas.dataset.visibleLines = String(visibleLines.length);
        ctx.globalAlpha = 1;
      }
      {
        const visible = visibleNodes(width, height);
        const marks = [], background = [], important = [];
        const unit = Math.min(width, height) / 3000 * camera.zoom;
        const lineWidth = Math.min(1.2, 6 * unit * 0.2);
        for (const node of visible) {
          const p = asPoint(node);
          if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
          const focusNode = node.id === focus?.id, neighbor = neighborIds.has(node.id);
          const placement = placements[currentKind].get(node.id);
          if (!placement) continue;
          const markRadius = placement.radius * unit;
          const state = statusForNode(node);
          const mark = { node, p, radius: markRadius, bodyRadius: planetBodyRadius(markRadius, state, lineWidth), focusNode, neighbor, state };
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
          ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
          ctx.beginPath();
          for (const mark of group) {
            const { x, y } = mark.p, size = mark.bodyRadius;
            if (state === "outside") ctx.rect(x - size, y - size, size * 2, size * 2);
            else if (state === "reinforce" || state === "mixed") {
              ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
            } else { ctx.moveTo(x + size, y); ctx.arc(x, y, size, 0, Math.PI * 2); }
          }
          if (state === "outside" || state === "review" || state === "mixed") ctx.stroke(); else ctx.fill();
          if (state === "mastered" || state === "partial") {
            ctx.strokeStyle = state === "mastered" ? "#e0fff2" : "#ebf6ee"; ctx.lineWidth = lineWidth; ctx.beginPath();
            for (const mark of group) {
              if (mark.radius <= 2) continue;
              const start = state === "partial" ? -Math.PI / 2 : 0, end = state === "partial" ? Math.PI / 2 : Math.PI * 2;
              const ring = mark.radius - lineWidth / 2;
              ctx.moveTo(mark.p.x + Math.cos(start) * ring, mark.p.y + Math.sin(start) * ring);
              ctx.arc(mark.p.x, mark.p.y, ring, start, end);
            }
            ctx.stroke();
          }
          if (state === "unknown") {
            ctx.strokeStyle = "#182633"; ctx.lineWidth = lineWidth; ctx.beginPath();
            for (const mark of group) {
              if (mark.radius <= 2) continue;
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
        ui.canvas.dataset.cameraX = camera.x.toFixed(4);
        ui.canvas.dataset.cameraY = camera.y.toFixed(4);
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
        ui.canvas.dataset.visibleLabels = String(occupied.length);
      }
      ctx.globalAlpha = 1;
    }

    function centerOn(node, zoom = 3.4) {
      const placed = placements[currentKind].get(node.id);
      const position = placed ? [placed.x, placed.y] : node[currentKind === "synonym" ? "semantic" : "spelling"];
      moveCamera({ x: position[0], y: position[1], zoom });
    }

    function focusRelations(node, links) {
      if (!finalLayout || !links.length) { centerOn(node); return; }
      const points = [node.id, ...new Set(links.map((edge) => edge.to))]
        .map((id) => placements[currentKind].get(id)).filter(Boolean);
      if (points.length < 2) { centerOn(node); return; }
      const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const width = ui.canvas.clientWidth, height = ui.canvas.clientHeight, unit = Math.min(width, height) / 3000;
      if (!unit) { centerOn(node); return; }
      const zoom = Math.min(3.4, Math.max(MIN_ZOOM, Math.min(
        Math.max(1, width - 64) / Math.max(1, maxX - minX) / unit,
        Math.max(1, height - 64) / Math.max(1, maxY - minY) / unit,
      )));
      moveCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom });
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
        ui.selection.hidden = true;
        return;
      }
      ui.selection.hidden = false;
      const heading = element("div", "universe-selection-heading");
      const title = element("h2", "", node.word);
      const count = node.senses.map((sense) => book?.senseStatus(node.id, sense.id)).filter((value) => value != null);
      heading.append(title, element("span", "universe-selection-status", count.length ? `${count.filter((value) => value === "mastered").length} / ${count.length} 义项已掌握` : "当前词书外"));
      ui.selection.append(heading);
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
        button.append(element("strong", "", target.word));
        if (currentKind === "synonym") button.append(element("span", "", `${senseText(node, edge.sourceSense)} ↔ ${senseText(target, edge.targetSense)}`));
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
          : "形近不代表含义相近。"));
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

    function validateNode(node, count) {
      if (typeof node?.id !== "string" || typeof node.word !== "string" || !Array.isArray(node.senses) ||
          ![node.semantic, node.spelling].every((pos) => Array.isArray(pos) && pos.length === 2 && pos.every(Number.isFinite))) throw new Error("invalid map node");
      if ([node.synonymNeighborCount, node.spellingNeighborCount].some((value) => value !== undefined &&
          (!Number.isInteger(value) || value < 0 || value >= count))) throw new Error("invalid map relation count");
      const cell = (value) => Math.min(7, Math.max(0, Math.floor((value + 1500) / 375)));
      for (const [position, tile] of [[node.semantic, node.semanticTile], [node.spelling, node.spellingTile]]) {
        if (!/^[0-7]-[0-7]$/.test(tile) || tile !== `${cell(position[0])}-${cell(position[1])}`) throw new Error("invalid spatial index");
      }
    }

    async function validateNodes(list, run) {
      for (let start = 0; start < list.length; start += 500) {
        if (destroyed || run !== indexRun) throw new DOMException("Map closed", "AbortError");
        list.slice(start, start + 500).forEach((node) => validateNode(node, list.length));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    async function packedLayouts(list) {
      const input = list.map((node) => ({ semantic: node.semantic, spelling: node.spelling,
        synonymNeighborCount: node.synonymNeighborCount, spellingNeighborCount: node.spellingNeighborCount }));
      if (typeof window.Worker === "function") {
        try {
          return await new Promise((resolve, reject) => {
            const src = document.querySelector('script[src^="./word-universe.js"]')?.src || new URL("./word-universe.js", document.baseURI).href;
            layoutWorker = new Worker(src);
            const worker = layoutWorker;
            const cleanup = () => { abort.signal.removeEventListener("abort", cancel); worker.terminate(); if (layoutWorker === worker) layoutWorker = null; };
            const cancel = () => { cleanup(); reject(new DOMException("Map closed", "AbortError")); };
            abort.signal.addEventListener("abort", cancel, { once: true });
            worker.onmessage = (event) => { cleanup(); if (event.data?.error) reject(new Error(event.data.error)); else resolve(event.data); };
            worker.onerror = () => { cleanup(); reject(new Error("map layout worker failed")); };
            worker.postMessage({ nodes: input });
          });
        } catch (error) {
          if (destroyed || error?.name === "AbortError") throw error;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const synonym = computePackedLayout(input, "synonym");
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      return { synonym, spelling: computePackedLayout(input, "spelling") };
    }

    async function installPackedLayout(list, layout, run) {
      placements = placementMaps(list, layout);
      finalLayout = true;
      spatial = { synonym: new Map(), spelling: new Map() };
      insertedIds = new Set();
      const current = byId.get(selectedId);
      const priorityIds = new Set(current ? [current.id, ...relevantEdges().map((edge) => edge.to)] : []);
      const order = [...priorityIds].map((id) => byId.get(id)).filter(Boolean).concat(list.filter((node) => !priorityIds.has(node.id)));
      if (current) {
        stopCamera();
        const point = placements[currentKind].get(current.id);
        camera = { x: point.x, y: point.y, zoom: camera.zoom };
      }
      ui.canvas.dataset.layoutPhase = "building";
      for (let start = 0; start < order.length; start += 800) {
        if (destroyed || run !== indexRun) throw new DOMException("Map closed", "AbortError");
        order.slice(start, start + 800).forEach(addSpatialNode);
        ui.canvas.dataset.indexedWords = String(insertedIds.size);
        scheduleDraw();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      indexReady = true;
      ui.canvas.dataset.indexReady = "true";
      ui.canvas.dataset.layoutPhase = "ready";
      ui.canvas.dataset.worldGap = String(layout[currentKind].gap);
      if (!relationPending && !relationError) ui.loading.textContent = "";
      if (selectedId === current?.id && !relationPending && !relationError) focusRelations(current, relevantEdges());
      scheduleDraw();
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
      validateNode(node, nodes.length);
      if (!Array.isArray(result) || result.some((edge) => {
        const target = byId.get(edge.to);
        if (!target) return true;
        validateNode(target, nodes.length);
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
      relationPending = false; relationError = false;
      showPriority(node, result);
      if (!finalLayout) {
        stopCamera();
        const point = placements[currentKind].get(node.id);
        if (point) camera = { x: point.x, y: point.y, zoom: camera.zoom };
      }
      ui.loading.textContent = indexReady ? "" : "正在补充星图…";
      if (finalLayout) focusRelations(node, relevantEdges());
      updateSelection(); scheduleDraw();
    }

    async function selectWord(id) {
      const node = byId.get(id);
      if (!node || destroyed) return;
      selectedId = id; selectedSense = "all"; activeEdge = null; edges = [];
      const request = ++activeRequest;
      relationPending = true; relationError = false;
      showPriority(node);
      centerOn(node);
      ui.results.replaceChildren();
      ui.search.value = node.word;
      ui.loading.textContent = `正在加载 ${node.word} 的关系…`;
      updateSelection("正在读取关系…");
      try { await loadEdges(node, request); }
      catch (error) {
        if (destroyed || request !== activeRequest || error?.name === "AbortError") return;
        relationPending = false; relationError = true;
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
      const run = ++indexRun;
      ++activeRequest;
      relationPending = false; relationError = false;
      indexReady = false; finalLayout = false;
      ui.canvas.dataset.indexReady = "false";
      ui.canvas.dataset.layoutPhase = "loading";
      ui.loading.textContent = "正在加载词汇地图…";
      ui.selection.replaceChildren(); ui.selection.hidden = true;
      try {
        const manifest = await fetchJson(rootFor("manifest.json"), { cache: "no-cache" });
        if (manifest.schema !== 1 || !/^[a-f0-9]{16}$/.test(manifest.version) || manifest.index !== `./${manifest.version}/index.json`) throw new Error("invalid map manifest");
        if (!/^[a-f0-9]{64}$/.test(bundleVersion || "") || manifest.bundleSha256 !== bundleVersion) throw new Error("map and vocabulary versions do not match");
        const index = await fetchJson(rootFor(manifest.index));
        if (index.schema !== 1 || index.version !== manifest.version || index.bundleSha256 !== bundleVersion || !Array.isArray(index.nodes) || !index.nodes.length) throw new Error("empty or incompatible map");
        if (destroyed || run !== indexRun) return;
        nodes = index.nodes; byId = new Map(nodes.map((node) => [node.id, node])); indexVersion = index.version;
        if (byId.size !== nodes.length) throw new Error("duplicate map node");
        spatial = { synonym: new Map(), spelling: new Map() };
        placements = { synonym: new Map(), spelling: new Map() }; insertedIds = new Set();
        ui.canvas.dataset.totalWords = String(nodes.length);
        ui.canvas.dataset.indexedWords = "0";
        const work = Promise.all([validateNodes(nodes, run), packedLayouts(nodes)])
          .then(([, layout]) => ({ layout }), (error) => ({ error }));
        refreshScope();
        if (originWord && byId.has(originWord)) {
          validateNode(byId.get(originWord), nodes.length);
          await selectWord(originWord);
          if (!document.hidden) await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        const result = await work;
        if (result.error) throw result.error;
        if (destroyed || run !== indexRun) return;
        await installPackedLayout(nodes, result.layout, run);
      } catch (error) {
        if (destroyed || run !== indexRun || error?.name === "AbortError") return;
        nodes = []; byId = new Map(); spatial = { synonym: new Map(), spelling: new Map() };
        placements = { synonym: new Map(), spelling: new Map() }; insertedIds = new Set();
        scheduleDraw();
        ui.loading.textContent = "地图加载失败、数据不完整或版本不匹配，学习记录不受影响。";
        ui.selection.replaceChildren();
        ui.selection.hidden = false;
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
      relationPending = false; relationError = false;
      moveCamera({ x: 0, y: 0, zoom: 1 }, { duration: 850, departure });
      ui.search.value = ""; ui.results.replaceChildren();
      ui.loading.textContent = indexReady ? "" : "正在补充星图…";
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
      destroy() { destroyed = true; ++activeRequest; ++indexRun; stopCamera(); abort.abort(); layoutWorker?.terminate(); resizeObserver?.disconnect(); if (frame) cancelAnimationFrame(frame); edgeCache.clear(); },
    };
  }

  if (typeof module === "object" && module.exports) module.exports = { computePackedLayout };
  if (typeof document === "undefined" && typeof self !== "undefined") {
    self.onmessage = (event) => {
      try {
        const synonym = computePackedLayout(event.data.nodes, "synonym");
        const spelling = computePackedLayout(event.data.nodes, "spelling");
        self.postMessage({ synonym, spelling }, [synonym.positions.buffer, spelling.positions.buffer]);
      } catch (error) {
        self.postMessage({ error: String(error?.message ?? error) });
      }
    };
  } else if (typeof window !== "undefined") {
    window.SenseVocabUniverse = Object.freeze({ create });
  }
})();
