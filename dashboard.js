/**
 * dashboard.js — 数据看板渲染子系统
 *
 * 从 app.js 抽离的纯渲染函数（约 41 个函数 + 常量）。
 * 通过全局词法环境引用 app.js 顶层声明（state/rootState/SENSE_STATUS/.DOM 常量等），
 * 仿 tutorial.js 模式：经典 script，暴露 window.SenseVocabDashboard。
 *
 * 留在 app.js 的数据采集函数：
 *   - dashboardRecordTransition（学习引擎 5 处调用）
 *   - dashboardRecordSnapshot（renderHome 调用）
 *   - dashboardKeyForProgress（setProgressMastered/Pending 调用）
 *   - renderDashboard（编排器，读写 app.js 模块级变量 dashboardBookId/Unit/RangeDays）
 *
 * 加载顺序（index.html）：app.js → dashboard.js → tutorial.js → account.js
 */

  // ─── 常量 ──────────────────────────────────────────────────────────────────

  const DASHBOARD_STATUS_META = Object.freeze([
    { key: SENSE_STATUS.MASTERED, label: "已掌握", color: "#16a34a" },
    { key: SENSE_STATUS.REVIEW, label: "待复习", color: "#0f766e" },
    { key: SENSE_STATUS.REINFORCE, label: "待强化", color: "#c77d2d" },
    { key: SENSE_STATUS.NEW, label: "待新学", color: "#68727d" },
  ]);

  const DASHBOARD_SANKEY_SIZE = Object.freeze({ width: 760, height: 300 });
  const DASHBOARD_SANKEY_NODE_WIDTH = 16;
  const DASHBOARD_SANKEY_MAX_NODE_HEIGHT = 118;
  const DASHBOARD_SANKEY_FLOW_GAP = 4;
  const DASHBOARD_SANKEY_STATIONS = Object.freeze({
    [SENSE_STATUS.NEW]: 48,
    [SENSE_STATUS.REINFORCE]: 254,
    [SENSE_STATUS.REVIEW]: 460,
    [SENSE_STATUS.MASTERED]: 640,
  });

  // ─── 工具函数 ──────────────────────────────────────────────────────────────

  function dashboardBookState(bookId = dashboardBookId ?? activeBookId()) {
    return rootState?.bookStates?.[bookId] ?? createState();
  }

  function dashboardWords(bookId = dashboardBookId ?? activeBookId()) {
    return wordsForBook(bookId);
  }

  function dashboardDateList(days = dashboardRangeDays, end = currentDate()) {
    const safeDays = Math.max(1, Math.min(180, Number(days) || 21));
    return Array.from({ length: safeDays }, (_, index) => {
      return addDays(end, index - safeDays + 1);
    });
  }

  function dashboardSenseKeys(bookWords) {
    return bookWords.flatMap((word) => allSenseKeysForWord(word));
  }

  function dashboardStatusForKey(bookState, key) {
    const value = bookState.progress?.[key]?.status;
    return Object.values(SENSE_STATUS).includes(value) ? value : SENSE_STATUS.NEW;
  }

  function dashboardWordStatus(bookState, word) {
    const priority = [
      SENSE_STATUS.NEW,
      SENSE_STATUS.REINFORCE,
      SENSE_STATUS.REVIEW,
      SENSE_STATUS.MASTERED,
    ];
    const statuses = allSenseKeysForWord(word).map((key) => {
      return dashboardStatusForKey(bookState, key);
    });
    return priority.find((status) => statuses.includes(status)) ?? SENSE_STATUS.NEW;
  }

  function dashboardCountStatuses(bookState, bookWords, unit) {
    const counts = Object.fromEntries(Object.values(SENSE_STATUS).map((status) => [status, 0]));
    if (unit === "word") {
      bookWords.forEach((word) => {
        counts[dashboardWordStatus(bookState, word)] += 1;
      });
    } else {
      dashboardSenseKeys(bookWords).forEach((key) => {
        counts[dashboardStatusForKey(bookState, key)] += 1;
      });
    }
    return counts;
  }

  function dashboardEventEntries(bookState, bookWords = dashboardWords()) {
    const knownKeys = new Set(dashboardSenseKeys(bookWords));
    return Object.values(bookState.dashboardEvents ?? {})
      .filter((event) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(event?.date ?? "") &&
          knownKeys.has(event.senseId) &&
          Object.values(SENSE_STATUS).includes(event.from) &&
          Object.values(SENSE_STATUS).includes(event.to);
      });
  }

  function dashboardDateLabel(date) {
    const parsed = parseDate(date);
    return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
  }

  function dashboardEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
  }

  function dashboardSvgLabel(label) {
    // The chart already exposes an aria-label and one fixed, card-level detail
    // region. Native SVG title popovers would duplicate that detail on desktop.
    return "";
  }

  function dashboardDisplayLabel(key, fallback = "") {
    return {
      new: "新学",
      reinforce: "待强化",
      review: "待复习",
      mastered: "已掌握",
      "new-mastered": "新学 → 掌握",
      "reinforce-review": "强化 → 复习",
      "review-mastered": "复习 → 掌握",
      "hold-reinforce": "强化停留",
      "hold-review": "复习停留",
    }[key] ?? fallback;
  }

  function dashboardApplyUserCopy() {
    const labels = {
      dashboardHeading: "统计数据",
      dashboardDailyHeading: "每日学习量",
      dashboardStatusHeading: "词书进度",
      dashboardPoolHeading: "强化与复习池",
      dashboardConversionHeading: "义项转化率",
      dashboardHoldHeading: "状态停留时间",
      dashboardSankeyHeading: "义项状态流转",
    };
    Object.entries(labels).forEach(([id, text]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    });
    const ariaLabels = {
      dashboardDailyChart: "每日学习柱状图，可横向滚动查看",
      dashboardPoolChart: "强化与复习池趋势图，可横向滚动查看",
      dashboardConversionChart: "义项转化率趋势图，可横向滚动查看",
      dashboardHoldChart: "状态停留时间趋势图，可横向滚动查看",
      dashboardSankeyChart: "义项状态流转图",
    };
    Object.entries(ariaLabels).forEach(([id, text]) => {
      const element = document.getElementById(id);
      if (element) element.setAttribute("aria-label", text);
    });
    if (dashboardUnitSelect) {
      dashboardUnitSelect.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("统计口径");
    }
    if (dashboardRangeSelect) {
      dashboardRangeSelect.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("时间范围");
    }
    dashboardBookSelect?.closest(".dashboard-control")?.querySelector("span")?.replaceChildren("词书");
  }

  function dashboardChartEmpty(message = "暂无数据") {
    const normalizedMessage = String(message ?? "") === "所选时间暂无状态变化"
      ? "所选时间暂无状态变化"
      : "暂无数据";
    return `<div class="dashboard-empty" role="status">${dashboardEscape(normalizedMessage)}</div>`;
  }

  function dashboardSetMarkup(container, markup) {
    if (!container) return;
    const range = document.createRange();
    range.selectNode(container);
    container.replaceChildren(range.createContextualFragment(markup));
  }

  function dashboardTooltipForElement(element) {
    return element.dataset.dashboardTooltip || element.querySelector?.("title")?.textContent?.trim() || "";
  }

  function dashboardDetailForFrame(frame) {
    const card = frame?.closest?.(".dashboard-card") ?? frame?.parentElement?.closest?.(".dashboard-card");
    if (!card) return null;
    let detail = card.querySelector(
      ":scope > .dashboard-sankey-detail-row .dashboard-card-detail, :scope > .dashboard-chart-detail-row .dashboard-card-detail, :scope > .dashboard-card-heading .dashboard-card-detail",
    );
    if (!detail) {
      const heading = card.querySelector(":scope > .dashboard-card-heading");
      if (!heading) return null;
      detail = document.createElement("span");
      detail.className = "dashboard-card-detail";
      detail.setAttribute("role", "status");
      detail.setAttribute("aria-live", "polite");
      detail.hidden = true;
      heading.append(detail);
    }
    return detail;
  }

  function dashboardWriteDetail(detail, text) {
    if (!detail) return;
    const normalized = String(text ?? "").trim();
    const card = detail.closest(".dashboard-card");
    const heading = card?.querySelector(":scope > .dashboard-card-heading");
    const timeHost = heading?.querySelector(".dashboard-card-time");
    const dateMatch = normalized.match(
      /^(\d{4}-\d{2}-\d{2}(?:\s+至\s+\d{4}-\d{2}-\d{2})?)(?:[　\s]+)(.*)$/,
    );
    const timeText = dateMatch?.[1] ?? "";
    const detailText = dateMatch?.[2]?.trim() ?? normalized;
    if (timeHost) {
      timeHost.textContent = timeText;
      timeHost.hidden = !timeText;
    }
    detail.replaceChildren();
    if (detailText) {
      const parts = detailText
        .split(/[　；]/)
        .map((part) => part.trim())
        .filter(Boolean);
      parts.forEach((part, index) => {
        const item = document.createElement("span");
        item.className = "dashboard-detail-part";
        item.textContent = part;
        detail.append(item);
      });
      detail.setAttribute("aria-label", normalized.replace(/　/g, "，"));
    } else {
      detail.removeAttribute("aria-label");
    }
    detail.hidden = !detailText;
    const detailRow = detail.closest(".dashboard-chart-detail-row, .dashboard-sankey-detail-row");
    if (detailRow) detailRow.hidden = !detailText;
  }

  function dashboardSetDefaultDetail(frame, text) {
    if (!frame) return;
    const normalized = String(text ?? "").trim();
    frame.dataset.dashboardDefaultDetail = normalized;
    const detail = dashboardDetailForFrame(frame);
    if (!detail) return;
    dashboardWriteDetail(detail, normalized);
  }

  function dashboardShowTooltip(frame, element) {
    if (!frame || !element) return;
    frame.querySelectorAll(".is-dashboard-active").forEach((target) => {
      if (target !== element) target.classList.remove("is-dashboard-active");
    });
    element.classList.add("is-dashboard-active");
    const detail = dashboardDetailForFrame(frame);
    if (!detail) return;
    dashboardWriteDetail(detail, dashboardTooltipForElement(element));
  }

  function dashboardHideTooltip(frame, element = null) {
    element?.classList.remove("is-dashboard-active");
    frame?.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
    const detail = dashboardDetailForFrame(frame);
    if (detail) {
      const fallback = frame?.dataset?.dashboardDefaultDetail ?? "";
      dashboardWriteDetail(detail, fallback);
    }
  }

  function dashboardBindChartInteractions(frame) {
    if (!frame) return;
    frame.querySelectorAll("[data-dashboard-hit]").forEach((element) => {
      element.setAttribute("tabindex", "0");
      element.addEventListener("pointerenter", () => dashboardShowTooltip(frame, element));
      element.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "touch") dashboardHideTooltip(frame, element);
      });
      element.addEventListener("focus", () => dashboardShowTooltip(frame, element));
      element.addEventListener("blur", () => dashboardHideTooltip(frame, element));
      element.addEventListener("pointerdown", () => dashboardShowTooltip(frame, element));
    });
  }

  function dashboardDateDetail(date, details) {
    const prefix = `${date} `;
    const compact = details
      .map((detail) => String(detail ?? "").trim())
      .filter(Boolean)
      .map((detail) => detail.startsWith(prefix) ? detail.slice(prefix.length) : detail)
      .filter((detail, index, values) => values.indexOf(detail) === index);
    return `${date}${compact.length ? `　${compact.join("；")}` : "　暂无数据"}`;
  }

  function dashboardBindTimeSeriesInteractions(frame, svg, groups, plotTop, plotBottom) {
    const plotScroll = frame?.querySelector(".dashboard-plot-scroll");
    if (!plotScroll || !svg || !groups.length) return;
    const crosshair = document.createElementNS("http://www.w3.org/2000/svg", "line");
    crosshair.classList.add("dashboard-crosshair");
    crosshair.setAttribute("y1", String(plotTop));
    crosshair.setAttribute("y2", String(plotBottom));
    crosshair.setAttribute("aria-hidden", "true");
    crosshair.setAttribute("visibility", "hidden");
    const svgTitle = svg.querySelector(":scope > title");
    if (svgTitle) svgTitle.after(crosshair);
    else svg.prepend(crosshair);
    const ordered = [...groups].sort((left, right) => left.x - right.x);
    const defaultGroup = ordered.at(-1);
    dashboardSetDefaultDetail(frame, defaultGroup?.detail ?? "");

    const clearSelection = () => {
      frame.querySelectorAll(".is-dashboard-active").forEach((element) => element.classList.remove("is-dashboard-active"));
      crosshair.setAttribute("visibility", "hidden");
      dashboardHideTooltip(frame);
    };
    const selectGroup = (group) => {
      if (!group) return;
      frame.querySelectorAll(".is-dashboard-active").forEach((element) => element.classList.remove("is-dashboard-active"));
      svg.querySelectorAll(`[data-dashboard-index="${group.index}"]`).forEach((element) => {
        if (element.matches(".dashboard-bar, .dashboard-point, .dashboard-target-line")) {
          element.classList.add("is-dashboard-active");
        }
      });
      crosshair.setAttribute("x1", String(group.x));
      crosshair.setAttribute("x2", String(group.x));
      crosshair.removeAttribute("visibility");
      const detail = dashboardDetailForFrame(frame);
      if (detail) {
        dashboardWriteDetail(detail, group.detail);
      }
    };
    const groupAtClientX = (clientX) => {
      const bounds = svg.getBoundingClientRect();
      const viewBox = svg.viewBox?.baseVal;
      if (!bounds.width || !viewBox?.width) return null;
      const x = viewBox.x + (clientX - bounds.left) / bounds.width * viewBox.width;
      let nearest = ordered[0];
      let nearestDistance = Math.abs(x - nearest.x);
      ordered.slice(1).forEach((group) => {
        const distance = Math.abs(x - group.x);
        if (distance < nearestDistance) {
          nearest = group;
          nearestDistance = distance;
        }
      });
      const nearestIndex = ordered.indexOf(nearest);
      const previousGap = nearestIndex > 0 ? nearest.x - ordered[nearestIndex - 1].x : null;
      const nextGap = nearestIndex < ordered.length - 1 ? ordered[nearestIndex + 1].x - nearest.x : null;
      const localGap = Math.max(32, previousGap ?? nextGap ?? 64, nextGap ?? previousGap ?? 64);
      return nearestDistance <= localGap * 0.62 ? nearest : null;
    };
    const selectAtClientX = (clientX) => {
      const group = groupAtClientX(clientX);
      if (group) selectGroup(group);
    };

    plotScroll.addEventListener("pointermove", (event) => selectAtClientX(event.clientX));
    plotScroll.addEventListener("pointerdown", (event) => selectAtClientX(event.clientX));
    plotScroll.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") clearSelection();
    });
    plotScroll.addEventListener("touchstart", (event) => {
      if (event.touches[0]) selectAtClientX(event.touches[0].clientX);
    }, { passive: true });
    plotScroll.addEventListener("touchmove", (event) => {
      if (event.touches[0]) selectAtClientX(event.touches[0].clientX);
    }, { passive: true });

    frame.querySelectorAll("[data-dashboard-index]").forEach((element) => {
      if (!element.matches(".dashboard-bar, .dashboard-point, .dashboard-target-line")) return;
      element.setAttribute("tabindex", "0");
      element.addEventListener("focus", () => {
        const group = ordered.find((candidate) => String(candidate.index) === element.dataset.dashboardIndex);
        selectGroup(group);
      });
      element.addEventListener("blur", clearSelection);
    });
  }

  function dashboardEnhanceChart(container, options = {}) {
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll(".dashboard-bar, .dashboard-point, .dashboard-target-line, .dashboard-sankey-flow, .dashboard-sankey-node").forEach((element) => {
      element.dataset.dashboardHit = "true";
    });
    const labels = [...svg.querySelectorAll(".dashboard-y-label")].map((label) => label.textContent);
    svg.querySelectorAll(".dashboard-y-label").forEach((label) => label.remove());
    const frame = document.createElement("div");
    frame.className = "dashboard-chart-frame";
    const leftAxis = document.createElement("div");
    leftAxis.className = "dashboard-axis-rail dashboard-axis-left";
    const rightAxis = document.createElement("div");
    rightAxis.className = "dashboard-axis-rail dashboard-axis-right";
    labels.forEach((label) => {
      const leftLabel = document.createElement("span");
      leftLabel.textContent = label;
      const rightLabel = document.createElement("span");
      rightLabel.textContent = label;
      leftAxis.append(leftLabel);
      rightAxis.append(rightLabel);
    });
    const plotScroll = document.createElement("div");
    plotScroll.className = "dashboard-plot-scroll";
    plotScroll.tabIndex = 0;
    plotScroll.setAttribute("aria-label", "图表，可横向滚动");
    plotScroll.append(svg);
    frame.append(leftAxis, plotScroll, rightAxis);
    container.replaceChildren(frame);
    if (options.groups?.length) {
      dashboardBindTimeSeriesInteractions(
        frame,
        svg,
        options.groups,
        Number(options.plotTop ?? 0),
        Number(options.plotBottom ?? 220),
      );
    } else {
      dashboardBindChartInteractions(frame);
    }
    requestAnimationFrame(() => {
      plotScroll.scrollLeft = plotScroll.scrollWidth;
    });
  }

  function dashboardEnhanceStatusBar(counts, total) {
    if (!dashboardStatusBar || !dashboardStatusLegend) return;
    const clear = () => {
      dashboardStatusBar.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
      dashboardStatusLegend.querySelectorAll(".is-dashboard-active").forEach((target) => target.classList.remove("is-dashboard-active"));
    };
    const show = (status) => {
      clear();
      dashboardStatusBar.querySelector(`[data-dashboard-status="${status}"]`)?.classList.add("is-dashboard-active");
      dashboardStatusLegend.querySelector(`[data-dashboard-status="${status}"]`)?.classList.add("is-dashboard-active");
    };
    dashboardStatusBar.querySelectorAll(".dashboard-status-segment").forEach((segment) => {
      const meta = DASHBOARD_STATUS_META.find((entry) => segment.classList.contains(`dashboard-status-${entry.key}`));
      const value = counts[meta?.key] ?? 0;
      segment.textContent = "";
      segment.dataset.dashboardStatus = meta?.key ?? "";
      segment.setAttribute("tabindex", "0");
      segment.addEventListener("pointerenter", () => show(meta?.key));
      segment.addEventListener("pointerdown", () => show(meta?.key));
      segment.addEventListener("focus", () => show(meta?.key));
      segment.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "touch") clear();
      });
      segment.addEventListener("blur", clear);
    });
    dashboardStatusLegend.querySelectorAll("[data-dashboard-status]").forEach((legendItem) => {
      const status = legendItem.dataset.dashboardStatus;
      legendItem.setAttribute("tabindex", "0");
      legendItem.addEventListener("pointerenter", () => show(status));
      legendItem.addEventListener("pointerdown", () => show(status));
      legendItem.addEventListener("focus", () => show(status));
      legendItem.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "touch") clear();
      });
      legendItem.addEventListener("blur", clear);
    });
  }

  // ─── 图表渲染 ──────────────────────────────────────────────────────────────

  function dashboardRenderStackedBars(container, dates, rows, summary, targetByDate = {}, targetUnitLabel = "义项") {
    if (!container) return;
    if (!dates.length || !rows.some((row) => row.values.some((value) => value > 0))) {
      dashboardSetMarkup(container, dashboardChartEmpty("暂无学习记录"));
      dashboardSetDefaultDetail(container, dates.length ? `${dates.at(-1)}　暂无学习记录` : "暂无学习记录");
      if (summary) summary.textContent = "";
      return;
    }
    const chartWidth = Math.max(620, dates.length * 46);
    const chartHeight = 220;
    const left = 34;
    const bottom = 34;
    const top = 12;
    const plotHeight = chartHeight - top - bottom;
    const maxValue = Math.max(1, ...dates.map((_, index) => rows.reduce((sum, row) => sum + row.values[index], 0)), ...Object.values(targetByDate));
    const barWidth = Math.max(18, Math.min(34, 34 - (dates.length > 42 ? 8 : 0)));
    const groups = [];
    let markup = `<svg class="dashboard-svg" role="img" aria-label="每日学习量堆叠柱状图" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">${dashboardSvgLabel("每日学习量堆叠柱状图")}`;
    markup += `<line class="dashboard-axis" x1="${left}" y1="${top + plotHeight}" x2="${chartWidth - 8}" y2="${top + plotHeight}" />`;
    // The fixed axis rails are laid out in document order from top to bottom.
    // Emit the stacked-bar labels in that same visual order; the plot itself
    // still maps larger values towards the top of the chart.
    [1, 0.5, 0].forEach((ratio) => {
      const y = top + plotHeight - ratio * plotHeight;
      markup += `<line class="dashboard-grid-line" x1="${left}" y1="${y}" x2="${chartWidth - 8}" y2="${y}" /><text class="dashboard-y-label" x="${left - 6}" y="${y + 4}" text-anchor="end">${Math.round(maxValue * ratio)}</text>`;
    });
    dates.forEach((date, index) => {
      let cursor = top + plotHeight;
      const x = left + index * (chartWidth - left - 12) / dates.length + ((chartWidth - left - 12) / dates.length - barWidth) / 2;
      rows.forEach((row) => {
        const value = row.values[index] ?? 0;
        if (value <= 0) return;
        const height = value / maxValue * plotHeight;
        cursor -= height;
        const barTooltip = `${date} ${row.label} ${value}`;
        markup += `<rect class="dashboard-bar dashboard-${row.key}" x="${x.toFixed(1)}" y="${cursor.toFixed(1)}" width="${barWidth}" height="${height.toFixed(1)}" rx="3" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(barTooltip)}"></rect>`;
      });
      const target = Number(targetByDate[date]);
      if (target > 0) {
        const y = top + plotHeight - target / maxValue * plotHeight;
        const targetTooltip = `${date} 计划新学 ${target}`;
        markup += `<line class="dashboard-target-line" x1="${x - 4}" y1="${y.toFixed(1)}" x2="${x + barWidth + 4}" y2="${y.toFixed(1)}" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(targetTooltip)}"></line>`;
      }
      groups.push({
        index,
        x: x + barWidth / 2,
        detail: dashboardDateDetail(date, [
          ...rows.map((row) => `${date} ${row.label}：${row.values[index] ?? 0}`),
          `${date} 计划新学：${Number.isFinite(target) ? target : 0}`,
        ]),
      });
      if (index % (dates.length > 42 ? 7 : dates.length > 21 ? 3 : 1) === 0 || index === dates.length - 1) {
        markup += `<text class="dashboard-axis-label" x="${x + barWidth / 2}" y="${chartHeight - 10}" text-anchor="middle">${dashboardEscape(dashboardDateLabel(date))}</text>`;
      }
    });
    markup += "</svg>";
    dashboardSetMarkup(container, markup);
    dashboardEnhanceChart(container, { groups, plotTop: top, plotBottom: top + plotHeight });
    if (summary) {
      dashboardSetMarkup(summary, rows.map((row) => `<span class="dashboard-summary-item"><i class="dashboard-dot dashboard-${row.key}"></i>${dashboardEscape(row.label)}</span>`).join("") +
        (Object.keys(targetByDate).length ? `<span class="dashboard-summary-item"><i class="dashboard-target-dot"></i>计划新学</span>` : ""));
    }
  }

  function dashboardRenderLineChart(container, dates, series, summary, options = {}) {
    if (!container) return;
    const hasValue = series.some((item) => item.values.some((value) => Number.isFinite(value)));
    if (!dates.length || !hasValue) {
      dashboardSetMarkup(container, dashboardChartEmpty(options.emptyMessage ?? "暂无数据"));
      dashboardSetDefaultDetail(container, dates.length ? `${dates.at(-1)}　暂无数据` : "暂无数据");
      if (summary) dashboardSetMarkup(summary, options.summary ?? "");
      return;
    }
    const chartWidth = Math.max(620, dates.length * 46);
    const chartHeight = 220;
    const left = 34;
    const right = 10;
    const top = 14;
    const bottom = 34;
    const plotWidth = chartWidth - left - right;
    const plotHeight = chartHeight - top - bottom;
    const min = Number.isFinite(options.min) ? options.min : 0;
    const max = Number.isFinite(options.max) ? options.max : Math.max(1, ...series.flatMap((item) => item.values.filter(Number.isFinite)));
    const xFor = (index) => left + (dates.length <= 1 ? 0 : index * plotWidth / (dates.length - 1));
    const yFor = (value) => top + plotHeight - (value - min) / Math.max(1, max - min) * plotHeight;
    const groups = dates.map((date, index) => ({
      index,
      x: xFor(index),
      detail: dashboardDateDetail(date, series.map((item) => {
        if (item.tooltip?.[index]) return item.tooltip[index];
        const label = dashboardDisplayLabel(item.key, item.label);
        const value = item.values[index];
        return `${date} ${label}：${Number.isFinite(value) ? Number(value.toFixed?.(1) ?? value) : "暂无数据"}`;
      })),
    }));
    let markup = `<svg class="dashboard-svg" role="img" aria-label="${dashboardEscape(options.ariaLabel ?? "学习趋势图")}" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">${dashboardSvgLabel(options.ariaLabel ?? "学习趋势图")}`;
    [0, 0.5, 1].forEach((ratio) => {
      const y = top + ratio * plotHeight;
      const value = max - ratio * (max - min);
      markup += `<line class="dashboard-grid-line" x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}" /><text class="dashboard-y-label" x="${left - 6}" y="${y + 4}" text-anchor="end">${dashboardEscape(Number(value.toFixed(1)))}</text>`;
    });
    series.forEach((item) => {
      let segment = [];
      const segments = [];
      item.values.forEach((value, index) => {
        if (Number.isFinite(value)) {
          segment.push(`${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`);
        } else if (segment.length) {
          segments.push(segment);
          segment = [];
        }
      });
      if (segment.length) segments.push(segment);
      segments.filter((points) => points.length > 1).forEach((points) => {
        markup += `<polyline class="dashboard-line dashboard-${item.key}" points="${points.join(" ")}" fill="none" />`;
      });
      item.values.forEach((value, index) => {
        if (!Number.isFinite(value)) return;
        const title = item.tooltip?.[index] ?? `${dates[index]} ${dashboardDisplayLabel(item.key, item.label)} ${value}`;
        markup += `<circle class="dashboard-point dashboard-${item.key}" cx="${xFor(index)}" cy="${yFor(value)}" r="3" data-dashboard-index="${index}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(title)}"></circle>`;
      });
    });
    dates.forEach((date, index) => {
      if (index % (dates.length > 42 ? 7 : dates.length > 21 ? 3 : 1) !== 0 && index !== dates.length - 1) return;
      markup += `<text class="dashboard-axis-label" x="${xFor(index)}" y="${chartHeight - 10}" text-anchor="middle">${dashboardEscape(dashboardDateLabel(date))}</text>`;
    });
    markup += "</svg>";
    dashboardSetMarkup(container, markup);
    dashboardEnhanceChart(container, { groups, plotTop: top, plotBottom: top + plotHeight });
    if (summary) dashboardSetMarkup(summary, series.map((item) => `<span class="dashboard-summary-item"><i class="dashboard-dot dashboard-${item.key}"></i>${dashboardEscape(dashboardDisplayLabel(item.key, item.label))}</span>`).join(""));
  }

  // ─── 数据系列计算 ──────────────────────────────────────────────────────────

  function dashboardActivityValues(bookState, bookWords, dates, unit) {
    const events = dashboardEventEntries(bookState, bookWords);
    const values = { new: [], reinforce: [], review: [] };
    dates.forEach((date) => {
      const activity = normalizeActivityEntry(bookState.activityLog?.[date]);
      const perSegment = { new: new Set(), reinforce: new Set(), review: new Set() };
      events.filter((event) => event.date === date).forEach((event) => {
        const segment = event.source === "review" ? "review"
          : event.source === "reinforcement" ? "reinforce"
            : event.source === "new" || event.source === "extra" || event.source === "advance" ? "new"
              : event.to === SENSE_STATUS.MASTERED && event.from === SENSE_STATUS.NEW ? "new"
                : event.to === SENSE_STATUS.REVIEW ? "reinforce" : null;
        if (segment) perSegment[segment].add(event.senseId);
      });
      if (unit === "word") {
        const wordSets = Object.fromEntries(Object.keys(perSegment).map((key) => [key, new Set()]));
        Object.entries(perSegment).forEach(([segment, keys]) => keys.forEach((key) => wordSets[segment].add(splitSenseKey(key).wordId)));
        if (!wordSets.new.size) activity.newWords.forEach((wordId) => wordSets.new.add(wordId));
        if (!wordSets.review.size) activity.reviewWords.forEach((wordId) => wordSets.review.add(wordId));
        values.new.push(wordSets.new.size);
        values.reinforce.push(wordSets.reinforce.size);
        values.review.push(wordSets.review.size);
        return;
      }
      if (!perSegment.new.size) {
        activity.newWords.forEach((wordId) => {
          const word = bookWords.find((entry) => entry.id === wordId);
          allSenseKeysForWord(word).forEach((key) => {
            const progress = bookState.progress?.[key];
            if (progress?.firstSeenActual === date || progress?.firstSeen === date) perSegment.new.add(key);
          });
        });
      }
      if (!perSegment.review.size) {
        activity.reviewWords.forEach((wordId) => {
          const word = bookWords.find((entry) => entry.id === wordId);
          allSenseKeysForWord(word).forEach((key) => {
            const progress = bookState.progress?.[key];
            if (progress?.lastSeenActual === date || progress?.lastSeen === date) perSegment.review.add(key);
          });
        });
      }
      values.new.push(perSegment.new.size);
      values.reinforce.push(perSegment.reinforce.size);
      values.review.push(perSegment.review.size);
    });
    return values;
  }

  function dashboardPlannedTargets(bookState, bookWords, dates, unit) {
    const targets = {};
    const introducedBeforeDate = (date) => {
      const ids = new Set();
      Object.entries(bookState.activityLog ?? {}).forEach(([entryDate, entry]) => {
        if (entryDate >= date) return;
        normalizeActivityEntry(entry).newWords.forEach((wordId) => ids.add(String(wordId)));
      });
      return ids;
    };
    dates.forEach((date) => {
      const activity = normalizeActivityEntry(bookState.activityLog?.[date]);
      const wordTarget = Math.max(0, Number(activity.target ?? bookState.plan?.dailyTarget ?? 0));
      if (unit === "word") {
        targets[date] = wordTarget;
        return;
      }
      const alreadyIntroduced = introducedBeforeDate(date);
      const plannedWordIds = [];
      activity.newWords.forEach((wordId) => {
        if (plannedWordIds.length < wordTarget && !plannedWordIds.includes(String(wordId))) {
          plannedWordIds.push(String(wordId));
        }
      });
      for (const word of bookWords) {
        if (plannedWordIds.length >= wordTarget) break;
        const wordId = String(word.id);
        if (alreadyIntroduced.has(wordId) || plannedWordIds.includes(wordId)) continue;
        plannedWordIds.push(wordId);
      }
      const senseIds = new Set();
      plannedWordIds.forEach((wordId) => {
        const word = bookWords.find((entry) => String(entry.id) === wordId);
        allSenseKeysForWord(word).forEach((key) => senseIds.add(key));
      });
      targets[date] = senseIds.size;
    });
    return targets;
  }

  function bookIdForState(bookState) {
    return Object.entries(rootState?.bookStates ?? {}).find(([, value]) => value === bookState)?.[0] ?? dashboardBookId ?? activeBookId();
  }

  function dashboardPoolSeries(bookState, bookWords, dates, unit) {
    const snapshots = bookState.dashboardSnapshots ?? {};
    const keys = dashboardSenseKeys(bookWords);
    return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => ({
      key: status,
      label: status === SENSE_STATUS.REINFORCE ? "待强化" : "待复习",
      values: dates.map((date) => {
        const snapshot = snapshots[dashboardSnapshotKey(bookIdForState(bookState), date)];
        if (!snapshot) return null;
        const statusKeys = keys.filter((key) => snapshot.statuses?.[key] === status);
        if (unit === "word") return new Set(statusKeys.map((key) => splitSenseKey(key).wordId)).size;
        return statusKeys.length;
      }),
    }));
  }

  function dashboardConversionSeries(bookState, dates) {
    const events = dashboardEventEntries(bookState, dashboardWords(bookIdForState(bookState)));
    const definitions = [
      ["new-mastered", "新学 → 掌握", SENSE_STATUS.NEW, SENSE_STATUS.MASTERED],
      ["reinforce-review", "强化 → 复习", SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW],
      ["review-mastered", "复习 → 掌握", SENSE_STATUS.REVIEW, SENSE_STATUS.MASTERED],
    ];
    return definitions.map(([key, label, from, to]) => {
      const tooltip = [];
      const values = dates.map((date, index) => {
        const source = new Set(events.filter((event) => event.date === date && event.from === from && event.to === to).map((event) => event.senseId));
        const denominator = new Set(events.filter((event) => event.date === date && event.from === from).map((event) => event.senseId));
        if (denominator.size === 0) {
          tooltip[index] = `${date} ${label}：无可靠分母`;
          return null;
        }
        tooltip[index] = `${date} ${label}：${source.size}/${denominator.size}（${Math.round(source.size / denominator.size * 100)}%）`;
        return source.size / denominator.size * 100;
      });
      return { key, label, values, tooltip };
    });
  }

  function dashboardHoldSeries(bookState, bookWords, dates) {
    const snapshots = bookState.dashboardSnapshots ?? {};
    const bookId = bookIdForState(bookState);
    return [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].map((status) => {
      const tooltip = [];
      const values = dates.map((date, index) => {
        const snapshot = snapshots[dashboardSnapshotKey(bookId, date)];
        if (!snapshot) {
          tooltip[index] = `${date}：暂无数据`;
          return null;
        }
        const keys = dashboardSenseKeys(bookWords).filter((key) => snapshot.statuses?.[key] === status);
        const durations = keys.map((key) => {
          const entered = snapshot.enteredAt?.[key];
          const time = entered ? Date.parse(entered) : NaN;
          const end = Date.parse(snapshot.observedAt);
          return Number.isFinite(time) && Number.isFinite(end) && end >= time ? (end - time) / DAY_MS : null;
        }).filter(Number.isFinite);
        if (!durations.length) {
          tooltip[index] = `${date}：暂无数据`;
          return null;
        }
        const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
        tooltip[index] = `${date} ${status === SENSE_STATUS.REINFORCE ? "强化" : "复习"}：${durations.length}，平均 ${average.toFixed(1)} 天`;
        return average;
      });
      return { key: status === SENSE_STATUS.REINFORCE ? "hold-reinforce" : "hold-review", label: status === SENSE_STATUS.REINFORCE ? "强化停留" : "复习停留", values, tooltip };
    });
  }

  function dashboardSankeyData(bookState, bookWords, start, end) {
    const flows = new Map();
    const uniqueSenseIds = new Set();
    const addFlow = (senseId, from, to) => {
      if (from === to) return;
      const allowed = (from === SENSE_STATUS.NEW && [SENSE_STATUS.REINFORCE, SENSE_STATUS.MASTERED].includes(to)) ||
        (from === SENSE_STATUS.REINFORCE && to === SENSE_STATUS.REVIEW) ||
        (from === SENSE_STATUS.REVIEW && [SENSE_STATUS.MASTERED, SENSE_STATUS.REINFORCE].includes(to));
      if (!allowed) return;
      uniqueSenseIds.add(senseId);
      const flowKey = `${from}|${to}`;
      const flow = flows.get(flowKey) ?? { from, to, senseIds: new Set() };
      flow.senseIds.add(senseId);
      flows.set(flowKey, flow);
    };

    const events = dashboardEventEntries(bookState, bookWords)
      .filter((event) => event.date >= start && event.date <= end);
    events.forEach((event) => addFlow(event.senseId, event.from, event.to));
    if (events.length) {
      return {
        flows: [...flows.values()].map(({ senseIds, ...flow }) => ({ ...flow, count: senseIds.size })),
        uniqueSenseCount: uniqueSenseIds.size,
        insufficient: false,
      };
    }

    const snapshots = bookState.dashboardSnapshots ?? {};
    const bookId = bookIdForState(bookState);
    const startSnapshot = snapshots[dashboardSnapshotKey(bookId, start)];
    const endSnapshot = snapshots[dashboardSnapshotKey(bookId, end)];
    if (!startSnapshot || !endSnapshot) return { flows: [], insufficient: true };
    dashboardSenseKeys(bookWords).forEach((key) => {
      const from = startSnapshot.statuses?.[key] ?? SENSE_STATUS.NEW;
      const to = endSnapshot.statuses?.[key] ?? SENSE_STATUS.NEW;
      addFlow(key, from, to);
    });
    return {
      flows: [...flows.values()].map(({ senseIds, ...flow }) => ({ ...flow, count: senseIds.size })),
      uniqueSenseCount: uniqueSenseIds.size,
      insufficient: false,
    };
  }

  function dashboardRenderStatusBar(bookState, bookWords, unit) {
    if (!dashboardStatusBar || !dashboardStatusLegend) return;
    const counts = dashboardCountStatuses(bookState, bookWords, unit);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    dashboardStatusBar.replaceChildren();
    DASHBOARD_STATUS_META.forEach((meta) => {
      const value = counts[meta.key] ?? 0;
      const segment = document.createElement("span");
      segment.className = `dashboard-status-segment dashboard-status-${meta.key}`;
      segment.style.width = `${total ? value / total * 100 : 0}%`;
      segment.setAttribute("aria-label", `${meta.label} ${value}，${total ? Math.round(value / total * 100) : 0}%`);
      segment.textContent = "";
      dashboardStatusBar.append(segment);
    });
    dashboardStatusBar.setAttribute("aria-label", `词书状态：${DASHBOARD_STATUS_META.map((meta) => `${meta.label} ${counts[meta.key] ?? 0}`).join("，")}`);
    dashboardSetMarkup(dashboardStatusLegend, DASHBOARD_STATUS_META.map((meta) => `<span class="dashboard-legend-item" data-dashboard-status="${meta.key}"><i class="dashboard-status-swatch dashboard-status-${meta.key}"></i>${meta.label} ${counts[meta.key] ?? 0}（${total ? Math.round((counts[meta.key] ?? 0) / total * 100) : 0}%）</span>`).join(""));
    dashboardEnhanceStatusBar(counts, total);
  }

  // ─── Sankey ────────────────────────────────────────────────────────────────

  function dashboardSankeyRouteMeta(from, to) {
    if (from === SENSE_STATUS.NEW && to === SENSE_STATUS.MASTERED) {
      return { lane: "direct", sourceOrder: 0, targetOrder: 0 };
    }
    if (from === SENSE_STATUS.REINFORCE && to === SENSE_STATUS.REVIEW) {
      return { lane: "forward", sourceOrder: 0, targetOrder: 0 };
    }
    if (from === SENSE_STATUS.REVIEW && to === SENSE_STATUS.REINFORCE) {
      return { lane: "return", sourceOrder: 1, targetOrder: 0 };
    }
    if (from === SENSE_STATUS.REVIEW && to === SENSE_STATUS.MASTERED) {
      return { lane: "forward", sourceOrder: 0, targetOrder: 1 };
    }
    return { lane: "forward", sourceOrder: 1, targetOrder: 0 };
  }

  function dashboardSankeyLayout(flows) {
    const nodeDefinitions = [
      { id: SENSE_STATUS.NEW, status: SENSE_STATUS.NEW, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.NEW], column: 0 },
      { id: SENSE_STATUS.REINFORCE, status: SENSE_STATUS.REINFORCE, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.REINFORCE], column: 1 },
      { id: SENSE_STATUS.REVIEW, status: SENSE_STATUS.REVIEW, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.REVIEW], column: 2 },
      { id: SENSE_STATUS.MASTERED, status: SENSE_STATUS.MASTERED, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED], column: 3 },
      { id: "reinforce-return", status: SENSE_STATUS.REINFORCE, x: DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED], column: 3 },
    ];
    const layouts = flows.map((flow) => ({
      ...flow,
      key: `${flow.from}|${flow.to}`,
      ...dashboardSankeyRouteMeta(flow.from, flow.to),
      sourceNodeId: flow.from,
      targetNodeId: flow.from === SENSE_STATUS.REVIEW && flow.to === SENSE_STATUS.REINFORCE
        ? "reinforce-return"
        : flow.to,
    }));
    const nodeTraffic = Object.fromEntries(nodeDefinitions.map((node) => [node.id, {
      incoming: 0,
      outgoing: 0,
      incomingFlows: [],
      outgoingFlows: [],
    }]));
    layouts.forEach((flow) => {
      const source = nodeTraffic[flow.sourceNodeId];
      const target = nodeTraffic[flow.targetNodeId];
      source.outgoing += flow.count;
      target.incoming += flow.count;
      source.outgoingFlows.push(flow);
      target.incomingFlows.push(flow);
    });
    const maxTraffic = Math.max(1, ...Object.values(nodeTraffic).map((traffic) => (
      Math.max(traffic.incoming, traffic.outgoing)
    )));
    const unitScale = DASHBOARD_SANKEY_MAX_NODE_HEIGHT / maxTraffic;
    layouts.forEach((flow) => {
      flow.thickness = Math.max(4, flow.count * unitScale);
    });
    const sideHeight = (items) => items.reduce((sum, flow) => sum + flow.thickness, 0) +
      Math.max(0, items.length - 1) * DASHBOARD_SANKEY_FLOW_GAP;
    const nodes = nodeDefinitions.map((definition) => {
      const traffic = nodeTraffic[definition.id];
      traffic.outgoingFlows.sort((left, right) => left.sourceOrder - right.sourceOrder);
      traffic.incomingFlows.sort((left, right) => left.targetOrder - right.targetOrder);
      return {
        ...definition,
        incoming: traffic.incoming,
        outgoing: traffic.outgoing,
        incomingFlows: traffic.incomingFlows,
        outgoingFlows: traffic.outgoingFlows,
        value: Math.max(traffic.incoming, traffic.outgoing),
        height: Math.max(12, sideHeight(traffic.incomingFlows), sideHeight(traffic.outgoingFlows)),
      };
    });
    const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
    [SENSE_STATUS.NEW].forEach((id) => {
      nodeById[id].y = 92 - nodeById[id].height / 2;
    });
    [SENSE_STATUS.REINFORCE, SENSE_STATUS.REVIEW].forEach((id) => {
      nodeById[id].y = 188 - nodeById[id].height / 2;
    });
    const finalNodes = [nodeById[SENSE_STATUS.MASTERED], nodeById["reinforce-return"]]
      .filter((node) => node.value > 0);
    const finalGap = 22;
    const finalHeight = finalNodes.reduce((sum, node) => sum + node.height, 0) +
      Math.max(0, finalNodes.length - 1) * finalGap;
    let finalY = Math.max(22, 130 - finalHeight / 2);
    finalNodes.forEach((node) => {
      node.y = finalY;
      finalY += node.height + finalGap;
    });
    nodes.filter((node) => !Number.isFinite(node.y)).forEach((node) => {
      node.y = 188 - node.height / 2;
    });
    nodes.forEach((node) => {
      const assign = (items, endpoint) => {
        const height = sideHeight(items);
        let cursorY = node.y + (node.height - height) / 2;
        items.forEach((flow) => {
          if (endpoint === "source") flow.sourceTop = cursorY;
          else flow.targetTop = cursorY;
          cursorY += flow.thickness + DASHBOARD_SANKEY_FLOW_GAP;
        });
      };
      assign(node.outgoingFlows, "source");
      assign(node.incomingFlows, "target");
    });
    return { flows: layouts, nodes };
  }

  function dashboardSankeyBandPath(flow) {
    const sourceX = DASHBOARD_SANKEY_STATIONS[flow.from] + DASHBOARD_SANKEY_NODE_WIDTH / 2;
    const targetX = (flow.targetNodeId === "reinforce-return"
      ? DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED]
      : DASHBOARD_SANKEY_STATIONS[flow.to]) - DASHBOARD_SANKEY_NODE_WIDTH / 2;
    const span = targetX - sourceX;
    const firstControlX = sourceX + span * 0.44;
    const secondControlX = targetX - span * 0.44;
    const sourceBottom = flow.sourceTop + flow.thickness;
    const targetBottom = flow.targetTop + flow.thickness;
    return `M ${sourceX} ${flow.sourceTop} C ${firstControlX} ${flow.sourceTop}, ${secondControlX} ${flow.targetTop}, ${targetX} ${flow.targetTop} L ${targetX} ${targetBottom} C ${secondControlX} ${targetBottom}, ${firstControlX} ${sourceBottom}, ${sourceX} ${sourceBottom} Z`;
  }

  function dashboardSankeyMotionPath(flow) {
    const sourceX = DASHBOARD_SANKEY_STATIONS[flow.from] + DASHBOARD_SANKEY_NODE_WIDTH / 2;
    const targetX = (flow.targetNodeId === "reinforce-return"
      ? DASHBOARD_SANKEY_STATIONS[SENSE_STATUS.MASTERED]
      : DASHBOARD_SANKEY_STATIONS[flow.to]) - DASHBOARD_SANKEY_NODE_WIDTH / 2;
    const sourceY = flow.sourceTop + flow.thickness / 2;
    const targetY = flow.targetTop + flow.thickness / 2;
    const span = targetX - sourceX;
    return `M ${sourceX} ${sourceY} C ${sourceX + span * 0.44} ${sourceY}, ${targetX - span * 0.44} ${targetY}, ${targetX} ${targetY}`;
  }

  function dashboardEnableSankeyPanZoom(frame, canvas, svg) {
    const controller = new AbortController();
    const signal = controller.signal;
    const baseWidth = DASHBOARD_SANKEY_SIZE.width;
    const baseHeight = DASHBOARD_SANKEY_SIZE.height;
    const mobile = frame.clientWidth <= 560;
    const fitScale = Math.min(
      Math.max(0.1, (frame.clientWidth - 20) / baseWidth),
      Math.max(0.1, (frame.clientHeight - 20) / baseHeight),
    );
    const initialScale = Math.min(mobile ? 1.5 : 1.25, fitScale);
    const minScale = Math.max(0.1, initialScale * 0.82);
    const maxScale = mobile ? 1.5 : 1.4;
    let scale = initialScale;
    let panX = 0;
    let panY = 0;
    let drag = null;

    const clampPan = () => {
      const padding = 10;
      const scaledWidth = baseWidth * scale;
      const scaledHeight = baseHeight * scale;
      if (scaledWidth <= frame.clientWidth - padding * 2) {
        panX = (frame.clientWidth - scaledWidth) / 2;
      } else {
        panX = Math.min(padding, Math.max(frame.clientWidth - scaledWidth - padding, panX));
      }
      if (scaledHeight <= frame.clientHeight - padding * 2) {
        panY = (frame.clientHeight - scaledHeight) / 2;
      } else {
        panY = Math.min(padding, Math.max(frame.clientHeight - scaledHeight - padding, panY));
      }
    };

    const applyTransform = () => {
      clampPan();
      canvas.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
      frame.dataset.sankeyScale = scale.toFixed(3);
      frame.dataset.sankeyMinScale = minScale.toFixed(3);
      frame.dataset.sankeyMaxScale = maxScale.toFixed(3);
    };

    const resetTransform = () => {
      scale = initialScale;
      panX = (frame.clientWidth - baseWidth * scale) / 2;
      panY = (frame.clientHeight - baseHeight * scale) / 2;
      applyTransform();
    };

    const zoomTo = (nextScale) => {
      const clampedScale = Math.min(maxScale, Math.max(minScale, nextScale));
      const centerX = frame.clientWidth / 2;
      const centerY = frame.clientHeight / 2;
      const contentX = (centerX - panX) / scale;
      const contentY = (centerY - panY) / scale;
      scale = clampedScale;
      panX = centerX - contentX * scale;
      panY = centerY - contentY * scale;
      applyTransform();
    };

    const controls = document.createElement("div");
    controls.className = "dashboard-sankey-controls";
    controls.setAttribute("aria-label", "流转图缩放控制");
    [
      ["缩小流转图", "−", () => zoomTo(scale / 1.2)],
      ["复位流转图", "↺", resetTransform],
      ["放大流转图", "+", () => zoomTo(scale * 1.2)],
    ].forEach(([label, text, handler]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dashboard-sankey-control";
      button.setAttribute("aria-label", label);
      button.textContent = text;
      button.addEventListener("click", handler, { signal });
      controls.append(button);
    });
    const hint = document.createElement("span");
    hint.className = "dashboard-sankey-gesture-hint";
    hint.textContent = "拖动或缩放查看";
    frame.append(controls, hint);
    frame.tabIndex = 0;
    frame.setAttribute("aria-label", "义项状态流转图，可拖动，并可使用加减按钮缩放");

    frame.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".dashboard-sankey-controls")) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
      frame.setPointerCapture(event.pointerId);
      frame.classList.add("is-dragging");
    }, { signal });
    frame.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      panX = drag.panX + event.clientX - drag.x;
      panY = drag.panY + event.clientY - drag.y;
      applyTransform();
    }, { signal });
    const finishDrag = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      frame.classList.remove("is-dragging");
      if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
    };
    frame.addEventListener("pointerup", finishDrag, { signal });
    frame.addEventListener("pointercancel", finishDrag, { signal });
    frame.addEventListener("dblclick", resetTransform, { signal });
    frame.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { signal, passive: false });
    frame.addEventListener("keydown", (event) => {
      if (event.target !== frame) return;
      const step = 28;
      if (event.key === "+" || event.key === "=") zoomTo(scale * 1.2);
      else if (event.key === "-") zoomTo(scale / 1.2);
      else if (event.key === "Home") resetTransform();
      else if (event.key === "ArrowLeft") panX += step;
      else if (event.key === "ArrowRight") panX -= step;
      else if (event.key === "ArrowUp") panY += step;
      else if (event.key === "ArrowDown") panY -= step;
      else return;
      event.preventDefault();
      applyTransform();
    }, { signal });

    const resizeObserver = new ResizeObserver(() => applyTransform());
    resizeObserver.observe(frame);
    resetTransform();
    dashboardSankeyCleanup = () => {
      controller.abort();
      resizeObserver.disconnect();
    };
  }

  function dashboardRenderSankey(bookState, bookWords, start, end) {
    dashboardSankeyCleanup?.();
    dashboardSankeyCleanup = null;
    const data = dashboardSankeyData(bookState, bookWords, start, end);
    if (data.insufficient || !data.flows.length) {
      dashboardSetMarkup(
        dashboardSankeyChart,
        dashboardChartEmpty(data.insufficient ? "暂无数据" : "所选时间暂无状态变化"),
      );
      dashboardSetDefaultDetail(
        dashboardSankeyChart,
        data.insufficient ? `${start} 至 ${end}　暂无数据` : `${start} 至 ${end}　暂无状态变化`,
      );
      dashboardSankeySummary.textContent = "";
      return;
    }
    const sourceTotals = data.flows.reduce((totals, flow) => {
      totals[flow.from] = (totals[flow.from] ?? 0) + flow.count;
      return totals;
    }, {});
    const layout = dashboardSankeyLayout(data.flows);
    const statusColors = { new: "#68727d", reinforce: "#c77d2d", review: "#0f766e", mastered: "#16a34a" };
    let markup = `<svg class="dashboard-svg dashboard-sankey-svg" role="img" aria-label="义项状态流转流水线" viewBox="0 0 ${DASHBOARD_SANKEY_SIZE.width} ${DASHBOARD_SANKEY_SIZE.height}" width="${DASHBOARD_SANKEY_SIZE.width}" height="${DASHBOARD_SANKEY_SIZE.height}" aria-describedby="dashboardSankeySummary">`;
    markup += `<defs><filter id="dashboardSankeyParticleGlow" x="-250%" y="-250%" width="600%" height="600%"><feGaussianBlur stdDeviation="2.2" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>`;
    layout.flows.forEach((flow, flowIndex) => {
      const percent = Math.round(flow.count / sourceTotals[flow.from] * 100);
      const fromLabel = dashboardDisplayLabel(flow.from, flow.from);
      const toLabel = dashboardDisplayLabel(flow.to, flow.to);
      const label = `${fromLabel} → ${toLabel}：${flow.count} 个义项（占${fromLabel}流出 ${percent}%）`;
      const bandPath = dashboardSankeyBandPath(flow);
      const motionPath = dashboardSankeyMotionPath(flow);
      markup += `<path class="dashboard-sankey-flow dashboard-status-${flow.from}" data-flow-from="${flow.from}" data-flow-to="${flow.to}" data-flow-target-node="${flow.targetNodeId}" data-flow-lane="${flow.lane}" data-flow-source-top="${flow.sourceTop.toFixed(3)}" data-flow-target-top="${flow.targetTop.toFixed(3)}" data-flow-count="${flow.count}" data-flow-thickness="${flow.thickness.toFixed(3)}" d="${bandPath}" fill="${statusColors[flow.from]}" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(label)}"></path>`;
      const particleCount = flow.thickness >= 28 ? 4 : 3;
      const duration = 3.2 + flowIndex * 0.16;
      markup += `<g class="dashboard-sankey-particles" aria-hidden="true">`;
      for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
        const begin = -(duration * particleIndex / particleCount);
        const radius = 1.5 + (particleIndex % 3) * 0.45;
        markup += `<circle class="dashboard-sankey-particle" r="${radius.toFixed(2)}" fill="${statusColors[flow.from]}" filter="url(#dashboardSankeyParticleGlow)"><animate attributeName="opacity" values="0;0.78;0.5;0" keyTimes="0;0.14;0.84;1" dur="${duration.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"></animate><animateMotion path="${motionPath}" dur="${duration.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"></animateMotion></circle>`;
      }
      markup += `</g>`;
    });
    layout.nodes.forEach((node) => {
      if (!node?.value) return;
      const status = node.status;
      const label = dashboardDisplayLabel(status, status);
      const nodeTooltip = `${label}：${node.value}（流入 ${node.incoming}，流出 ${node.outgoing}）`;
      const terminal = node.column === 3;
      const labelBelow = !terminal && (
        status === SENSE_STATUS.REINFORCE || status === SENSE_STATUS.REVIEW
      );
      const labelX = terminal ? node.x + 18 : node.x;
      const labelY = terminal
        ? node.y + node.height / 2 + 6
        : labelBelow
          ? node.y + node.height + 24
          : Math.max(24, node.y - 14);
      markup += `<rect class="dashboard-sankey-node dashboard-status-${status}" data-node-id="${node.id}" data-dashboard-status="${status}" data-node-value="${node.value}" data-node-incoming="${node.incoming}" data-node-outgoing="${node.outgoing}" x="${node.x - DASHBOARD_SANKEY_NODE_WIDTH / 2}" y="${node.y.toFixed(3)}" width="${DASHBOARD_SANKEY_NODE_WIDTH}" height="${node.height.toFixed(3)}" rx="4" data-dashboard-hit="true" data-dashboard-tooltip="${dashboardEscape(nodeTooltip)}"></rect>`;
      markup += `<text class="dashboard-sankey-label" data-label-status="${status}" data-label-node="${node.id}" x="${labelX}" y="${labelY.toFixed(3)}" text-anchor="${terminal ? "start" : "middle"}">${dashboardEscape(label)}</text>`;
    });
    markup += "</svg>";
    dashboardSetMarkup(dashboardSankeyChart, markup);
    const svg = dashboardSankeyChart.querySelector("svg");
    if (svg) {
      const frame = document.createElement("div");
      frame.className = "dashboard-sankey-frame";
      const canvas = document.createElement("div");
      canvas.className = "dashboard-sankey-canvas";
      canvas.append(svg);
      frame.append(canvas);
      dashboardSankeyChart.replaceChildren(frame);
      dashboardBindChartInteractions(frame);
      dashboardEnableSankeyPanZoom(frame, canvas, svg);
      dashboardSetDefaultDetail(frame, `${start} 至 ${end}　${data.uniqueSenseCount} 个义项发生状态流转`);
    }
    dashboardSetMarkup(
      dashboardSankeySummary,
      `<table class="dashboard-accessible-table"><caption>状态流转明细</caption><thead><tr><th>起始</th><th>结束</th><th>义项数</th><th>起始状态占比</th></tr></thead><tbody>${data.flows.map((flow) => `<tr><td>${dashboardEscape(dashboardDisplayLabel(flow.from, flow.from))}</td><td>${dashboardEscape(dashboardDisplayLabel(flow.to, flow.to))}</td><td>${flow.count}</td><td>${Math.round(flow.count / sourceTotals[flow.from] * 100)}%</td></tr>`).join("")}</tbody></table>`,
    );
  }

  // ─── 公开 API ──────────────────────────────────────────────────────────────
  // renderDashboard 保留在 app.js（编排器，读写 app.js 模块级变量），
  // 通过 window.SenseVocabDashboard 调用本模块的渲染函数。

  window.SenseVocabDashboard = Object.freeze({
    DASHBOARD_STATUS_META,
    DASHBOARD_SANKEY_SIZE,
    DASHBOARD_SANKEY_NODE_WIDTH,
    DASHBOARD_SANKEY_MAX_NODE_HEIGHT,
    DASHBOARD_SANKEY_FLOW_GAP,
    DASHBOARD_SANKEY_STATIONS,
    dashboardBookState,
    dashboardWords,
    dashboardDateList,
    dashboardSenseKeys,
    dashboardStatusForKey,
    dashboardWordStatus,
    dashboardCountStatuses,
    dashboardEventEntries,
    dashboardDateLabel,
    dashboardEscape,
    dashboardSvgLabel,
    dashboardDisplayLabel,
    dashboardApplyUserCopy,
    dashboardChartEmpty,
    dashboardSetMarkup,
    dashboardTooltipForElement,
    dashboardDetailForFrame,
    dashboardWriteDetail,
    dashboardSetDefaultDetail,
    dashboardShowTooltip,
    dashboardHideTooltip,
    dashboardBindChartInteractions,
    dashboardDateDetail,
    dashboardBindTimeSeriesInteractions,
    dashboardEnhanceChart,
    dashboardEnhanceStatusBar,
    dashboardRenderStackedBars,
    dashboardRenderLineChart,
    dashboardActivityValues,
    dashboardPlannedTargets,
    bookIdForState,
    dashboardPoolSeries,
    dashboardConversionSeries,
    dashboardHoldSeries,
    dashboardSankeyData,
    dashboardRenderStatusBar,
    dashboardSankeyRouteMeta,
    dashboardSankeyLayout,
    dashboardSankeyBandPath,
    dashboardSankeyMotionPath,
    dashboardEnableSankeyPanZoom,
    dashboardRenderSankey,
  });
