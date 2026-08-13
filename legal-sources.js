(() => {
  const summary = document.querySelector("#sourceCatalogSummary");
  const search = document.querySelector("#sourceCatalogSearch");
  const kind = document.querySelector("#sourceCatalogKind");
  const status = document.querySelector("#sourceCatalogStatus");
  const list = document.querySelector("#sourceCatalogList");
  const loadMore = document.querySelector("#sourceCatalogMore");
  if (!summary || !search || !kind || !status || !list || !loadMore) return;

  const PAGE_SIZE = 30;
  let catalog = null;
  let visibleCount = PAGE_SIZE;

  function link(label, href) {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    return anchor;
  }

  function row(label, value) {
    if (!value) return null;
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    if (value instanceof Node) detail.append(value);
    else detail.textContent = value;
    wrapper.append(term, detail);
    return wrapper;
  }

  function entrySearchText(entry) {
    return [
      entry.id,
      entry.kind,
      entry.provider,
      entry.sourceId,
      entry.author,
      entry.license,
      entry.sourcePage,
      ...entry.references.flatMap((item) => [
        item.contentId,
        item.wordId,
        item.senseId,
      ]),
    ].filter(Boolean).join(" ").toLocaleLowerCase();
  }

  function filteredEntries() {
    const query = search.value.trim().toLocaleLowerCase();
    return catalog.entries.filter((entry) => {
      if (kind.value !== "all" && entry.kind !== kind.value) return false;
      return !query || entrySearchText(entry).includes(query);
    });
  }

  function renderEntry(entry) {
    const details = document.createElement("details");
    details.className = "source-entry";
    const heading = document.createElement("summary");
    const primaryReference = entry.references[0]?.contentId ?? entry.id;
    heading.textContent = `${entry.kind === "audio" ? "录音" : "例句"} · ${primaryReference} · ${entry.provider}`;

    const description = document.createElement("dl");
    const rows = [
      row("作者/署名方", entry.author),
      row("作者状态", entry.authorStatus),
      row("许可证", link(entry.license, entry.licenseUrl)),
      row("直接来源", link("打开来源页", entry.sourcePage)),
      row("历史记录", entry.historyPage ? link("打开历史页", entry.historyPage) : null),
      row("版权与署名规则", entry.copyrightPage
        ? link("查看适用规则", entry.copyrightPage)
        : null),
      row("特殊署名说明", entry.specialAttribution),
      row("修改说明", entry.modification),
      row("权利状态", entry.rightsStatus),
    ].filter(Boolean);
    description.append(...rows);

    const references = document.createElement("p");
    references.className = "source-entry-references";
    references.textContent = `关联内容 ID（${entry.references.length}）：${entry.references
      .map((item) => item.contentId).join("、")}`;
    details.append(heading, description, references);
    return details;
  }

  function render() {
    const filtered = filteredEntries();
    const visible = filtered.slice(0, visibleCount);
    list.replaceChildren(...visible.map(renderEntry));
    status.textContent = `共找到 ${filtered.length.toLocaleString("zh-CN")} 项，当前显示 ${visible.length.toLocaleString("zh-CN")} 项。`;
    loadMore.hidden = visible.length >= filtered.length;
  }

  function resetAndRender() {
    visibleCount = PAGE_SIZE;
    render();
  }

  async function initialize() {
    try {
      const response = await fetch("./data/public-attributions.json", {
        cache: "no-cache",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
      const counts = catalog.summary;
      summary.textContent = [
        `${counts.audioBindings.toLocaleString("zh-CN")} 个音频绑定已按 URL 去重为 ${counts.audioAssets.toLocaleString("zh-CN")} 项`,
        `${counts.tatoebaBindings.toLocaleString("zh-CN")} 个 Tatoeba 绑定已去重为 ${counts.tatoebaAssets.toLocaleString("zh-CN")} 项`,
        `${counts.wiktionaryBindings.toLocaleString("zh-CN")} 个 Wiktionary/Kaikki 绑定已去重为 ${counts.wiktionaryAssets.toLocaleString("zh-CN")} 项`,
      ].join("；") + "。";
      const query = new URL(window.location.href).searchParams.get("q");
      if (query) search.value = query;
      search.disabled = false;
      kind.disabled = false;
      render();
    } catch (error) {
      status.textContent = `来源目录加载失败：${error.message}`;
      status.classList.add("is-error");
    }
  }

  search.addEventListener("input", resetAndRender);
  kind.addEventListener("change", resetAndRender);
  loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });
  initialize();
})();
