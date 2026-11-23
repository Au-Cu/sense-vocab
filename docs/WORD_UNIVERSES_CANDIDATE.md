# 词汇宇宙：隔离候选实现与核验记录

> 本文保留早期 BGE 候选及其历史验证；当前 WordNet 自建候选、用户确认的免费测试范围与剩余门禁见 `docs/WORD_UNIVERSES_WORDNET_ONLY_CANDIDATE.md`。两者的源码哈希、数据和验证证据不能混用。

> 仅为本地候选，不代表生产功能已经上线或权利清关。不要部署、发行或把候选关系作为已获授权的事实。正式工作区已有文档修改不在本候选内。

## 数据与算法

- 两张共享地图均以 `data/vocabulary-bundle.json` 为唯一内容身份基线，运行时要求地图所记录的 bundle SHA-256 与当前 `vocabulary-index.json` 的 `bundleVersion` 一致。地图和用户易混词完全分离；学习状态只从当前词书及当前游客/账户作用域读取。
- 英语义项向量输入为英文词、词性和经 WordNet 3.0 的 lemma、POS、原生 synset 类型、偏移及规范化释义逐项一致匹配的英文释义。只在两个已匹配义项属于同一 synset 时创建候选近义边；同一 synset 仍非所有语境都可以互换。邻近、传递关系、反义词和单纯高余弦不会自动建边。
- 使用固定快照 `Qdrant/bge-small-en-v1.5-onnx-Q@52398278842ec682c6f32300af41344b1c0b0bb2` 的本地量化 ONNX 权重；384 维 CLS 向量逐义项 L2 归一化。原始权重不放进网页发布包。详细模型文件、词库、WordNet 输入哈希及运行库版本保存在候选 `report.json`。
- 用 WordNet 3.0 `index.sense` 的标注计数作有限语料统计，而不是普适词频。匹配上的计数加一平滑；匹配失败的项用同词已匹配计数均值估计再加一，若全缺则等权。零表示该语义标注样本无记录，不等同现实使用频率为零。权重在词内分别归一化；不因缺失而删除义项。
- 词级语义向量为各义项单位向量的**不再归一化**加权和；其点积等价于要求的完整义项对加权余弦和。任何义项缺向量时整词语义得分不可用，显示为占位坐标；各已验证义项的关系仍可独立显示。二维 PCA 是近似压缩而不是精确两两距离。
- 形近图单独使用字符 n-gram 生成二维坐标，边用最优字符串对齐距离（增删、替换、相邻换序）：短词阈值 1，其余阈值 2，且双向度数不超过 20。度数上限造成的裁剪数量在报告中列示；拼写近似不代表语义近似。
- 全部单词的轻量地图索引一次读取到内存，关系分区按需加载；静止不持续重绘。义项向量缓存仅留在本地 `.op-cache/universe-vectors/`，带模型、输入、运行库与顺序的内容寻址键，不属于浏览器学习数据或同步快照。

## 当前本地候选和限制

基于 SHA-256 `f16ddf0ce69d22cad3833a3c07430e1aef748105e0583c19d9941b56a986d6fc` 的词库，本次计算得到：6,607 词、10,377 义项；8,812 义项按身份及规范化释义匹配 WordNet（其中 6,225 有正标注数、2,587 无标注样本），1,565 项使用缺失频率估计；5,464 词拥有全部义项的可用语义向量，1,143 词的整词位置为占位。2026-11-23 复核纠正此前“严格匹配”容易被理解为原文字节完全一致的表述：8,810 项原释义相同，另 2 项仅在分号上不同；模型实际输入采用 WordNet 原始 gloss。

近义关系候选有 1,569 对义项、覆盖 1,972 词；4,635 个词没有近义边，最大近义连通片只有 25 词，尚不能满足用户期待的整体连通体验。形近有 15,399 对，另有 1,173 对因度数上限裁剪。图形 JSON 共约 3.96 MB，主索引约 2.60 MB；每次实际请求的区域文件随浏览路径变化。语义二维随机样本 29,996 对的相对距离 stress 为 0.73507；高维相似度与二维重建相似度 Pearson 相关约 0.551，与二维距离反向 Pearson 相关约 0.402。失真较大，不应把位置当精确相似度。用户界面对此明确提示。

本机 `wordnet-db@3.1.14` 通过相同 sense key 尝试映射严格匹配的词库义项，仅增加 1 对候选，不能解决覆盖率问题。另以 [Open English Wordnet 2025 固定版本源码](https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition)作本地比较（源码 zip SHA-256：`09f8de8c640e461a8e7c57e916fb27fa5a6274ec9c723067a51fc85aa7ad8fbd`）。通过原版 sense key 精确映射后，9,007 项能找到新版标识，8,520 项的释义与现有字段精确匹配；同 synset 得到 1,499 对，其中仅 6 对是当前候选中没有的，原候选有 76 对未被这一更严格的跨版本比较保留。两项调查均未将新关系加入地图。这些版本偏移不同，不能直接按偏移拼接；任何新增映射仍须逐义项绑定、核对语境及权利后才能用于发行。

本机冷态计算 8,812 条向量约 238 秒；命中缓存的同模型重建约 7 秒，均为单机观察值。桌面 Chrome 本机回环加载主图在单次测试中约 0.2 秒，不代表公网或实体手机性能。

## 权利和证据边界

- [WordNet 3.0 官方许可](https://wordnet.princeton.edu/license-and-commercial-use)允许符合条件的使用和分发，并要求随副本保留完整许可与声明。候选版本包含从原始压缩包提取的完整 `WORDNET-3.0-LICENSE.txt`。
- [WordNet 义项索引说明](https://wordnet.princeton.edu/documentation/senseidx5wn)说明 `tag_cnt` 对应语义标注语料中的出现次数，而非无限总体概率。
- [上游 BAAI 模型卡](https://huggingface.co/BAAI/bge-small-en-v1.5)声明 MIT，发布模型可商用；Qdrant 的固定历史快照模型卡标为 Apache-2.0，其后仅修改模型卡的[紧邻提交](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q/commit/aa8f8b060edb00e03bfdd08813a2949946c8ba55)明确改为 MIT 以与上游一致。官方版本 API 与本地哈希比对显示两次提交的 ONNX、分词和配置文件相同；这一证据缩小了模型版本声明差异，但不自动证明训练资料和输出的全部权利。详细范围及未解决事项见 `docs/WORD_UNIVERSES_RIGHTS_EVIDENCE.md`。
- 模型训练数据、词库具体输入字段及生成关系/坐标的权利链与预定发行范围尚未完成逐项确认；机器结构校验不是许可、法律意见或授权。候选清单固定为 `blocked-until-source-model-input-output-and-field-rights-reviewed`；发布构建必须对精确文件哈希、适用范围和人工作出的证据记录完成审核，不能靠修改单个标志跳过审查。现有 D-017 等其他门禁继续适用。
- 2026-11-22 对照相同词库 SHA-256 的既有 `data/content-rights-ledger.jsonl`：候选中按身份和规范化释义匹配 WordNet 的 8,812 个义项，其既有 `definition` 字段均有台账记录，字段风险均标为 `CLEARED`（包含 7,415 项 `wordnet-definition`、1,219 项 `WordNet synset` 及其他既有来源）。这是现有台账对既有字段的机器可核对状态，不自动覆盖本次新增关系、嵌入模型或生成坐标的发行权利，也不等于完整第三方权利链已审查通过。2026-11-23 对实际输入和历史 `meaning` 展示范围的复核见 `docs/WORD_UNIVERSES_RIGHTS_REVIEW_20261123.md`。

## 本地验证记录

- 2026-11-22 最终候选数据版本为 `bb0c2651354ba8ae`。独立验证器校验 65 个数据文件、词与义项身份、关系双向性、WordNet 源绑定和拼写距离；250 组抽样的加权双重求和与优化计算最大误差为 `2.22e-16`。结构与数值通过不代表逐条语境或权利已获审核。
- 最终源码运行 `npm run verify:compact -- npm test -- --reporter=./tools/compact-playwright-reporter.cjs`，309 项通过、无意外结果；完整逐项摘要保存在隔离副本 `.op-cache/universe-full-test-final.json`。运行前后包含候选地图文件的源码清单哈希均为 `d415b7e73e3eb66381cc231f9d24e0a45244ba9ba844f0b51cfefb985d42f7b3`。
- 另有生成器及计算核心 11 项单元测试、发布门禁 3 项测试、真实词库星图交互 16 项专项测试通过。桌面和手机视口截图分别保存在 `.test-artifacts/universe-real-desktop.png` 与 `.test-artifacts/universe-real-phone.png`；手机为桌面 Chrome 模拟，不是实体设备测试。
- `npm run build:web` 已执行，内容身份核验通过，但在新增地图的权利证据门禁处按预期失败，因此**构建未通过，未部署，也未回流正式工作区**。正式目录中原有文档改动未由本候选覆盖。

## 本机复现与核验

在本隔离工作区中，准备项目现有本地 WordNet 3.0 压缩包与上面固定的 ONNX 快照后运行（这些路径只举本机当前所在位置，未安装新模型）：

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
$wordnetZip = Join-Path $env:APPDATA 'nltk_data\corpora\wordnet.zip'
$modelDir = 'D:\Files\sense-vocab-mvp\data\.fastembed-cache\models--qdrant--bge-small-en-v1.5-onnx-q\snapshots\52398278842ec682c6f32300af41344b1c0b0bb2'
py -3 tools/build_word_universes.py --wordnet-zip $wordnetZip --model-dir $modelDir
py -3 tools/verify_word_universes.py --wordnet-zip $wordnetZip
py -3 -m unittest discover -s tools -p 'test_universe*.py' -v
node --test tools/universe-release-gate.test.mjs
$env:SENSE_VOCAB_UNIVERSE_REALDATA = '1'
npx playwright test tools/word-universe.spec.js
```

候选数据和本地向量缓存依项目 `.gitignore` 不会自动进入 Git；应和本隔离副本一起保留。验证器复查所有节点、义项、分区、文件哈希、双向关系、拼写距离、WordNet 源绑定与抽样加权公式；它不审定法律权利或替代逐条语境审阅。公网构建及合入需在权利、最终全量回归和正式工作区租约门禁满足后另行处理。
