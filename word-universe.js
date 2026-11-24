/* Read-only vocabulary maps.  No learning progress, account data or graph data
   is persisted here.  Relationship details are loaded by the selected tile. */
(() => {
  "use strict";

  const STATUS = Object.freeze({ new: "待新学", reinforce: "待强化", review: "待复习", mastered: "已掌握" });
  const FOG_KEY = "sense-vocab-universe-fog-v1";
  const TITLES = Object.freeze({ synonym: "近义词宇宙", spelling: "形近词宇宙", derivation: "派生词宇宙" });
  const ROOT = typeof document === "undefined" ? null : new URL("./data/universes/", document.baseURI);
  const DERIVATION_ROOT = typeof document === "undefined" ? null : new URL("./data/derivations/", document.baseURI);
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

  // Only already connected, visible words receive enlarged hit areas. Label
  // bounds win over nearby planets; otherwise choose the nearest connected
  // planet so dense, unrelated background stars do not steal the tap.
  function chooseRelatedTarget(point, targets) {
    const related = targets.filter((target) => target.related);
    const labelHits = related.filter((target) => {
      const box = target.label;
      return box && point.x >= box.left - 5 && point.x <= box.right + 5 &&
        point.y >= box.top - 5 && point.y <= box.bottom + 5;
    });
    if (labelHits.length) {
      labelHits.sort((a, b) => Math.hypot(point.x - (a.label.left + a.label.right) / 2, point.y - (a.label.top + a.label.bottom) / 2) -
        Math.hypot(point.x - (b.label.left + b.label.right) / 2, point.y - (b.label.top + b.label.bottom) / 2));
      return labelHits[0];
    }
    return related.map((target) => ({ target, distance: Math.hypot(target.x - point.x, target.y - point.y) }))
      .filter((hit) => hit.distance <= Math.max(22, hit.target.radius))
      .sort((a, b) => a.distance - b.distance)[0]?.target ?? null;
  }

  function create({ container, kind, originWord, onClose, scope, bundleVersion }) {
    if (!container || typeof onClose !== "function" || typeof scope !== "function") throw new TypeError("Invalid universe host");
    const abort = new AbortController();
    let destroyed = false, frame = 0, cameraFrame = 0, cameraTarget = null, departingFocus = null, activeRequest = 0, indexRun = 0, searchTimer = 0;
    let currentKind = Object.prototype.hasOwnProperty.call(TITLES, kind) ? kind : "synonym";
    let nodes = [], byId = new Map(), selectedId = null, selectedSense = "all", activeEdge = null, edges = [];
    let book = null, indexVersion = "", camera = { x: 0, y: 0, zoom: 1 };
    let spatial = { synonym: new Map(), spelling: new Map() };
    let placements = { synonym: new Map(), spelling: new Map(), derivation: new Map() }, layoutWorker = null, indexReady = false, finalLayout = false;
    let derivationIndex = null, derivationPromise = null, derivationPending = false;
    let insertedIds = new Set(), relationPending = false, relationError = false;
    let edgeCache = new Map(), statusCache = new Map(), revealedCache = new Map(), visibleTargets = [], visibleLines = [];
    let activePointer = new Map(), previousPointer = null, pinching = null, moved = false;
    let fogEnabled = false;
    try { fogEnabled = window.localStorage.getItem(FOG_KEY) === "on"; } catch {}
    const ui = {};

    // Static application-owned markup only. Vocabulary values are inserted via
    // textContent below, never interpreted as HTML.
    container.innerHTML = `
      <header class="universe-header">
        <div><p class="word-label">词汇探索</p><h1 data-u="title">近义词宇宙</h1></div>
        <button class="secondary-button universe-back" type="button" data-u="back">返回</button>
      </header>
      <div class="universe-kind" role="group" aria-label="选择词汇宇宙">
        <button type="button" data-kind="synonym">近义词</button><button type="button" data-kind="spelling">形近词</button><button type="button" data-kind="derivation">派生词</button>
      </div>
      <div class="universe-fog-settings">
        <label class="universe-fog-toggle"><input type="checkbox" data-u="fogToggle" /> <span>迷雾模式</span></label>
        <p class="universe-fog-progress" data-u="fogProgress" role="status" aria-live="polite" hidden></p>
        <progress class="universe-fog-meter" data-u="fogMeter" aria-label="当前词书已点亮进度" max="1" value="0" hidden></progress>
        <p class="universe-fog-notice" data-u="fogNotice" hidden></p>
        <p class="universe-fog-notice" data-u="fogSave" role="status" hidden></p>
      </div>
      <div class="universe-search-wrap">
        <label for="universeSearch">搜索单词或中文意象</label>
        <input id="universeSearch" type="search" autocomplete="off" spellcheck="false" placeholder="输入英文单词或中文意象" data-u="search" />
        <div class="universe-search-results" data-u="results" aria-label="搜索结果" aria-live="polite"></div>
      </div>
      <div class="universe-map-wrap" data-u="mapWrap">
        <div class="universe-map-controls" aria-label="星图控制">
          <button type="button" data-u="zoomOut" aria-label="缩小">−</button>
          <button type="button" data-u="zoomIn" aria-label="放大">＋</button>
          <button type="button" data-u="overview">全局总览</button>
        </div>
        <canvas class="universe-canvas" data-u="canvas" tabindex="0" aria-label="词汇星图。拖动或方向键移动，滚轮、双指或加减按钮缩放；可通过搜索和关系列表访问任意单词。"></canvas>
        <p class="universe-map-hint" data-u="hint">拖动探索 · 滚轮或双指缩放</p>
      </div>
      <p class="universe-loading" role="status" aria-live="polite" data-u="loading">正在加载词汇地图…</p>
      <p class="universe-legend" data-u="legend" aria-label="星球形状说明">● 待新学 · ◆ 待强化 · ○ 待复习 · ◎ 已掌握 · 半环 部分掌握 · ◇ 混合阶段 · □ 词书外 · ⊗ 状态异常</p>
      <div class="universe-selection" data-u="selection" aria-live="polite" hidden></div>
      <details class="universe-info"><summary>图谱说明</summary><p>部分位置是估计或占位，接近不代表近义或派生；连线只反映已收录关系。词库外的派生词在关系列表中补充，不产生学习进度。<a href="./legal.html#sources" target="_blank" rel="noopener noreferrer">内容来源与许可</a></p></details>
    `;
    container.querySelectorAll("[data-u]").forEach((item) => { ui[item.dataset.u] = item; });
    ui.canvas.dataset.cameraMoving = "false";
    const ctx = ui.canvas.getContext("2d");
    const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: abort.signal });
    const listenTemporary = (target, event, callback) => target.addEventListener(event, callback);
    const rootFor = (path) => new URL(path, ROOT);
    const derivationRootFor = (path) => new URL(path, DERIVATION_ROOT);
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
      revealedCache.clear();
      updateFog();
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
      const maps = { synonym: new Map(), spelling: new Map(), derivation: new Map() };
      for (const kind of ["synonym", "spelling"]) {
        const values = layout[kind].positions;
        if (values.length !== list.length * 3) throw new Error("invalid map layout");
        list.forEach((node, i) => {
          const x = values[i * 3], y = values[i * 3 + 1], radius = values[i * 3 + 2];
          if (![x, y, radius].every(Number.isFinite) || radius <= 0) throw new Error("invalid map placement");
          maps[kind].set(node.id, { x, y, radius });
        });
      }
      maps.derivation = derivationPlacements(maps.spelling);
      return maps;
    }

    // Reuse spelling-space positions but never enlarge an existing planet:
    // this preserves the established gap while sizing by derivation degree.
    function derivationPlacements(spelling) {
      let minimum = Infinity;
      for (const position of spelling.values()) minimum = Math.min(minimum, position.radius);
      if (!Number.isFinite(minimum)) return new Map();
      return new Map([...spelling].map(([id, position]) => {
        const count = derivationIndex?.counts?.[id] ?? 0;
        const radius = minimum * (0.75 + 0.25 * Math.log1p(Math.min(count, 20)) / Math.log(21));
        return [id, { x: position.x, y: position.y, radius }];
      }));
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
      revealedCache.set(node.id, statuses.some((status) => ["reinforce", "review", "mastered"].includes(status)));
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

    function isRevealed(node) {
      if (!node) return false;
      statusForNode(node);
      return revealedCache.get(node.id) === true;
    }

    function updateFog() {
      ui.fogToggle.checked = fogEnabled;
      ui.mapWrap.classList.toggle("is-fog", fogEnabled);
      ui.canvas.dataset.fog = String(fogEnabled);
      ui.fogProgress.hidden = !fogEnabled;
      ui.fogMeter.hidden = !fogEnabled;
      ui.legend.textContent = fogEnabled
        ? "☁ 迷雾中的词（可探索） · ◆ 待强化 · ○ 待复习 · ◎ 已掌握 · 半环 部分掌握 · ◇ 混合阶段"
        : "● 待新学 · ◆ 待强化 · ○ 待复习 · ◎ 已掌握 · 半环 部分掌握 · ◇ 混合阶段 · □ 词书外 · ⊗ 状态异常";
      if (!fogEnabled) { ui.fogNotice.hidden = true; return; }
      const inBook = nodes.filter((node) => statusForNode(node) !== "outside");
      const revealed = inBook.filter(isRevealed).length;
      ui.fogProgress.textContent = `已点亮 ${revealed} / ${inBook.length} 个词 · 任一义项离开待新学后点亮`;
      ui.fogMeter.max = Math.max(1, inBook.length);
      ui.fogMeter.value = revealed;
      ui.canvas.dataset.revealedWords = String(revealed);
      ui.fogNotice.hidden = false;
      ui.fogNotice.textContent = "迷雾中的词仍可搜索、查看和探索关系；学习后自动点亮。";
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
      const colors = { mastered: "#78e4bd", partial: "#b0ddc9", reinforce: "#edb778", review: "#8fbef8", mixed: "#ddb7ef", new: "#95acc4", outside: "#a2b2c1", unknown: "#f0c6d4", fogged: "#b7c6cf" };
      const color = colors[state] ?? colors.new;
      const previousAlpha = ctx.globalAlpha;
      const lineWidth = Math.min(1.2, outer * 0.2);
      const size = planetBodyRadius(outer, state, lineWidth);
      ctx.globalAlpha *= state === "fogged" ? 0.55 : state === "outside" ? 0.62 : 0.94;
      ctx.beginPath();
      if (state === "outside") {
        ctx.rect(x - size, y - size, size * 2, size * 2);
      } else if (state === "reinforce" || state === "mixed") {
        ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
      } else ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (state === "outside" || state === "review" || state === "mixed") { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke(); }
      else ctx.fill();
      if (state === "fogged" && outer > 2) {
        ctx.strokeStyle = "#d5e3e9"; ctx.lineWidth = Math.max(0.6, lineWidth);
        ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (state === "mastered" && outer > 2) {
        ctx.strokeStyle = "#e0fff2"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.arc(x, y, outer - lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
      }
      if (state === "unknown") {
        ctx.strokeStyle = "#182633"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(x - size / 2, y - size / 2); ctx.lineTo(x + size / 2, y + size / 2); ctx.moveTo(x + size / 2, y - size / 2); ctx.lineTo(x - size / 2, y + size / 2); ctx.stroke();
      }
      if (state === "partial" && outer > 2) {
        ctx.strokeStyle = "#ebf6ee"; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.arc(x, y, outer - lineWidth / 2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      }
      if (highlighted && state !== "fogged") {
        const glow = ctx.createRadialGradient(x - size / 3, y - size / 3, 0, x, y, outer);
        glow.addColorStop(0, "rgba(255,255,255,.75)"); glow.addColorStop(.35, "rgba(131,226,222,.3)"); glow.addColorStop(1, "rgba(80,180,210,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = previousAlpha;
    }

    function relevantEdges() {
      return selectedSense === "all" || currentKind === "spelling"
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
        const group = spatial[currentKind === "derivation" ? "spelling" : currentKind].get(`${x}-${y}`);
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
        const drawnTargets = new Set();
        for (const edge of links) {
          const other = byId.get(edge.to);
          if (!other || other.id === focus.id) continue;
          if (currentKind === "derivation" && drawnTargets.has(other.id)) continue;
          drawnTargets.add(other.id);
          const to = asPoint(other);
          if (Math.max(from.x, to.x) < 0 || Math.min(from.x, to.x) > width || Math.max(from.y, to.y) < 0 || Math.min(from.y, to.y) > height) continue;
          const active = activeEdge === edge || (currentKind === "derivation" && activeEdge?.to === edge.to);
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
          const state = fogEnabled && !isRevealed(node) ? "fogged" : statusForNode(node);
          const p = asPoint(node);
          if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
          const focusNode = node.id === focus?.id, neighbor = neighborIds.has(node.id);
          const placement = placements[currentKind].get(node.id);
          if (!placement) continue;
          const markRadius = placement.radius * unit;
          const target = { x: p.x, y: p.y, radius: Math.max(markRadius + 4, 8), node,
            related: Boolean(selectedId && neighbor && !focusNode), label: null };
          const mark = { node, p, radius: markRadius, bodyRadius: planetBodyRadius(markRadius, state, lineWidth), focusNode, neighbor, state, target };
          marks.push(mark);
          (focusNode || neighbor ? important : background).push(mark);
          visibleTargets.push(target);
        }
        // Every mark is an actual word. Batch small background points by
        // status without substituting aggregates or discarding dense stars.
        const colors = { mastered: "#78e4bd", partial: "#b0ddc9", reinforce: "#edb778", review: "#8fbef8", mixed: "#ddb7ef", new: "#b7cadc", outside: "#91a6b7", unknown: "#f0c6d4", fogged: "#b7c6cf" };
        const batches = new Map();
        for (const mark of background) {
          if (!batches.has(mark.state)) batches.set(mark.state, []);
          batches.get(mark.state).push(mark);
        }
        for (const [state, group] of batches) {
          ctx.globalAlpha = state === "fogged" ? 0.52 * (1 - 0.42 * focusStrength)
            : (state === "outside" ? 0.58 : 0.88) * (1 - 0.76 * focusStrength);
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
        ui.canvas.dataset.foggedWords = String(marks.filter((mark) => mark.state === "fogged").length);
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
          const labelBox = { left: mark.p.x - textWidth / 2 - 2, right: mark.p.x + textWidth / 2 + 2, top: y - 12, bottom: y + 3 };
          occupied.push(labelBox);
          if (mark.target.related) mark.target.label = labelBox;
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
      const connected = links.filter((edge) => edge.to && edge.to !== node.id);
      if (!finalLayout || !connected.length) { centerOn(node); return; }
      const points = [node.id, ...new Set(connected.map((edge) => edge.to))]
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
      return `${sense.pos} ${book?.senseMeaning(node.id, sense.id) ?? ""}${status === null ? " · 当前词书外" : ""}`;
    }

    function derivationSenseText(node, senseId, partOfSpeech) {
      return node && senseId ? senseText(node, senseId) : `${partOfSpeech} · 该义项未在词库中匹配`;
    }

    function derivationGroupKey(edge) {
      return JSON.stringify([edge.to, edge.word, edge.sourceSense, edge.sourceSynset, edge.targetSense, edge.targetPos]);
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
      heading.append(title);
      if (!count.length) heading.append(element("span", "universe-selection-status", "当前词书外"));
      ui.selection.append(heading);
      if (fogEnabled && !isRevealed(node)) {
        ui.selection.append(element("p", "universe-uncertain", count.length
          ? "待点亮：任一义项离开待新学后，此词将自动点亮。"
          : "当前词书外：可以探索关系，但不计入本词书的点亮进度。"));
      }
      if (currentKind === "spelling" && !node.spellingSupported) {
        ui.selection.append(element("p", "universe-uncertain", "该词的拼写形式暂不支持自动比较。"));
      }
      if (currentKind === "derivation") {
        ui.selection.append(element("p", "universe-uncertain", "词库外派生词仅作补充，不计入学习进度。"));
      }
      if (currentKind !== "spelling") {
        const label = element("label", "universe-sense-label", "选择义项");
        const select = element("select", "universe-sense-select");
        select.setAttribute("aria-label", `${node.word} 的义项`);
        const all = element("option", "", "全部义项"); all.value = "all"; select.append(all);
        for (const sense of node.senses) {
          const frequency = sense.frequency === "missing" ? "词频估计" : sense.frequency === "observed-zero" ? "无标注样本" : "标注样本";
          const weight = currentKind === "synonym" && Number.isFinite(sense.weight) ? ` · 权重 ${(sense.weight * 100).toFixed(1)}%（${frequency}）` : "";
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
      if (currentKind === "synonym") {
        const senses = node.senses.filter((sense) => selectedSense === "all" || sense.id === selectedSense);
        const meanings = [...new Set(senses.flatMap((sense) => String(book?.senseMeaning(node.id, sense.id) ?? "")
          .split(/[,，、;；|\/]+/u).map((part) => part.trim()).filter((part) => /[\u3400-\u9fff]/u.test(part) && part !== "释义暂不可用")))];
        if (meanings.length) {
          const explorer = element("details", "universe-meaning-explorer");
          explorer.append(element("summary", "", "按中文意象探索更多候选"));
          explorer.append(element("p", "universe-uncertain", "根据中文释义和已有词义关系搜索；候选不等于已核验的近义关系，具体语境可能不同。"));
          const choices = element("div", "universe-meaning-choices");
          for (const meaning of meanings) {
            const button = element("button", "universe-meaning-choice", meaning); button.type = "button";
            button.setAttribute("aria-label", `搜索${meaning}的相关单词`);
            listenTemporary(button, "click", () => {
              ui.search.value = meaning; updateSearch(); ui.search.focus(); ui.search.scrollIntoView({ block: "center", behavior: "auto" });
            });
            choices.append(button);
          }
          explorer.append(choices); ui.selection.append(explorer);
        }
      }
      if (message) ui.selection.append(element("p", "universe-uncertain", message));
      const chosen = relevantEdges();
      if (!chosen.length && !message) ui.selection.append(element("p", "universe-empty", "暂无可核验的关系；不代表不存在其他关系。"));
      const list = element("div", "universe-relationships");
      const groups = new Map();
      for (const edge of chosen) {
        const key = currentKind === "derivation" ? derivationGroupKey(edge) : edge;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
      }
      for (const group of groups.values()) {
        const edge = group[0];
        const target = byId.get(edge.to);
        if (!target && currentKind !== "derivation") continue;
        const button = element("button", "universe-relation", "");
        button.type = "button";
        button.append(element("strong", "", target?.word ?? edge.word));
        if (currentKind === "synonym") button.append(element("span", "", `${senseText(node, edge.sourceSense)} ↔ ${senseText(target, edge.targetSense)}`));
        if (currentKind === "derivation") {
          const targetDetail = target ? derivationSenseText(target, edge.targetSense, edge.targetPos) : `${edge.targetPos} · 词库外补充`;
          button.append(element("span", "", `${derivationSenseText(node, edge.sourceSense, edge.sourcePos)} ↔ ${targetDetail}${target?.id === node.id ? " · 同形词性变化" : ""}`));
        }
        button.setAttribute("aria-pressed", String(group.includes(activeEdge)));
        listenTemporary(button, "click", () => { activeEdge = edge; updateSelection(); scheduleDraw(); });
        list.append(button);
      }
      ui.selection.append(list);
      if (activeEdge && chosen.includes(activeEdge)) {
        const target = byId.get(activeEdge.to);
        const targetWord = target?.word ?? activeEdge.word;
        const detail = element("section", "universe-edge-detail");
        detail.append(element("strong", "", `${node.word} ↔ ${targetWord}`));
        detail.append(element("p", "", currentKind === "synonym"
          ? `${senseText(node, activeEdge.sourceSense)} ↔ ${senseText(target, activeEdge.targetSense)}`
          : currentKind === "derivation"
            ? `${derivationSenseText(node, activeEdge.sourceSense, activeEdge.sourcePos)} ↔ ${target ? derivationSenseText(target, activeEdge.targetSense, activeEdge.targetPos) : `${activeEdge.targetPos} · 词库外补充`}`
            : "形近不代表含义相近。"));
        if (target && target.id !== node.id) {
          const jump = element("button", "secondary-button", `前往 ${target.word}`); jump.type = "button";
          listenTemporary(jump, "click", () => selectWord(target.id));
          detail.append(jump);
        }
        ui.selection.append(detail);
      }
    }

    async function fetchJson(url, options = {}) {
      const response = await fetch(url, { ...options, signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    async function ensureDerivationIndex() {
      if (derivationIndex) return derivationIndex;
      if (!derivationPromise) {
        const run = indexRun;
        const pending = (async () => {
          const manifest = await fetchJson(derivationRootFor("manifest.json"), { cache: "no-cache" });
          if (manifest.schema !== 1 || !/^[a-f0-9]{16}$/.test(manifest.version || "") ||
              manifest.index !== `./${manifest.version}/index.json` || manifest.bundleSha256 !== bundleVersion ||
              manifest.baseUniverseVersion !== indexVersion ||
              manifest.source?.archiveSha256 !== "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59") throw new Error("invalid derivation manifest");
          const index = await fetchJson(derivationRootFor(manifest.index));
          if (destroyed || run !== indexRun) throw new DOMException("Map changed", "AbortError");
          if (index.schema !== 1 || index.version !== manifest.version || index.bundleSha256 !== bundleVersion ||
              index.baseUniverseVersion !== indexVersion || index.wordnetSha256 !== manifest.source.archiveSha256 ||
              !index.counts || typeof index.counts !== "object" ||
              Array.isArray(index.counts) || Object.keys(index.counts).length !== nodes.length ||
              nodes.some((node) => !Object.prototype.hasOwnProperty.call(index.counts, node.id) ||
                !Number.isInteger(index.counts[node.id]) || index.counts[node.id] < 0 || index.counts[node.id] >= nodes.length)) {
            throw new Error("invalid derivation index");
          }
          derivationIndex = index;
          placements.derivation = derivationPlacements(placements.spelling);
          scheduleDraw();
          return index;
        })();
        derivationPromise = pending;
        pending.catch(() => { if (derivationPromise === pending) derivationPromise = null; });
      }
      return derivationPromise;
    }

    async function prepareDerivation() {
      if (!nodes.length || currentKind !== "derivation" || selectedId) return;
      derivationPending = true; relationError = false;
      ui.loading.textContent = "正在加载派生词资料…";
      try {
        await ensureDerivationIndex();
        derivationPending = false;
        if (destroyed || currentKind !== "derivation" || selectedId) return;
        ui.loading.textContent = indexReady ? "" : "正在补充星图…";
        updateSelection(); scheduleDraw();
      } catch (error) {
        derivationPending = false;
        if (destroyed || currentKind !== "derivation" || selectedId || error?.name === "AbortError") return;
        relationError = true;
        ui.loading.textContent = "派生词资料加载失败，其他地图和学习记录不受影响。";
        ui.selection.replaceChildren(); ui.selection.hidden = false;
        const retry = element("button", "secondary-button", "重试派生词资料"); retry.type = "button";
        listenTemporary(retry, "click", prepareDerivation); ui.selection.append(retry);
      }
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
      ui.canvas.dataset.worldGap = String(layout[currentKind === "derivation" ? "spelling" : currentKind].gap);
      if (!relationPending && !relationError && !derivationPending) ui.loading.textContent = "";
      if (selectedId === current?.id && !relationPending && !relationError) focusRelations(current, relevantEdges());
      scheduleDraw();
    }

    async function loadEdges(node, request) {
      const mode = currentKind;
      const derivation = mode === "derivation" ? await ensureDerivationIndex() : null;
      if (request !== activeRequest || destroyed || mode !== currentKind) return;
      const tileId = node[mode === "synonym" ? "semanticTile" : "spellingTile"];
      if (!/^\d-\d$/.test(tileId)) throw new Error("invalid tile");
      const version = derivation?.version ?? indexVersion;
      const key = `${version}/${mode}/${tileId}`;
      let shard = edgeCache.get(key);
      if (!shard) {
        shard = await fetchJson(mode === "derivation" ? derivationRootFor(`${key}.json`) : rootFor(`${key}.json`));
        if (shard.schema !== 1 || shard.version !== version || shard.kind !== mode || shard.tile !== tileId || !shard.adjacency) throw new Error("invalid map shard");
      }
      if (request !== activeRequest || destroyed || mode !== currentKind) return;
      const result = shard.adjacency[node.id];
      validateNode(node, nodes.length);
      if (!Array.isArray(result) || result.some((edge) => {
        const target = byId.get(edge.to);
        if (mode === "derivation") {
          const identity = /^omw-en-\d{8}-[nvars]$/;
          const pos = new Set(["n.", "v.", "adj.", "adv."]);
          const posByTag = { n: "n.", v: "v.", a: "adj.", s: "adj.", r: "adv." };
          const sameLemma = (key, word) => typeof key === "string" && /^[^%]+%[1-5]:/.test(key) &&
            key.split("%")[0].replaceAll("_", " ").toLocaleLowerCase("en") === word.toLocaleLowerCase("en");
          if (!/^wn-deriv-[a-f0-9]{24}$/.test(edge.id || "") || typeof edge.word !== "string" || !edge.word.trim() ||
              edge.word.length > 160 || !identity.test(edge.sourceSynset || "") || !identity.test(edge.targetSynset || "") ||
              !pos.has(edge.sourcePos) || !pos.has(edge.targetPos) || posByTag[edge.sourceSynset.at(-1)] !== edge.sourcePos ||
              posByTag[edge.targetSynset.at(-1)] !== edge.targetPos || !sameLemma(edge.sourceKey, node.word) ||
              !sameLemma(edge.targetKey, edge.word) || (edge.to !== null && !target)) return true;
          const sourceSense = edge.sourceSense === null ? null : node.senses.find((sense) => sense.id === edge.sourceSense);
          if (edge.sourceSense !== null && (!sourceSense?.verified || sourceSense.synsetId !== edge.sourceSynset)) return true;
          if (!target) return edge.targetSense !== null;
          validateNode(target, nodes.length);
          if (target.word.toLocaleLowerCase("en") !== edge.word.toLocaleLowerCase("en")) return true;
          const targetSense = edge.targetSense === null ? null : target.senses.find((sense) => sense.id === edge.targetSense);
          return edge.targetSense !== null && (!targetSense?.verified || targetSense.synsetId !== edge.targetSynset);
        }
        if (!target) return true;
        validateNode(target, nodes.length);
        if (mode === "spelling") return !Number.isInteger(edge.distance) || edge.distance < 1 || edge.distance > 2;
        const sourceSense = node.senses.find((sense) => sense.id === edge.sourceSense);
        const targetSense = target.senses.find((sense) => sense.id === edge.targetSense);
        return !sourceSense?.verified || !targetSense?.verified || sourceSense.synsetId !== edge.synset ||
          targetSense.synsetId !== edge.synset || !Number.isFinite(edge.cosine) || Math.abs(edge.cosine) > 1.00001;
      })) { edgeCache.delete(key); throw new Error("invalid map relations"); }
      const expectedCount = mode === "derivation" ? derivation.counts[node.id]
        : node[mode === "synonym" ? "synonymNeighborCount" : "spellingNeighborCount"];
      const actualCount = new Set(result.filter((edge) => edge.to && edge.to !== node.id).map((edge) => edge.to)).size;
      if (expectedCount !== undefined && actualCount !== expectedCount) {
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
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = 0; }
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

    function updateSearch({ immediate = false } = {}) {
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = 0; }
      ui.results.replaceChildren();
      const rawQuery = ui.search.value.trim();
      const query = rawQuery.toLocaleLowerCase("en");
      if (!query) return;
      if (!nodes.length) {
        ui.results.append(element("span", "universe-empty", "正在加载单词，完成后会自动显示搜索结果。"));
        return;
      }
      const chinese = /[\u3400-\u9fff]/u.test(rawQuery);
      const render = () => {
        searchTimer = 0;
        if (destroyed || ui.search.value.trim() !== rawQuery) return;
        ui.results.replaceChildren();
        let matches;
        try {
          matches = chinese ? (book?.searchChinese?.(rawQuery) ?? []).filter((match) => byId.has(match.id))
            : nodes.filter((node) => node.word.toLocaleLowerCase("en").includes(query));
        } catch {
          ui.results.append(element("span", "universe-empty", "搜索暂时不可用，请稍后重试。")); return;
        }
        if (!chinese) matches.sort((a, b) => Number(b.word.toLowerCase().startsWith(query)) - Number(a.word.toLowerCase().startsWith(query)) || a.word.localeCompare(b.word));
        if (!matches.length) { ui.results.append(element("span", "universe-empty", "没有找到相关单词")); return; }
        if (chinese) ui.results.append(element("p", "universe-search-explanation", `找到 ${matches.length} 个意象候选；包含模糊及词义关联结果，不能保证语境可互换。`));
        let shown = 0;
        const more = element("button", "universe-search-more", ""); more.type = "button";
        const appendBatch = () => {
          more.remove();
          for (const match of matches.slice(shown, shown + 40)) {
            const button = element("button", "universe-search-result", ""); button.type = "button";
            button.append(element("strong", "", match.word));
            if (chinese) button.append(element("span", "", `${match.detail}${match.outside ? " · 当前词书外" : ""}`));
            listenTemporary(button, "click", () => selectWord(match.id)); ui.results.append(button);
          }
          shown = Math.min(shown + 40, matches.length);
          if (shown < matches.length) { more.textContent = `显示更多（剩余 ${matches.length - shown}）`; ui.results.append(more); }
        };
        listenTemporary(more, "click", appendBatch); appendBatch();
      };
      if (chinese && !immediate) {
        ui.results.append(element("span", "universe-empty", "正在搜索中文意象…"));
        searchTimer = setTimeout(render, 120);
      } else {
        render();
      }
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
      const related = chooseRelatedTarget(point, visibleTargets);
      if (related?.node) { selectWord(related.node.id); return; }
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
      derivationIndex = null; derivationPromise = null; derivationPending = false; edgeCache.clear();
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
        if (ui.search.value.trim()) updateSearch();
        spatial = { synonym: new Map(), spelling: new Map() };
        placements = { synonym: new Map(), spelling: new Map(), derivation: new Map() }; insertedIds = new Set();
        ui.canvas.dataset.totalWords = String(nodes.length);
        ui.canvas.dataset.indexedWords = "0";
        const work = Promise.all([validateNodes(nodes, run), packedLayouts(nodes)])
          .then(([, layout]) => ({ layout }), (error) => ({ error }));
        refreshScope();
        if (originWord && !ui.search.value.trim() && byId.has(originWord)) {
          validateNode(byId.get(originWord), nodes.length);
          await selectWord(originWord);
          if (!document.hidden) await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        if (currentKind === "derivation" && !selectedId) void prepareDerivation();
        const result = await work;
        if (result.error) throw result.error;
        if (destroyed || run !== indexRun) return;
        await installPackedLayout(nodes, result.layout, run);
      } catch (error) {
        if (destroyed || run !== indexRun || error?.name === "AbortError") return;
        nodes = []; byId = new Map(); spatial = { synonym: new Map(), spelling: new Map() };
        placements = { synonym: new Map(), spelling: new Map(), derivation: new Map() }; insertedIds = new Set();
        if (searchTimer) { clearTimeout(searchTimer); searchTimer = 0; }
        if (ui.search.value.trim()) { ui.results.replaceChildren(element("span", "universe-empty", "地图加载失败，请重试后搜索。")); }
        scheduleDraw();
        ui.loading.textContent = "地图加载失败、数据不完整或版本不匹配，学习记录不受影响。";
        ui.selection.replaceChildren();
        ui.selection.hidden = false;
        const retry = element("button", "secondary-button", "重新加载地图"); retry.type = "button";
        listenTemporary(retry, "click", loadIndex); ui.selection.append(retry);
      }
    }

    listen(ui.back, "click", onClose);
    listen(ui.fogToggle, "change", () => {
      fogEnabled = ui.fogToggle.checked;
      let saved = true;
      try { window.localStorage.setItem(FOG_KEY, fogEnabled ? "on" : "off"); } catch { saved = false; }
      ui.fogSave.hidden = saved;
      ui.fogSave.textContent = saved ? "" : "当前浏览器未允许保存，刷新后可能恢复此前的设置。";
      updateFog(); updateSelection(); updateSearch(); scheduleDraw();
    });
    container.querySelectorAll("[data-kind]").forEach((button) => listen(button, "click", () => {
      if (currentKind === button.dataset.kind) return;
      currentKind = button.dataset.kind; activeEdge = null; selectedSense = "all"; edges = [];
      relationError = false; derivationPending = false;
      updateMode();
      if (selectedId) selectWord(selectedId); else {
        moveCamera({ x: 0, y: 0, zoom: 1 }); updateSelection(); scheduleDraw();
        if (currentKind === "derivation") void prepareDerivation();
      }
    }));
    listen(ui.search, "input", (event) => { if (!event.isComposing) updateSearch(); });
    listen(ui.search, "compositionend", () => updateSearch());
    listen(ui.search, "keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { if (searchTimer) updateSearch({ immediate: true }); const first = ui.results.querySelector(".universe-search-result"); if (first) { event.preventDefault(); first.click(); } } });
    listen(ui.zoomIn, "click", () => zoomAt(1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2));
    listen(ui.zoomOut, "click", () => zoomAt(1 / 1.4, ui.canvas.clientWidth / 2, ui.canvas.clientHeight / 2));
    listen(ui.overview, "click", () => {
      const departure = selectedId && byId.has(selectedId) ? { node: byId.get(selectedId), links: relevantEdges() } : null;
      ++activeRequest; selectedId = null; selectedSense = "all"; activeEdge = null; edges = [];
      relationPending = false; relationError = false;
      moveCamera({ x: 0, y: 0, zoom: 1 }, { duration: 850, departure });
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = 0; }
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
      destroy() { destroyed = true; ++activeRequest; ++indexRun; if (searchTimer) clearTimeout(searchTimer); stopCamera(); abort.abort(); layoutWorker?.terminate(); resizeObserver?.disconnect(); if (frame) cancelAnimationFrame(frame); edgeCache.clear(); },
    };
  }

  if (typeof module === "object" && module.exports) module.exports = { computePackedLayout, chooseRelatedTarget };
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
