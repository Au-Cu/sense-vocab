# Sense Vocab 重构计划

> 状态：2026-08-29 制定，2026-09-04 重新摸底更新 P5。fork 已 rebase 到上游 v1.10.0，全量测试 143 passed / 0 failed。
> 本文件是详细执行计划；CLAUDE.md 的「重构进度」章节是概览入口。

## 背景与目标

本 fork 已 rebase 到上游 v1.10.0（`Au-Cu/sense-vocab`，v1.3.0→v1.10.0 共 24 commits、+118k 行）。上游一次性塞进大量新代码，把 app.js 从 ~4300 行顶到 **~7500 行**。P4 已抽离 dashboard 子系统（−1143 行），当前 app.js 为 **6352 行**，结构债务仍显著：

- **双份字段清单**（✅ P3 已解决，2026-09-04）：原 app.js `mirroredKeys` 与 sync-state.js `MIRRORED_SCOPE_KEYS` 各自维护。现已统一为 sync-state.js 的 `mirroredScopeKeys` 单源。
- **dashboard 子系统**（✅ P4 已完成，2026-09-04）：43 个纯渲染函数 + 常量已搬入 [dashboard.js](dashboard.js)，残留 ~222 行数据采集 + 编排器仍驻 app.js。
- **app.js 剩余主体**（6352 行）：词库加载（~327）/ 存储序列化（~733）/ 音频（~210）/ 热力图（~149）/ 易混词地球（~517）/ 词列表（~165）/ 学习引擎 / UI 渲染 / 事件路由全在同一词法作用域，互相通过模块级 `let`/`const`（`state`/`rootState`/`words`/DOM 常量）耦合。

**目标**：渐进式消解巨石。每步独立提交、全量测试通过。**先做低风险快赢（P3）建立信心**，再大块减负（P4），最后渐进拆分（P5 长期）。

## 执行顺序总览

| 顺序 | 项 | 预估改动 | 风险 | 状态 |
|------|----|---------|------|------|
| 1 | P3 统一镜像字段列表 | ~2 文件、几行 | 极低 | ✅ 已完成（2026-09-04，143/143 全绿） |
| 2 | P4 抽离 dashboard | 新文件 ~1226 行搬运（原估 3400） | 中（renderHome 链路） | ✅ 已完成（2026-09-04，app.js 7494→6352，−1143 行，143/143 全绿） |
| 3 | P5-A 基础设施（工具函数 + 事件绑定） | ~337 行，2 个新文件 | 低 | ⬜ 待做 |
| 4 | P5-B 低耦合渲染块（热力图 + 音频） | ~320 行，2 个新文件 | 低→中 | ⬜ 待做 |
| 5 | P5-C 数据/存储层（词库 + 序列化） | ~1060 行，2 个新文件 | 中→高 | ⬜ 待做 |
| 6 | P5-D 中等耦合 UI（词列表 + 易混词 + 学习流） | ~1334 行，3 个新文件 | 中 | ⬜ 待做 |
| 7 | P5-E 核心拆分（转场 + 计划 + 学习引擎/渲染） | ~411 行 + 留最后 | 中→高 | ⬜ 待做 |

**P5 总目标**：app.js 6352 → ~2890 行（−3462 行，−54%），剩余为核心学习引擎 + 主渲染。

---

## 阶段一：P3 统一镜像字段列表（✅ 已完成，2026-09-04）

### 现状（调研确认）

- app.js `normalizeRootState()` 内 `mirroredKeys`（[app.js:950-966](app.js#L950)），**仅此一处使用**（标识符只出现在 950/967/969 三行，全在 `normalizeRootState` 函数体内）。
- sync-state.js `MIRRORED_SCOPE_KEYS`（[sync-state.js:868-884](sync-state.js#L868)），被 `mirroredScope()`（886-891）和 `asRootState()`（893-916）使用。
- 两份清单**逐项完全一致**（15 项、顺序相同）：`view, plan, session, introducedWords, progress, activityLog, studyWindows, dashboardEvents, dashboardSnapshots, confusionLinks, learningDayCounter, wordListSort, wordBrowse, dataVersion, _sync`。目前无漂移——风险是"未来的"。
- `compactLocalState()`（app.js:986-1003）靠 `{...activeScope}` 整对象展开平铺，**不依赖**这份清单，不用改。
- `encodeLocalStorageScope`（1750-1758）只处理 `dashboardSnapshots` 单字段，不用改。
- `stateSignature`（1865-1878）/`recoveryStateSignature`（1880-1906）是独立硬编码字段子集，**本次不统一**（见「后续可选项」）。
- account.js / admin.js **无第三份清单**（只读数据字段，非定义）。

### 方案（推荐：单源导出）

1. **sync-state.js**：导出对象（[sync-state.js:1277-1285](sync-state.js#L1277)）加一项：
   ```js
   window.SenseVocabSync = Object.freeze({
     deviceId,
     ensureMetadata,
     stampChanges,
     mergeStates,
     prepareIndependentMergeState,
     hasIndependentChanges,
     compareVectors,
     mirroredScopeKeys: MIRRORED_SCOPE_KEYS,
   });
   ```
2. **app.js**：`normalizeRootState()` 的 `mirroredKeys` 改为：
   ```js
   const mirroredKeys =
     window.SenseVocabSync?.mirroredScopeKeys ?? MIRRORED_KEYS_FALLBACK;
   ```
   并在 app.js 顶层用 `Object.freeze([...])` 定义 `MIRRORED_KEYS_FALLBACK`（即现清单 15 项）。注释注明"以 sync-state.js MIRRORED_SCOPE_KEYS 为事实来源，此为兜底"。

**保留 fallback 的必要性**：若 `window.SenseVocabSync` 缺失（理论极端时序），空数组会导致 `normalizeRootState` 无法把顶层平铺字段注入 bookStates → 静默丢字段。fallback 只作兜底，不是事实来源。

### 加载顺序确认（安全）

index.html 中 sync-state.js（954 行）先于 app.js（955 行）加载；app.js 现有代码全部用 `if (window.SenseVocabSync)` 防御式访问（1101、1987、1991、1995），从未假设其存在。无时序风险。

### 改动文件

- `sync-state.js`（+1 行导出）
- `app.js`（mirroredKeys 替换 + 顶层加 fallback 常量）

### 验证

- 全量 `npx playwright test`（143 全绿为硬门槛）
- 手工：起服务器 → 改一个词的标记 → 刷新 → 确认状态保留（平铺/注入路径正常）
- 顺带确认 sync-concurrency.spec.js（CRDT 合并路径，涉及 asRootState）通过

### 后续可选项（不在本次）

`recoveryStateSignature`（app.js:1887-1894）的 8 字段硬编码子集（plan/introducedWords/progress/activityLog/studyWindows/dashboardEvents/dashboardSnapshots/confusionLinks）与 `mirroredKeys` 同源不同用（它是恢复一致性签名的字段选择，不涉及平铺注入）。可后续考虑从共享清单派生，但语义不同，需单独评估。

### 实际执行结果（2026-09-04）

按计划执行，改动与方案完全一致：

- **sync-state.js**：导出对象加 `mirroredScopeKeys: MIRRORED_SCOPE_KEYS`（[同步-state.js:1286](sync-state.js#L1286)）
- **app.js**：顶层加 `MIRRORED_KEYS_FALLBACK` 冻结常量 15 项（[app.js:175-193](app.js#L175)）；`normalizeRootState()` 内联清单替换为 `window.SenseVocabSync?.mirroredScopeKeys ?? MIRRORED_KEYS_FALLBACK`（[app.js:972-973](app.js#L972)）
- 全量 `npx playwright test` → **143 passed / 0 failed**
- 单一事实来源确立：加 scope 字段只需改 sync-state.js 的 `MIRRORED_SCOPE_KEYS`

---

## 阶段二：P4 抽离 dashboard 子系统（大块减负，~3400 行）—— ✅ 已完成，2026-09-04

### 调研结论（依赖图谱已摸清）

**46 个 dashboard 函数 + 常量，3 个不连续区段**：

| 区段 | 行号 | 内容 |
|------|------|------|
| 主岛 | app.js:3150-4279 | 44 个函数 + `DASHBOARD_STATUS_META`@3143 + `DASHBOARD_SANKEY_*`@4003-4007 |
| 孤岛 1 | 4360 | `renderDashboard()` |
| 孤岛 2 | 6580 | `dashboardKeyForProgress()` |

**外部依赖**（dashboard 引用 app.js 顶层声明，靠全局词法环境可见，无需注入）：
`state`（71 处）、`SENSE_STATUS`（80 处，app.js:17 定义）、`rootState`、`activeBookId()`、`currentDate()`、`currentActivityDate()`、`createState()`、`parseDate()`、`normalizeDashboardMap`、`stableStateStringify`、`isKnownSenseKey`、`requestAnimationFrame`、`getComputedStyle`。

**被外部调用（必须保住的跨模块入口）**：
- `dashboardRecordTransition`（5 处：setProgressMastered 6588 / setProgressPending 6621 / resetCurrentMarking 7102,7113 / relearnCurrentWord 7179）
- `dashboardRecordSnapshot`（1 处：renderHome 4544）
- `renderDashboard`（1 处：renderHome 4548）

**事件绑定**：全部在文件尾部 7306-7485，与其他 app 绑定交织（dashboardButton 7312-7317、dashboardBookSelect/UnitSelect/RangeSelect 7382-7395）。

**渲染触发链**：主 `render()`（3096）只切 panel 可见性，不调 renderDashboard；真正触发是 `renderHome()`（4509）→ 4544 `dashboardRecordSnapshot` + 4548 `renderDashboard`。

### 抽离边界

**搬进新 `dashboard.js`**（约 41 个纯渲染/图表/交互函数）：
- `DASHBOARD_STATUS_META`、`DASHBOARD_SANKEY_*` 常量
- 主岛 3150-4279 中除 `dashboardRecordTransition`(3212)/`dashboardRecordSnapshot`(3237) 外的全部函数
- sankey 渲染系列 4030-4279

**留在 app.js**（数据采集，被学习引擎深度调用）：
- `dashboardRecordTransition`(3212)、`dashboardRecordSnapshot`(3237)、`dashboardKeyForProgress`(6580)

**renderDashboard(4360)**：随数据采集入口留 app.js（被 renderHome 触发、有 saveState 联动），或搬走并由 app 侧 `window.SenseVocabDashboard.render()` 调用——**执行时二选一，倾向留在 app.js 最小化改动**。

### 方案

仿 tutorial.js 抽法：
1. 新建 `dashboard.js`：顶层 IIFE，通过全局词法环境引用 app.js 顶层声明（`state`/`SENSE_STATUS` 等），暴露 `window.SenseVocabDashboard`。
2. `index.html` 在 app.js 之后、account.js 之前加 `<script src="./dashboard.js?v=...">`。
3. 把选定的 ~41 个函数**函数级搬运**过去（注意 2 个孤岛与 renderDashboard 的处理，不能整段剪切）。
4. dashboard 相关的 addEventListener（7312-7317、7382-7395）留在 app.js（它们绑定的是 app.js 的 DOM 常量）。

### 风险与回退

- **最大风险**：dashboard 区段不连续（2 孤岛）+ 数据采集被学习引擎深度调用。搬运后若 `renderHome` 链路断，整个首页挂。
- **策略**：一次只搬纯渲染函数，数据采集 3 个函数不动；搬完立刻全量测试。
- **回退**：dashboard 是新文件，git 可整体 revert 该提交，不碰 app.js 其它逻辑。

### 验证

- 全量测试（dashboard.spec.js 12 个用例必须过）
- 手工：起服务器 → 有学习数据 → 打开看板 → 切换词书/单位/日期范围 → Sankey 缩放拖拽

### 实际执行结果（2026-09-04）

**抽离范围**：46 个函数中 43 个纯渲染函数 + 5 个常量搬入新文件 `dashboard.js`（~1226 行）。

**留在 app.js**（数据采集 + 编排器）：
- `dashboardRecordTransition`（学习引擎 5 处调用）
- `dashboardRecordSnapshot`（renderHome 调用）
- `dashboardKeyForProgress`（setProgressMastered/Pending 调用）
- `renderDashboard`（编排器，读写 app.js 模块级变量 `dashboardBookId`/`dashboardUnit`/`dashboardRangeDays`）
- `dashboardSnapshotKey`（小工具，被 dashboardRecordSnapshot 使用）
- `DASHBOARD_DATA_VERSION`（常量，被 dashboardRecordSnapshot 使用）

**app.js 行数**：7494 → 6351（**−1143 行**）。

**加载顺序**：index.html 在 app.js 后、tutorial.js 前插入 `<script src="./dashboard.js">`。

**暴露 API**：`window.SenseVocabDashboard`（Object.freeze 冻结），`renderDashboard` 通过 `const D = window.SenseVocabDashboard; D.dashboardXxx(...)` 委托。

**踩坑与修复**：
1. **IIFE 包裹导致全局词法断裂**：初始用 `(function () { ... })();` 包裹 dashboard.js，导致两个问题：
   - `dashboardSankeyCleanup`（app.js `let dashboardSankeyCleanup`）在 dashboard.js 内赋值时创建了新的全局变量，而非引用 app.js 的那个 → Sankey 清理失效
   - 函数体内引用的 app.js 顶层词法变量（`state`、`rootState`、`SENSE_STATUS`、`addDays`、`wordsForBook` 等）在 IIFE 内虽可读写（全局作用域链），但 `dashboardSankeyCleanup` 的跨 script `let` 绑定被破坏
   - **修复**：去掉 IIFE，改为经典 script 模式（和 tutorial.js 一致），所有函数直接声明在全局词法环境

**测试结果**：`npx playwright test` → **143 passed / 0 failed**（dashboard.spec.js 12/12 全绿）。

---

## 阶段三：P5 渐进拆分 app.js 剩余（长期）

> **2026-09-04 重新摸底**：P4 实际抽离 1143 行（原估 ~3400），app.js 实际剩余 **6352 行**（原估 ~4100）。原计划行号全部因 P4 删除而偏移，且原计划**未识别**存储/序列化（~733 行）、易混词地球（~517 行）、词列表（~165 行）三个大块。本节基于 4 个子代理并行摸底的最新行号重写。

### 关键结论（调研，2026-09-04 更新）

**剩余主体无法像 tutorial.js 那样整块剪出**——各块通过模块级词法变量（`state`/`rootState`/`words`/`wordById`/`poolWordById`/`bookById`/`activeStorageKey` + 大量 DOM 常量）共享同一词法环境。tutorial.js 能整块抽出是因为它**从不引用** app.js 词法变量（靠 window 事件 + DOM + 自身 IIFE）；剩余主体不满足此条件。拆分必须先建共享 store，再按内聚度逐个抽。

### app.js 当前结构地图（6352 行，2026-09-04）

| 行范围 | 块 | 行数 | 提取难度 |
|--------|-----|------|---------|
| 1-174 | 常量、配置、`SENSE_STATUS`、搜索同义词表 | ~174 | — |
| 175-196 | `MIRRORED_KEYS_FALLBACK` | ~22 | — |
| 197-340 | DOM 元素引用（const 声明） | ~144 | — |
| 341-398 | 模块级可变变量（let 声明） | ~58 | — |
| **400-726** | **词库加载子系统** | **~327** | 中 |
| 727-881 | 日期/词书/义项工具函数 | ~155 | 低（纯工具） |
| 883-1076 | State 工厂 + 存储 I/O | ~194 | 中 |
| **1078-1810** | **存储层 + 序列化（含 LZ 压缩、编解码）** | **~733** | 中 |
| 1811-2070 | 云同步 + 深度链接 + 日期 | ~260 | 高（与 account.js 耦合） |
| **2072-2388** | **会话/学习日/计划/队列构建** | **~317** | 高 |
| 2389-2424 | 当前词/卡片访问器 | ~36 | 高 |
| 2425-2891 | 学习队列辅助 + 义项选择 | ~467 | 高 |
| **2892-3102** | **UI 转场机制** | **~211** | 中 |
| 3103-3372 | `render()` + dashboard 外壳 | ~270 | 中（含 222 行残留 dashboard） |
| **3374-3545** | **renderHome + 热力图** | **~172** | **低** |
| 3547-3774 | 词列表索引 + 中文搜索 | ~228 | 中 |
| **3775-3910** | **词列表渲染 + 浏览** | **~136** | 中 |
| 3911-4261 | `renderStudy` + 词形变化 | ~351 | 高 |
| 4263-4510 | 学习流 + 浮动对话框 | ~248 | 中 |
| **4511-5027** | **易混词地球（面板 + 渲染 + 转场）** | **~517** | 中 |
| 5028-5232 | 单词卡导航 + 退出学习 + 揭示 | ~205 | 高 |
| **5234-5443** | **音频 + 触觉 + 完成动画** | **~210** | **低→中** |
| 5445-5715 | 进度变更 + nextWord | ~271 | 高 |
| 5716-6078 | 计划对话框 + 重置/重学 | ~363 | 高 |
| 6080-6169 | `initializeApp` | ~90 | 高 |
| **6171-6352** | **事件绑定层** | **~182** | **低** |

### 模块级变量分组（app.js:341-398）

| 组 | 变量 | 行 | 拆分策略 |
|----|------|-----|---------|
| 核心共享 | `state`/`rootState`/`activeStorageKey`(343-355) | 341-355 | 迁入共享 store |
| 词库状态 | `vocabularyBundle`/`vocabularyIndex`/`vocabularySearchRelations`/`vocabularyDetails*`/`vocabularyCatalogAuthoritative` | 345-352 | 随词库迁入 vocabulary.js |
| 音频 | `activeAudio`/`audioPlaybackGeneration`/`lastAutoPlayedCardKey`/`soundContext` | 358-361 | 闭包收纳进 audio.js |
| UI/定时器 | `completionFeedbackTimer`/`wordFitFrame`/`renderedStudyCardKey`/`renderedStudyView`/`studyScrollResetFrame`/`pendingCrossDayReturn`/`midnightRefreshTimer` | 362-368 | 随 UI 渲染 |
| 词列表 | `wordListQuery`/`wordListFilter`/`WORD_LIST_PAGE_SIZE`/`wordListVisibleCount`/`wordListIndexCache`/`wordListIndexRevision` | 369-374 | 闭包收纳进 word-list.js |
| 热力图 | `heatmapPositionedBookId` | 375 | 闭包收纳进 heatmap.js |
| dashboard 残留 | `dashboardBookId`/`dashboardUnit`/`dashboardRangeDays` | 376-378 | 随 dashboard 外壳清理 |
| 账户引导 | `initialGuestHadLearningData` | 379 | 勿删（tutorial.js 依赖） |
| 易混词 | `confusionRuntime`/`confusionGlobe`/`confusionGlobeSignature`/`confusionTransitioning`/`confusionGlobeLoader` | 380-384 | 闭包收纳进 confusion.js |
| 转场 | `activeUiTransition`/`commitActiveUiTransition`/`cleanupActiveUiTransition`/`deferredUiStateSave*` | 385-390 | 随 UI 渲染 |
| 导航 | `studyHierarchyOrigin`/`wordListHierarchyOrigin` | 391-392 | 随 UI 渲染 |
| 权益 | `membershipAccess` | 393-398 | 随账户引导 |

### 拆分顺序（依赖方向 + 内聚度排序，2026-09-04 重排）

#### 阶段 A：基础设施（不动业务逻辑，仅移动代码）

**A1. 共享工具函数 → `app-utils.js`**
- 范围：app.js:727-881（~155 行），含 `activeBookId`/`activeBook`/`bookDisplayName`/`wordsForBook`/`todayKey`/`formatDate`/`parseDate`/`addDays`/`daysBetween`/`senseKey`/`splitSenseKey`/`getSense` 等
- 特性：纯函数或只读全局 Map（`bookById`/`wordById`），无副作用
- 抽法：经典 script，暴露 `window.SenseVocabUtils`，app.js 顶层 `let` 声明改为引用 `window.SenseVocabUtils.activeBookId()` 等
- 风险：低。这些函数被全文件引用，需全局替换调用点
- 减行：~155 行

**A2. 事件绑定层 → `bindAppEvents()`**
- 范围：app.js:6171-6352（~182 行），集中在文件末尾，自包含
- 特性：仅注册 `addEventListener`，调用 handler 函数
- 抽法：把整块提取为 `function bindAppEvents(handlers)` 纯绑定函数，各块把 handler 打包成接口对象传入；或整体搬入 `app-events.js`，在 `initializeApp()` 末尾调用
- 风险：低。只需把 handler 引用改为 `window.SenseVocabXxx.yyy`
- 减行：~182 行

#### 阶段 B：低耦合渲染块（只读共享状态，私有变量可闭包收纳）

**B1. 热力图 → `heatmap.js`**
- 范围：app.js:3432-3545（7 个函数，~114 行）+ DOM 常量 4 个（218-221）+ 私有变量 1 个（375）
- 特性：只读 `state.activityLog`/`state.plan`/`state.studyWindows`；唯一私有变量 `heatmapPositionedBookId`；依赖 4 个 DOM 常量 + 4 个工具函数（`currentDate`/`parseDate`/`formatDate`/`activeBookId`）；5/7 函数仅从 `renderHeatmap` 内部可达
- 外部调用点：`renderHome`@3408（1 处）、`resize` handler@6336（1 处）
- 抽法：经典脚本模式，闭包收纳 `heatmapPositionedBookId`，通过 `window.SenseVocabUtils` 访问工具函数；暴露 `renderHeatmap`/`positionHeatmapAtLatest`
- 风险：低。`resize` handler 需改为 `window.SenseVocabHeatmap.positionHeatmapAtLatest`
- 减行：~120 行

**B2. 音频 + 触觉 → `audio.js`**
- 范围：app.js:2497-2531（`audioRecordingsForWord`，35 行）+ 5234-5443（播放/音效/触觉群，~210 行），分散两段
- 特性：私有变量 4 个（358-361）可闭包收纳；`prefersReducedMotion` 被 UI 动画复用（2933/4400/4425），**不提取**，保留 app.js 作为共享偏好；2 个桥接函数（`maybeAutoPlayCurrentWord`/`speakCurrentWord`）调用学习引擎 `currentWord()`/`currentCardKey()`/`ensureTodaySession()`，需参数注入或回调
- 外部调用点：`playWordAudio`@5056/5349/5357、`playSenseTapSound`@5441/5510/5586、`triggerStudyCompletionHaptic`@5442、DOM 绑定@6207
- 抽法：闭包收纳音频状态，桥接函数改为接收 `{ getCurrentWord, getCurrentCardKey, ensureTodaySession }` 注入；`prefersReducedMotion` 作为参数或从 `window.SenseVocabUtils` 导入
- 风险：中。桥接函数是音频与学习引擎的唯一耦合点，需稳定注入接口
- 减行：~200 行（不含 `prefersReducedMotion`）

#### 阶段 C：数据/存储层（纯逻辑，与 UI 解耦）

**C1. 词库加载 → `vocabulary.js`**
- 范围：app.js:400-726（~327 行），紧凑连续
- 含 `validateVocabularyData`/`loadVocabularyIndex`/`loadVocabularyBundle`/`normalizeVocabularyIndex`/`normalizeWordList`/`normalizeVocabularySearchRelations`/`installVocabularyData`/`renderBookOptions`/`setVocabularyStatus`/`beginVocabularyDetailsLoad`/`ensureVocabularyDetailsReady`/`wordsForBook`/`activateBookScope`
- 特性：`installVocabularyData` 写 `bookById`/`poolWordById`/`vocabularyIndex` 等模块级变量（8 个）；`activateBookScope` 被 5 处运行时调用（1829/1924/2028/5872/5947/6145）
- 抽法：闭包收纳词库状态变量（345-352），通过 `window.SenseVocabVocabulary` 暴露 `installVocabularyData`/`activateBookScope`/`wordsForBook`/`ensureVocabularyDetailsReady` 等；app.js 的 `activateBookScope` 调用点改为 `window.SenseVocabVocabulary.activateBookScope()`
- 风险：中。词库状态变量被全文件引用（`bookById`/`poolWordById`/`vocabularyIndex`），需确认所有读写都通过模块 API
- 减行：~327 行

**C2. 存储/序列化 → `storage.js`**
- 范围：app.js:1078-1810（~733 行），原计划未单列的大块
- 含 `loadState`/`saveState`/`sanitizeState`/`compressStorageText`/`decompressStorageText`/`encodeDashboardSnapshotsForStorage`/`decodeDashboardSnapshotsFromStorage`/`encodeLocalStorageScope`/`encodeLocalStorageState`/`decodeLocalStorageState`/`serializeLocalState` 等
- 特性：loadState/saveState 读写 `rootState`/`state`/`activeStorageKey`；`sanitizeState` 被 2 处调用（activateBookScope 路径 + 启动路径）；压缩/编解码是纯函数
- 抽法：把 `loadState`/`saveState`/`sanitizeState` 及编解码函数迁入 `storage.js`，闭包或通过 API 操作共享状态；`sanitizeState` 作为 `window.SenseVocabStorage.sanitize(state)` 暴露
- 风险：中→高。saveState 被全文件 50+ 处调用，loadState 被启动路径调用。需确保 store 建立后 storage 模块能访问当前状态
- 减行：~733 行（最大单块）

#### 阶段 D：中等耦合 UI 块

**D1. 词列表 → `word-list.js`**
- 范围：app.js:3547-3910（~364 行，含中文搜索、词列表索引、渲染、浏览）
- 含 `wordLearningInfo`/`wordStatusBadges`/`getWordListIndex`/`sortedWordsForList`/`renderWordList`/`wordBrowseListItems`/`wordBrowseNeighbors`/`renderWordBrowseNavigation`/`openWordList`/`closeWordList`
- 特性：私有变量 6 个（369-374）；依赖 `state`/`words`/`wordById`；中文搜索评分逻辑是纯函数
- 抽法：闭包收纳词列表状态（369-374），暴露 `openWordList`/`closeWordList`/`renderWordList`
- 风险：中。`renderWordList` 被 `render()` 调用，需通过 `window.SenseVocabWordList.render()` 委托
- 减行：~364 行

**D2. 易混词地球 → `confusion.js`**
- 范围：app.js:4511-5027（~517 行），原计划未单列
- 含 11 个函数：`confusionRelatedIds`/`confusionWords`/`setConfusionRelation`/`renderConfusionSearchResults`/`renderConfusionPanel`/`ensureConfusionGlobeReady`/`confusionSphereRect`/`confusionWordFontSize`/`createWordGlobeTransition`/`openConfusionGlobe`/`closeConfusionGlobe` 等 + 动画转场
- 特性：私有变量 5 个（380-384）可闭包收纳；读/写 `state.confusionLinks`；依赖外部 `window.SenseVocabConfusionGlobe.create()`（懒加载）；`renderConfusionPanel` 被主 `render()` 调用
- 抽法：闭包收纳运行时状态，暴露 `renderConfusionPanel`/`openConfusionGlobe`/`closeConfusionGlobe`/`setConfusionRelation`
- 风险：中。与 `render()` 耦合 + 外部懒加载库交互
- 减行：~517 行

**D3. 学习流 + 浮动对话框 → `study-flow.js`**
- 范围：app.js:4263-4510（~248 行）+ 5028-5232（~205 行）
- 含 `startStudy`/`startAdvanceStudy`/`mountFloatingDialogs`/`openFloatingDialog`/`closeFloatingDialog`/`openMoreDialog`/`closeMoreDialog`/`openDashboard`/`closeDashboard`/`openWordCard`/`navigateWordCard`/`closeWordCard`/`exitStudy`/`openReturnDialog`/`closeReturnDialog`/`handleReturnHome`/`showPreviousWord`/`showNextHistoryWord`/`returnToCurrentWord`/`revealSenses`/`handleWordSurfaceClick`
- 特性：导航/对话框控制层，连接 render 与学习引擎；依赖大量 DOM 常量 + `render()` 回调
- 抽法：接收 `{ render, studyEngine }` 注入，闭包收纳对话框 DOM 常量
- 风险：中→高。与 `render()` 和学习引擎双向耦合
- 减行：~453 行

#### 阶段 E：核心（最难，最后）

**E1. UI 转场机制独立 → `ui-transition.js`**
- 范围：app.js:2892-3102（~211 行）+ 2425-2891（~467 行中的转场辅助）
- 含 `commitUiTransition`/`uiTransitionFrames`/`lightweightUiTransitionFrames`
- 特性：被学习引擎（`nextWord`）和 UI 渲染（`renderStudy`）双向使用
- 抽法：稳定为独立模块，接收动画回调注入
- 风险：中。需稳定 `commitUiTransition` 接口
- 减行：~211 行

**E2. 计划对话框 + 重置/重学 → `plan-manager.js`**
- 范围：app.js:5716-6078（~363 行）
- 含 `openPlanDialog`/`savePlan`/`resetAllProgress`/`resetCurrentMarking`/`relearnCurrentWord`
- 特性：对话框 + 进度重置逻辑混合；`resetCurrentMarking`/`relearnCurrentWord` 调 `dashboardRecordTransition`（残留 dashboard）
- 抽法：对话框与状态重置逻辑拆分，`resetCurrentMarking`/`relearnCurrentWord` 归入学习引擎
- 风险：中→高。`resetCurrentMarking` 是 79 行大函数，与 `render()` 联动
- 减行：~200 行（仅对话框，重置逻辑归学习引擎）

**E3. 学习引擎 + 主渲染 → 留到最后**
- 范围：app.js:2072-2424（~352 行）+ 5445-5794（~350 行）+ 3911-4261（renderStudy ~351 行）+ 3103-3372（render ~270 行）
- 含 `ensureTodaySession`/`nextWord`/`setProgressMastered`/`setProgressPending`/`markSenseFamiliar`/`buildStudyQueue`/`render()`/`renderHome()`/`renderStudy()`
- 特性：核心业务逻辑，环状依赖 `render ↔ nextWord ↔ commitUiTransition ↔ saveState`；被 400+ 函数共享的模块级变量密集读写
- 抽法：待定。需先稳定 store 与统一 action/render 中介接口
- 风险：高。最后处理
- 减行：暂不拆（或仅拆出 `buildStudyQueue`/`dueReviewKeys` 等纯计算函数）

### 预估减行汇总

| 阶段 | 块 | 减行 | 累计 app.js 剩余 |
|------|-----|------|-----------------|
| — | 当前 | — | 6352 |
| A1 | app-utils.js | ~155 | ~6197 |
| A2 | 事件绑定层 | ~182 | ~6015 |
| B1 | heatmap.js | ~120 | ~5895 |
| B2 | audio.js | ~200 | ~5695 |
| C1 | vocabulary.js | ~327 | ~5368 |
| C2 | storage.js | ~733 | ~4635 |
| D1 | word-list.js | ~364 | ~4271 |
| D2 | confusion.js | ~517 | ~3754 |
| D3 | study-flow.js | ~453 | ~3301 |
| E1 | ui-transition.js | ~211 | ~3090 |
| E2 | plan-manager.js | ~200 | ~2890 |
| E3 | 学习引擎/主渲染 | 留最后 | ~2890 |

**目标**：A+B+C+D+E1+E2 完成后，app.js 从 6352 → **~2890 行**（−3462 行，−54%）。剩余为核心学习引擎 + 主渲染 + 初始化 + dashboard 外壳（~2890 行），作为后续 E3 持续拆分。

### 验证（每步）

- 每抽一块：全量 `npx playwright test`（143 全绿为硬门槛）
- 热力图/音频/词库抽离后尤其跑 `learning-flow.spec.js` + `mobile-tutorial.spec.js`（教程走全局词法，改动共享变量会静默影响它）
- 存储层抽离后跑 `sync-concurrency.spec.js` + `account-sync.spec.js`（CRDT + 云同步路径）
- 词列表/易混词抽离后跑 `book-scope.spec.js` + `morphology-ui.spec.js` + `translation-ui.spec.js`
- 每阶段结束建议独立提交，方便回退

---

## 已完成的背景调研

- P3：✅ 已完成（2026-09-04）。`mirroredKeys` 与 `MIRRORED_SCOPE_KEYS` 逐项一致、消费方仅 2-3 处、`compactLocalState` 不依赖清单、account/admin 无第三份。→ 单源导出方案改动面极小，实际执行与计划完全一致，143/143 全绿。
- P4：46 函数分布、外部依赖词频（state 71 / SENSE_STATUS 80）、被调用点 7 处、事件绑定位置、渲染触发链（renderHome 驱动）。→ 41 函数可搬、3 个数据采集函数留 app.js。
- P5（2026-08-29 初版）：各功能块行号范围、模块级变量分组、拆分难度排序（热力图最低 → 学习引擎/UI 最高）、事件绑定 180 行集中尾部。
- P5（2026-09-04 重新摸底）：4 子代理并行调查。发现原计划**低估**：存储/序列化（~733 行，原未单列）、易混词地球（~517 行，原未纳入）、词列表（~165 行，原未单列）。原行号全部因 P4 删除 1143 行而偏移。重排为 A/B/C/D/E 五阶段 7 步，目标 6352 → ~2890 行。
