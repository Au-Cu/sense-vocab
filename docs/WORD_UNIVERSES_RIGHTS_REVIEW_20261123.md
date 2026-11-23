# 词汇宇宙新增地图：权利复核记录

> 本文针对早期 BGE 候选，保留其原始阻断与历史；新 WordNet 自建候选及用户确认的免费测试范围见 `docs/WORD_UNIVERSES_WORDNET_ONLY_CANDIDATE.md`。

复核时间：2026-11-23，Asia/Hong_Kong。审查方式：Codex 辅助核对公开一手资料、现有代码、候选数据和既有权利台账；**不是律师意见、权利人授权或人工发行批准**。人工签发人及复核时间：未取得。记录只适用于下列固定输入，不改变现有权利台账中的任何状态，也不联系供应商、修改生产数据、构建或部署。

## 范围与结论

- 对象为候选 `bb0c2651354ba8ae`：地图清单 SHA-256 `a75bc5f0eb62ea487ea24603f6cff7a19a2d47b8caddb6dc66774b21809bff85`，词库 SHA-256 `f16ddf0ce69d22cad3833a3c07430e1aef748105e0583c19d9941b56a986d6fc`，正式工作区基线 commit `c4fc6e9c47b1ef763f5c94e538dbef134e155981`。候选未回流正式工作区。
- 拟核对的最低场景为现有公开 Web 的免费测试版，而不是认定免费就一定是非商业使用。2026-11-23 只读检查正式站点：`/legal.html` 明示免费测试版，与本地同文件 SHA-256 `ff1563629401cc3e4987dcf99994722430a19b77775e9cefae3cae4dae54f478` 一致；`/data/vocabulary-index.json` 返回 6,607 词、两本词书，与本地 SHA-256 `ac6de14296772c9a789c6006f6a1f090a6c26c7e50194b1674ea011cbb903065` 一致。运营主体、目标司法辖区、是否扩大经营范围及后续收费模式仍未确认；不得把本记录扩张为商业发行结论。
- **项目发布结论：当前候选仍阻断。** BGE 模型发布方的商业许可有直接证据，WordNet 来源及拟随包许可也可核验；但英文训练材料和下游图数据之间的适用关系、输出证据的适用范围与人工审批未闭合。不能把缺口说成已授权，也不能仅因为历史内容权利问题存在就一律冻结无关维护。收费发行另须按 D-017 清零整个拟发行范围内的 `BLOCKER/HIGH`；本次未做全库商业清关。
- 严重度表示本次工程/项目风险而非法院或主管机关认定；进度与严重度分开。下面的 `evidence_pending` 不等于已经证明侵权，`证据支持` 也不是最终 `CLEARED`。

## 分层发现

| 稳定 ID | 内容及严重度 | 事实、处理状态与下一步 |
| --- | --- | --- |
| `UNIV-R-01` | 模型训练来源及其与实际发行关系：`BLOCKER`，`evidence_pending` | [BAAI 模型卡](https://huggingface.co/BAAI/bge-small-en-v1.5)声明模型以 MIT 发布且可商用；这不能替代训练数据及输出范围的独立判断。模型仓库 2023-09-12 的[历史说明](https://huggingface.co/BAAI/bge-small-en-v1.5/blob/9b09f79fe618f3969e13e52f12c01de64145ebc0/README.md)在通用训练介绍中列出英文预训练来源 The Pile、Wikipedia、MS MARCO，并列出英语微调资料来源 Wikipedia、CC-Net 等；它没有明确逐项证明本地量化模型对应检查点使用的精确子集或许可协议。历史说明原始文件 2026-11-23 获取 SHA-256 `8ba65f0641bc8d64dc7b8ac34164ecc540ebe8fd842701ccae345b583db45977`。微软 [MS MARCO 当前页面](https://microsoft.github.io/msmarco/)对数据集列有非商业研究使用限制，并建议对产品使用研究输出作独立法律复核；2026-11-23 页面字节 SHA-256 `ab69d6410caaa38b13c395e6d4e0d6b77bab27f2545185c5518d8597acc624c2`。这是一条需审查的训练来源证据，不证明本项目下载了该数据集、模型训练一定违反协议，或数值输出自动受同一限制；当时条款、具体数据版本、是否有另行约定及对下游使用的约束均未知。应针对固定模型版本、使用渠道与地区取得足以支持结论的一手依据或适用的独立人工复核，再决定是否保留现成模型。 |
| `UNIV-R-02` | 量化模型与上游许可：`LOW`，`evidence_pending` | Qdrant 描述其文件为 [BGE small v1.5 量化移植](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q)；本机 `model_optimized.onnx` SHA-256 `51f1bd0addd6e859e42c2c8021a5e5461385bb676a649f4b269aa445449f2431`。历史固定快照 `52398278842ec682c6f32300af41344b1c0b0bb2` 的卡片标签为 Apache-2.0，发布方紧接着在 [`aa8f8b060edb00e03bfdd08813a2949946c8ba55`](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q/commit/aa8f8b060edb00e03bfdd08813a2949946c8ba55) 将标签改为 MIT 以匹配上游；官方版本 API 的 ONNX LFS SHA-256、分词和配置 Git blob 在两次提交间一致，本机文件亦匹配。发布方卡片和配置指出模型名称，但未证明转换所用上游权重的精确 commit 或每阶段训练子集。本次模型仅本地计算，不计划将 ONNX 权重、分词器或向量缓存装入 Web 包；若以后分发模型需重新核对版权声明和许可义务。 |
| `UNIV-R-03` | WordNet 输入及来源：`LOW`，`evidence_pending` | [Princeton WordNet 3.0 许可](https://wordnet.princeton.edu/license-and-commercial-use)允许在满足条件下使用、修改和分发，包括商业用途，要求随相关副本保留版权、许可及免责声明，不得用 Princeton 名称作相关宣传。实际读取的本地 `wordnet.zip` SHA-256 为 `cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59`；与 [NLTK 数据索引固定提交](https://github.com/nltk/nltk_data/blob/550b6625bcef1f2abff2ff770a5a0d272c9c6b2a/index.xml)中 `wordnet` 包的 SHA-256 一致，索引字节 SHA-256 `97dce5e72320cd9850b7c20130196006710c18f9c03134c822a37da330198bf6`。这是 NLTK 分发的 WordNet 数据包，不应误写成从 Princeton 官网直接下载的同名压缩包。候选清单包含从包中提取的完整 `WORDNET-3.0-LICENSE.txt`，本地构建脚本计划复制到 Web 产物；尚无成功构建，故尚未验证最终 `dist` 的实际副本和可访问性。WordNet 项目名称用于说明资料来源，不作为 Princeton 对产品的宣传背书。 |
| `UNIV-R-04` | 既有词义与新展示范围：`MEDIUM`，`evidence_pending` | 候选图文件不包含中文义项原文，但界面通过 `poolWordById` 回读现有词库并可在当前词书之外展示。10,377 个义项全部属于至少一本现有词书；当前公开索引与词库中的 10,377 个 `meaning` 值逐项相同。既有台账中这些 `meaning` 字段为 `BLOCKER` 8,852 项、`CLEARED` 1,525 项；考研词书外 2,317 项中 2,151 项为历史 `BLOCKER`，雅思词书外 2,807 项中 2,217 项为历史 `BLOCKER`。当前词书外直接浏览是新增呈现路径，但这些值已在既有公开索引中，不能把以上历史数字等同于本次新生成或新修改字段，也不能由既有公开状态推定新组合用途已获授权。需要按实际用途核对是否新增或加重权利风险；普通维护不将未触及历史 `BLOCKER` 机械变成全库门禁。不得为降低统计数字静默删除或改写用户学习数据及词库。 |
| `UNIV-R-05` | 新关系、数值和可视化输出：`HIGH`，`evidence_pending` | 候选有 1,569 对近义义项关系、15,399 对形近关系和 6,607 个词坐标；近义关系由已匹配 WordNet 同一 synset 导出，形近关系由词拼写距离计算，语义坐标及近义余弦还使用 BGE 的本地推理结果。新图文件中未发现原始训练语料、完整定义、模型权重或高维义项向量，但不因是数字就自动断定输出无权利限制。机器追溯记录绑定稳定 ID、双向关系、文件及字段值哈希；现有 `meaning` 字段的历史状态不自动覆盖新关系。需要结合 `UNIV-R-01` 的适用结论、实际传播范围及新关系内容正确性完成可追溯审核；同 synset 不是所有语境下均可互换，结构检查不是逐项语义或法律审批。 |
| `UNIV-R-06` | 释义绑定及证据元数据：`MEDIUM`，`evidence_pending` | 8,812 个候选模型输入与 WordNet 身份及规范化释义匹配，实际输入为 WordNet 原始 gloss。既有词库释义中 8,810 项与 WordNet 原文一致，`bowl:n-1`、`forfeit:n-1` 两项只差分号；应以各自实际输入/字段哈希区分，不能再笼统称全部“原文完全相同”。既有 ledger 对这 8,812 个 `definition` 均记为 `CLEARED`，但其中 8,794 项逐字段 `retrievedAt` 和 `evidenceSha256` 为空；同批共享证据可能补足，不等于这些项已经未经授权。WordNet 分发包及索引现有统一哈希可作为来源证据，是否充分覆盖各项仍需按具体来源与审核范围核对；模型输入匹配不证明对应中文 `meaning` 已清关。 |
| `UNIV-R-07` | 页面素材及生成工具：`LOW`，`evidence_pending` | 候选地图由 `word-universe.js` 的 Canvas 代码与 CSS 绘制，使用系统字体；审查代码未发现为该地图新增下载的图片、音频、外部贴图或字体。此发现不能证明视觉表现不存在任何第三方权利争议。生成器本地使用 NumPy、ONNX Runtime、scikit-learn、tokenizers；不计划把这些 Python 包打入 Web 产物。若分发源码、工具或模型，需分别核对准确版本、依赖及适用许可与 NOTICE，不以 npm SBOM 覆盖本地 Python 工具。 |

## 可复核的本地证据

- 机器核验脚本：`.op-cache/source-investigation/audit_universe_rights.py`，SHA-256 `a0453505e3c0750c3c2761f2a04dbeaa56170a998c7675bcb9c640126de5f950`。
- 机器核验结果：`.op-cache/source-investigation/universe-rights-audit-20261123.json`，SHA-256 `071b34777976e44b45feb6c58a124d4387b6e9253d59c7ad188e7a44ec61ea53`；记录输入哈希、字段状态统计、两处规范化差异和每个词书的展示范围。里面没有用户学习记录、账户、反馈或密钥；`humanReview` 明确为未执行。
- 新关系与节点的逐字段机器追溯：`.op-cache/source-investigation/universe-output-trace-bb0c2651354ba8ae-v2.jsonl`，SHA-256 `ef9c9d4f1302a5d3fa4f58ca2e557b9087a00cb38a9f458b2aa6b1ee0f1d68ee`。所有项仍为 `pending`；不能以此填造人工审核结论。
- 前序证据与本机替代模型对比见 `docs/WORD_UNIVERSES_RIGHTS_EVIDENCE.md`；此前 309 项浏览器回归记录见 `docs/WORD_UNIVERSES_CANDIDATE.md`。本轮未重复运行同一全量回归；旧结果不是本次法律复核、发布凭据或成功 Web 构建。

复现本次机器核对时，准备已核验的 NLTK WordNet 包；输出必须为新的、尚不存在的路径：

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
$wordnetZip = Join-Path $env:APPDATA 'nltk_data\corpora\wordnet.zip'
py -3 .op-cache/source-investigation/audit_universe_rights.py --wordnet-zip $wordnetZip --out .op-cache/source-investigation/universe-rights-audit-new.json
```

## 后续条件

1. 确认现有公开 Web 发布的适用地区、运营/收费范围；就固定模型及实际数值输出取得与该范围匹配的充分证据或独立人工复核。联系模型方、微软或律师等任何外部主体须用户另行明确授权。
2. 基于新增关系/输出的实际用途确认变更集权利与内容正确性，评估当前词书外浏览的呈现范围；保留现有历史台账，不以机器记录替代人工审批。
3. 核验许可声明随最终构建产物交付，按受影响输入使用可复核的既有结果或运行必要验证；只有审批记录及现有构建、验证和正式工作区租约均满足后才可考虑回流或部署。

## 用户免费版发行指示后的复核

- 用户随后说明目前没有付费服务，并要求直接发布。本轮按现有公开免费测试版复查，不将历史收费发行全库阻断机械套用到普通维护；但免费并不自动证明非商业研究用途或解决新增模型及输出的证据缺口。上述 `UNIV-R-01`、`UNIV-R-05` 不因收费状态改变而自动解除；没有把用户的发布指示伪记成第三方授权或人工法律复核。
- 进一步找到 IBM Granite 30M 现成模型并做本地质量对比：发布方明确声明 Apache-2.0 商用、规避 MS MARCO，但其论文也提及 BookCorpus，具体版本、授权及与下游输出的关系仍待核对。固定权重与数据哈希、代理指标和局限见 `docs/WORD_UNIVERSES_RIGHTS_EVIDENCE.md` 的补充对比；原候选仍使用 BGE，IBM 未应用、未构建、未做页面验收，不能称为可部署替换。
- 只读核验发现原候选源码清单仍为 `d415b7e73e3eb66381cc231f9d24e0a45244ba9ba844f0b51cfefb985d42f7b3`，与此前 309 项测试记录相同；没有成功构建的 `dist`、没有匹配的成功发布凭据，候选清单仍未获审批。没有重复相同的全量回归、没有运行会清理缓存的部署预检、没有绕过门禁。远端 `main` 与正式本地 `main` 均为 `c4fc6e9c47b1ef763f5c94e538dbef134e155981`；正式工作区既有文档修改保留。
