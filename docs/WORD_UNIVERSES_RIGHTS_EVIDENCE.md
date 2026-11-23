# 词汇宇宙：模型、训练资料与输出证据（候选）

> 本文是固定 BGE 候选的历史证据；WordNet 自建候选及其免费测试范围复核另见 `docs/WORD_UNIVERSES_WORDNET_ONLY_CANDIDATE.md`，不能把两者的结论互相套用。

核验日期：2026-11-22，Asia/Hong_Kong。适用对象为隔离工作副本中地图版本 `bb0c2651354ba8ae`，拟用于当前 Sense Vocab Web；运营主体、司法辖区及后续收费范围尚未在本记录中确认。本记录只归纳技术事实与一手资料，不是法律意见、第三方授权证明或发行批准；未解决事项不得标记为 `CLEARED`。

## 精确版本与已有验证

- 词库 `data/vocabulary-bundle.json` SHA-256：`f16ddf0ce69d22cad3833a3c07430e1aef748105e0583c19d9941b56a986d6fc`。
- 地图 `data/universes/manifest.json` SHA-256：`a75bc5f0eb62ea487ea24603f6cff7a19a2d47b8caddb6dc66774b21809bff85`；其清单绑定 65 个版本化文件。主要 `index.json` SHA-256：`ab999bd4e26388ee269bca3ee1bb5d329c8c8cea917adb7e82057997b3137b35`；`report.json` SHA-256：`f6283264414d14460f7470bfffe13dcf6819914fc41f9d39e9517b74c3ea1f1d`。
- WordNet 3.0 原始压缩包 SHA-256：`cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59`；地图所附完整许可文件 SHA-256：`7731175a77952e259390b496fab905e57118b8d19ad3a8383c67eee724ff443f`。[Princeton 官方许可](https://wordnet.princeton.edu/license-and-commercial-use)允许符合条件的使用和分发，并要求保留声明、条款和免责声明；项目现有 `THIRD_PARTY_NOTICES.md` 也记录了这些义务。
- [WordNet 官方义项索引说明](https://wordnet.princeton.edu/documentation/senseidx5wn)将 `tag_cnt` 描述为语义标注语料中的计数，不是普适词频。地图使用索引计数及平滑权重，没有将 SemCor/Brown 的原始句子作为新图数据分发；这不解除既有例句的独立权利审查。

## 模型版本与许可声明

- 本次本地推理使用 `Qdrant/bge-small-en-v1.5-onnx-Q` 固定快照 `52398278842ec682c6f32300af41344b1c0b0bb2`，ONNX 文件 SHA-256 为 `51f1bd0addd6e859e42c2c8021a5e5461385bb676a649f4b269aa445449f2431`；`tokenizer.json`、`tokenizer_config.json`、`config.json` 的 SHA-256 分别为 `d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66`、`0b29c7bfc889e53b36d9dd3e686dd4300f6525110eaa98c76a5dafceb2029f53`、`13582bcf2effc85b7bf3d3f5532e686bc1c9ce86bb009d10f0ec33cbe92299dd`。
- 固定快照的[历史模型卡提交](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q/commit/52398278842ec682c6f32300af41344b1c0b0bb2)标为 Apache-2.0。Qdrant 在 2026-09-24 的[紧邻后续提交](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q/commit/aa8f8b060edb00e03bfdd08813a2949946c8ba55)只改模型卡中的许可标识为 MIT，提交说明称与上游一致；其父提交正是本次固定快照。分别查询两次官方模型版本 API 的 `?blobs=true` 后，ONNX LFS SHA-256 和上述三个配置/分词文件 Git blob 均相同，本地文件也分别匹配。故这不是推测两个不同模型权重的许可相同；声明变更的适用解释仍应保留证据，不将历史 Apache 标签抹去。
- [BAAI 上游模型卡](https://huggingface.co/BAAI/bge-small-en-v1.5)标识 MIT，并明确说明其发布模型可用于商业用途；[FlagEmbedding 代码许可](https://github.com/FlagOpen/FlagEmbedding/blob/master/LICENSE)另行记录。模型、代码、训练资料和输出不能只凭一个标签合并认定；本次不会将 ONNX 权重或本地向量缓存打入网页地图包。

## 训练材料：已知与未确认

- BGE 作者的 [C-Pack 论文](https://arxiv.org/html/2309.07597)描述了约 2 亿对英文训练文本及其构造方法；[智源公开介绍](https://hub.baai.ac.cn/view/30719)列出 MTP 涉及 Wudao Corpora、Pile、DuReader、Sentence Transformer 等来源。这些是对 MTP/BGE 训练资源的公开说明，不能单独证明当前量化快照每一训练阶段使用的完整子集、逐源权利或输出范围。
- 智源数据平台的历史[数据使用协议](https://web.archive.org/web/20240705152929id_/https://data.baai.ac.cn/resources/agreement/BAAIDataAgreement.pdf)载明生效日期 2019-12-01；2024-07-05 的公开历史存档已保存至本副本 `.op-cache/source-investigation/baai-data-agreement-archive-20240705.pdf`，SHA-256 `f706272e9facc5fc0e441a77309173b72fc1be669d7b51e5996d05b51ae7f900`。协议前言与第 4.1、4.2 条对**平台数据使用**有学术研究及商业用途限制，并允许另有约定；第 3.2 条亦限定平台许可范围。2026-11-22 核查原 PDF 地址返回 404，MTP 页面仅显示“敬请期待”。因此该历史协议的当前效力、是否适用于该 MTP 版本及是否约束经另行发布的 BGE 模型或其推理输出，均不能仅凭这份历史文件确定。
- 官方 BGE 模型卡的商业使用声明与上述历史平台数据协议应分别保留：不能把前者自动扩展为已核实每份训练语料，也不能把后者自动解释为 BGE 模型或地图输出禁止商业使用。当前没有取得对当前图数据分发范围的专门书面确认或人工复核记录。

## 输入与实际输出

- 生成器按英文词、词性、WordNet 3.0 synset 偏移/类型及规范化释义一致匹配后形成 8,812 项输入；实际输入文本使用 WordNet 原始 gloss。2026-11-23 复核纠正此前“释义精确匹配”的表述：8,810 项与既有 `definition` 文本完全相同，2 项仅分号不同，见新增审查记录。对照同一词库哈希的 `data/content-rights-ledger.jsonl`（SHA-256 `0b8435e816f18fe9ac368bd1488a6ce17a25c2d358879a2b43b1c951b7a07c11`），这 8,812 项既有 `definition` 字段均有记录且台账风险为 `CLEARED`。该状态不自动覆盖新生成的图数据或模型训练材料。
- 对当前 65 个地图文件进行字段清点：文件类型只有 JSON 与 WordNet 许可 TXT；节点/义项数据包含词、稳定 ID、词性、synset、标注计数、权重及二维坐标；近义边包含两端稳定义项、synset 和数值余弦，形近边包含目标 ID 与编辑距离。共 3,138 条有向近义边及 30,798 条有向形近边，分别对应 1,569 / 15,399 对无向关系。未发现以字段形式包含原始训练语料、完整义项释义、原始模型权重或逐义项高维向量；界面显示的释义来自既有词库而非新地图包。字段清点和结构正确不自动构成版权判断。
- 同一 synset 只是关系证据，不保证所有语境可互换；二维坐标是近似投影。完整文件清单与每文件哈希见该版本的地图 manifest，生成器与独立校验器记录在候选说明中。
- 已生成仅供核验的机器追溯记录 `.op-cache/source-investigation/universe-output-trace-bb0c2651354ba8ae-v2.jsonl`，SHA-256 `ef9c9d4f1302a5d3fa4f58ca2e557b9087a00cb38a9f458b2aa6b1ee0f1d68ee`；记录 6,607 个节点、10,377 个义项、1,569 对近义关系和 15,399 对形近关系，包含稳定 ID、图文件路径与哈希、各字段新值哈希、输入定义台账及 WordNet/模型证据引用。脚本同时核对全部清单文件、输入词库、8,812 项定义字段和关系反向绑定；独立回读图文件与追溯记录，重新计算并匹配 140,547 个字段哈希。`oldValueSha256: null` 仅表示本地图是新增资产，并不表示现有用户数据或原词库字段为空。所有新增项仍标为 `pending`；机器追溯不替代语境审核或权利审核。首轮因源词库缺失 `synsetId` 在序列化后显示为 `null` 而中止，已明确兼容该情况；其 `.partial` 文件保留且不是完整记录。

## 备选方案的本地对照

- 当前固定 BGE 模型的上游已公开声明 MIT 及可商用，应首先评估其与本次使用范围的适配；不能因为尚未逐一核实所有训练语料，就把模型使用许可写成“不可商用”。
- 另查到现成的 [path2vec WordNet 预训练图向量](https://github.com/uhh-lt/path2vec)。其代码仓库标注 Apache-2.0，但单独托管的权重文件尚未找到同等明确的授权声明；不能把代码仓库许可自动套用给权重。本地下载其中 shortest-path 固定文件并留存 SHA-256 `fa9758769f992c8a17ff5a6deaec0e789fc9e2b35708f4120e0a49961ac79b6c`：它仅覆盖已匹配的 8,812 个义项中的 4,649 个，全部为名词，动词、形容词和副词均无向量；四个手选多义词关系中有三个排序不符合目标。其 WordNet 图已参与训练，470 项图关系测试存在训练/测试泄漏，不能据此作有效的泛化比较。脚本和结果为 `.op-cache/source-investigation/evaluate_existing_path2vec.py`、`.op-cache/source-investigation/path2vec-shortest-path-comparison-20261122.json`。这些缺口使该现成备选目前不能可靠替换 BGE，也不构成对其商业授权的判断。
- 为评估无外部预训练权重的兜底方案，在相同 WordNet 3.0 输入上本地训练 128 维 LSA，并仅使用训练分区的上位词关系加入图上下文。留出关系对比的 470 项样本中，现有 BGE 区分真实上位关系与随机同词性干扰项为 96.809%，自建图上下文方案为 88.298%。对照脚本与结果分别为 `.op-cache/source-investigation/evaluate_wordnet_graph_lsa.py`、`.op-cache/source-investigation/wordnet-graphlsa-heldout-128-20261122.json`。
- 上述是有限代理指标，并非近义词准确率；WordNet 释义和间接图路径仍可见，亦不能代替实际产品评测或证明训练数据以外的权利已解决。候选未替换模型、未应用自建输出；当现成模型适用范围可以核实时，现阶段没有依据为通过门禁而切换至该效果较弱的兜底方案。

## 仍需解决的发布条件

1. 在确定的 Web 渠道、用户范围、经营模式及司法辖区下，形成可追溯的人工作出的本次使用/发行审查；明确模型发行声明、历史平台数据协议、实际训练来源和数值输出的适用关系及剩余风险。不得把未知项伪造为已授权。
2. 对已有机器追溯记录中的新增关系和图形数据开展适用的变更集审核，并落实许可、署名与展示义务。现有 WordNet 已附许可文件；其他具体义务仍需按最终发行方式确认。
3. 在上述事项解决且证据绑定精确文件后，恢复正常构建和已验证产物部署。此候选没有成功 Web 构建或发布凭据；此前 309 项测试只证明所记录源码与数据输入下的测试结果，不能替代构建、授权审核或部署验证。

## 2026-11-23 补充复核

- 新增逐层审查、实际已公开范围和机器核对结果见 `docs/WORD_UNIVERSES_RIGHTS_REVIEW_20261123.md`。该文补充了上游 BGE 历史模型卡对英文训练资料的说明、MS MARCO 当前资料条款、WordNet NLTK 分发包的版本化哈希依据以及地图复用既有中文义项的准确范围。它不覆盖此前记录，不构成人工发行审批。

## 2026-11-23 现成商用模型补充对比

- 对照 [IBM Granite Embedding 30M 英文模型](https://huggingface.co/ibm-granite/granite-embedding-30m-english)固定修订 `9b5b096411652ec1189c68fcfb90d0a82c5b45af`。官方模型卡及[技术说明](https://arxiv.org/html/2502.20204)声明模型以 Apache-2.0 发布、允许商业使用，并称训练中避开 MS MARCO、数据经过治理审核。官方发布的 `model.onnx` SHA-256 `3a85876825c5144a646dd4da8d05271e2536774481849e8825102ca2126770fc` 与本机下载结果一致；分词器、配置及本地输出哈希见下方对照结果。该模型仅下载至隔离副本 `.op-cache`，尚未用于候选地图或产品构建。
- 用相同 WordNet 输入重新计算全部 8,812 个可匹配义项的向量。470 组上位词对随机同词性干扰的测试中，BGE 为 96.809%、IBM 为 98.085%；988 组同 synset 目标与同词其他义项的代理对照中，BGE 为 89.676%、IBM 为 93.421%。两者 4 组手选多义词检查均符合预期。这些是同一批输入上的有限代理测试，不是完整语义效果或产品验收；两模型训练集可能包含评估材料。逐项结果及执行参数见 `.op-cache/source-investigation/ibm-granite-comparison-20261123.json`，SHA-256 `b67288d04bbd574eac2f1d434e470cdf397cb006efdcccbc0cec846967af9d0b`；生成脚本 `evaluate_ibm_granite.py` SHA-256 `f9bffda91e91f5b7da0da44bc5c9946e6293b06b47529c41db4be0661dbed072`。
- 对 5,464 个全部义项可用的词按现有权重公式计算新二维投影，IBM 新拟合布局的相对距离 stress 为 0.76188，既有 BGE 保留布局为 0.73507；两者拟合基准不同，不能据此判定视觉效果或替代页面验收。原始结果 `.op-cache/source-investigation/ibm-granite-layout-20261123.json` SHA-256 `e2c9fb33f97b8b83fb75cfbefa27a487ae7ca78d13d15b4be16cc80543d61547`。
- **仍需核对：**IBM 的同一[技术论文](https://arxiv.org/html/2502.20204)明确提到训练阶段使用 BookCorpus，但未在此说明所使用的具体版本、各作品许可或是否另有授权。[BookCorpus 数据卡](https://huggingface.co/datasets/bookcorpus/bookcorpus)标示其许可未知；不能未经验证就断定 IBM 使用的是该数据卡对应的相同版本，也不能据此断定 IBM 模型或数值输出禁止商用。模型发布方的商业声明、训练资料来源和输出适用范围仍须分开评估。IBM 方案是更有希望的现成备选，但尚不构成发行批准，不能仅凭更好的代理分数或“当前免费”将未知证据标为 `CLEARED`。
