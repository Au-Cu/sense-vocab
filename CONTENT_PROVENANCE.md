# 内容来源与兼容性政策

版本：2026-08-09-v3

## 发布边界

本项目共有 6,607 个单词、10,235 个义项。`data/content-rights-ledger.jsonl` 是逐义项、逐字段的权利台账；`data/content-rights-ledger-summary.json` 是机器可读汇总。台账记录内容哈希、来源 ID、作者或权利人、许可证、直接链接、获取日期、证据哈希、处理状态和未解决问题。

台账存在 `BLOCKER` 或 `HIGH` 时，`npm run verify:commercial-release` 必须失败。该门禁只判断仓库证据是否达到商业发行标准，不替代权利人授权、外部律师意见或主管部门决定。

## 身份兼容边界

用户状态以 `wordId:senseId` 和词书引用为兼容性边界。`data/content-identity-lock.json` 固定 6,607 个单词、10,235 个义项及词书顺序。内容整改可以替换释义、例句、翻译、音标和已授权音频，但不得无迁移方案地改变 `wordId`、`senseId`、词书成员或顺序。

构建前运行：

- `npm run verify:content-identity`
- `npm run audit:content`
- `npm run verify:rights-ledger`

## 来源分层

### Wikimedia Commons 音频

`tools/enrich-audio-rights.mjs` 从 Wikimedia Commons MediaWiki API 的 `imageinfo/extmetadata`、文件说明和文件历史获取逐文件作者、许可证、文件页、许可证链接、署名信息、获取时间和证据 SHA-256。机器可读 `Artist` 为空时，只使用 2026-08-09 已从官方文件说明或历史核实并哈希的作者证据，不从文件名或第三方页面推定作者。每个文件的许可条件仍须逐项满足；API 返回元数据不等于本项目取得额外授权。

### Tatoeba 例句

`tools/enrich-open-content-rights.mjs` 以句子 ID 核对 Tatoeba 官方 API 与周度导出，保存作者状态、句子许可证、句子页、官方记录、获取时间、证据 SHA-256，并核对官方文本与本地文本。2026-08-09 发现的 12 条差异均为本地多出的冗余句末句点，已保留旧文本哈希和官方文本哈希后按官方文本规范化；其他文本不一致继续保留为阻断项，不以旧的默认许可证推定当前句子许可。

### Wiktionary / Kaikki

Wiktionary/Kaikki 记录保存词条页、编辑历史页、版权页、贡献者集合署名、许可证链接、修改说明、Kaikki 提取版本和证据 SHA-256。针对当前冻结数据，项目选择 Wiktionary 当前版权页提供的 CC BY-SA 4.0 路径；其同时提供的 GFDL 1.3 路径不与 CC BY-SA 4.0 混合标成单一许可证。来源中另引书籍、新闻或其他作品的 quotation 内容不因出现在开放项目中自动获得授权，仍单独进入复核清单。

### WordNet / SemCor、OMW、ECDICT、CMUdict 与翻译模型

软件或数据集许可证与单条内容权利分别记录。模型架构、权重、训练数据和生成输出不得因其中一层为开放许可证而合并推定可商用。许可证全文或必须保留的声明见 `THIRD_PARTY_NOTICES.md` 和生成的 `THIRD_PARTY_LICENSES.md`。

2,845 条 `exampleSource=semcor` 的例句已从 WordNet 归因中分离：台账明确标记 `semcor-commercial-rights-unverified`，作者和许可证保持未知并阻断商业发行，除非取得适用于这些句子原文的商业再分发授权或依法完成等价内容替换。WordNet 3.0 许可不得自动覆盖 SemCor/Brown Corpus 原文。

### 历史来源隔离

`data/kaoyan-source.json` 缺少可验证的商业权利链，仅允许内部审计，不进入网页发布目录，也不得用于继续生成内容或付费发行。该限制记录在 `data/source-policy.json`。

2026-11-15 的内部溯源确认，该本地文件的 SHA-256 为 `75504c26f732303414c818c4d6d42d56844cef2c1d771317b2e80d4ec3882469`，Git blob 为 `d1a8cd53dfc12d428302dae17a72657c3c64c146`，与 [KyleBing/english-vocabulary 的考研 JSON](https://github.com/KyleBing/english-vocabulary/blob/5fd35467a810c945012b87e6e81de4dbfa10c277/json/5-%E8%80%83%E7%A0%94-%E9%A1%BA%E5%BA%8F.json) 在提交 `5fd35467a810c945012b87e6e81de4dbfa10c277` 中的文件一致。该提交于 2026-09-30 加入 [BSD 3-Clause 许可证](https://github.com/KyleBing/english-vocabulary/blob/5fd35467a810c945012b87e6e81de4dbfa10c277/LICENSE)，晚于本地文件的 2026-07-04 修改时间。

该仓库的 [README](https://github.com/KyleBing/english-vocabulary/blob/5fd35467a810c945012b87e6e81de4dbfa10c277/README.md) 将词库追溯至 `kajweb/dict` 的派生整理；[上游说明](https://github.com/kajweb/dict/blob/3992bcb94c800a2fd38a9fd6ff95b2353e755363/README.md) 列出有道、新东方等词库及原始下载地址。内部只读比对发现，本地 9,602 个词条的顺序与上游该版本的 `KaoYan_1`、`KaoYan_2` 和 `KaoYan_3` 三份文件一致，13,840 条词性与中文翻译组合也逐条一致；上游将前两份标为有道、第三份标为新东方。

仓库级许可证和文件哈希可证明直接分发来源，但不能单独证明每条上游词义及翻译均获相应权利人授权。因此，这一发现尚不自动解除隔离或清除逐字段权利门禁；后续应核对具体内容来源和许可范围，保留许可证及署名义务。

## 内容变更与验收

1. 保持身份兼容边界。
2. 每个字段记录作者或权利人、来源、许可证或书面授权、获取日期、修改方式和内容哈希。
3. 原创或 AI 辅助内容记录撰写人、复核人、模型与生成批次；不得输入无权使用的第三方内容。
4. 重新运行权利 enrichment、身份校验、内容审计、逐项台账和测试。
5. 保留旧哈希、变更理由和书面证据；无法证明权利链的项目保持阻断，不直接删除内容掩盖问题。
