# 第三方内容与软件声明

版本：2026-08-09-v3

本文件是人工维护的核心声明。完整 npm 组件、精确安装版本、包哈希、许可证标识和随包许可证文本由 `npm run build:third-party-compliance` 生成到：

- `SBOM.cdx.json`：CycloneDX 1.6 SBOM；
- `THIRD_PARTY_LICENSES.md`：逐包许可证与本地许可证文件；
- `data/content-rights-ledger.jsonl`：当前 10,235 个义项的逐字段内容权利台账。

生成器分别记录“安装包未附独立许可证文件”和“许可证声明证据未验证”。前者是客观发行物状态，后者才表示证据缺口；不得用另一个项目的同名许可证文本替代。`THIRD_PARTY_LICENSE_EVIDENCE.json` 保存精确版本、上游引用、本地与官方文件哈希及独立许可证文件不存在的核查结论。

“开源”“免费”“可下载”或某一层采用开放许可证，不代表整项内容、模型、权重、训练数据、声音、生成输出及服务条款均可商业使用。

## 软件依赖

- Three.js 0.185.1，MIT，版权归 Three.js authors，官方许可证：<https://github.com/mrdoob/three.js/blob/r185/LICENSE>。
- Supabase JavaScript Client，MIT，<https://github.com/supabase/supabase-js>。
- esbuild，MIT，<https://github.com/evanw/esbuild>。
- Playwright，Apache-2.0，<https://github.com/microsoft/playwright>。
- Supabase CLI 2.110.0：安装包 `package.json` 与 README、官方 `v2.110.0`（提交 `71ecf66abdd4d3860d45adda7757e6bb79bb8a0c`）均声明 MIT；上游与安装包均没有独立 LICENSE 文件，准确哈希见 `THIRD_PARTY_LICENSE_EVIDENCE.json`。
- npm `wordnet` 2.0.0：安装包及其 npm `gitHead` `e3204844cce55f07fe552f0dad08bc2798799992` 的 `package.json` 与 README 均声明 MIT，同时 README 单独链接 Princeton WordNet 数据许可证；上游与安装包均没有独立 LICENSE 文件。`wordnet-db` 数据许可继续单独适用，不能由包代码 MIT 覆盖。

构建产物中的 `cloud-client.js.LEGAL.txt` 继续保留打包器提取的法律注释；它不能替代完整 SBOM 和许可证包。

## Princeton WordNet 3.0 / SemCor

- 项目：<https://wordnet.princeton.edu/>
- 官方许可：<https://wordnet.princeton.edu/license-and-commercial-use>
- 必须保留：`WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.`
- 许可证允许使用、复制、修改和分发，但要求在全部软件、数据库和文档副本中保留版权、许可条件与免责声明；不得将 Princeton 名称用于相关广告或宣传。
- 2,845 条标记为 SemCor 的例句不再按 WordNet 许可归因；其作者和商业再分发许可仍未知，当前全部保持阻断。

## Open Multilingual Wordnet

- 项目：<https://omwn.org/>
- 许可证：CC BY 4.0，<https://creativecommons.org/licenses/by/4.0/>。
- 再分发时保留项目名称、来源链接、许可证及修改说明。

## Wiktionary / Kaikki

- Wiktionary：<https://en.wiktionary.org/>；版权说明：<https://en.wiktionary.org/wiki/Wiktionary:Copyrights>。
- Kaikki：<https://kaikki.org/dictionary/>；本次记录为 2026-07-25 提取、基于 2026-07-06 enwiktionary dump。
- Wiktionary 当前版权页提供 CC BY-SA 4.0 与 GFDL 1.3 双许可路径；Sense Vocab 对本次冻结数据选择 CC BY-SA 4.0，逐项保存词条页、历史页、版权页、贡献者集合署名、许可证链接、修改说明、版本和哈希。
- quotation 或嵌入的第三方作品可能另受原作品权利限制，不能只凭 Wiktionary/Kaikki 的集合许可证放行。

## Tatoeba

- 项目：<https://tatoeba.org/>；条款：<https://tatoeba.org/en/terms_of_use>；语料使用说明：<https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus>。
- 每条句子使用 Tatoeba API v1 当前返回的句子许可证和作者状态，不以历史默认许可证替代逐项证据。
- 保存句子 ID、文本核对状态、句子页、作者或 unowned 状态、许可证、API 记录、获取时间和证据 SHA-256。

## Wikimedia Commons 音频

- 项目：<https://commons.wikimedia.org/>；署名说明：<https://commons.wikimedia.org/wiki/Commons:Credit_line>。
- 每个音频文件的作者、许可证、署名和再利用条件可能不同。项目通过 MediaWiki API `imageinfo/extmetadata` 保存逐文件证据，仍须满足具体文件页的署名、相同方式共享或其他条件。
- 有道发音回退没有已验证的书面商业授权，仍为商业发行阻断项；浏览器本地 TTS 还需按实际浏览器、操作系统和声线条款单独评估。

## ECDICT、CMUdict 与翻译模型

- ECDICT：<https://github.com/skywind3000/ECDICT>，以仓库所附 MIT 许可证为准；标签不代表考试机构认可。
- CMU Pronouncing Dictionary：<https://github.com/cmusphinx/cmudict>，以发行包所附 BSD-style 许可证为准。
- Argos/OPUS-MT English-Chinese 1.9：记录为 CC BY 4.0，需保留模型包、作者、版本、来源、修改与人工复核证据。模型许可证不自动覆盖训练数据之外的输入或输出权利。
- 历史非正式 Google Translate 端点没有可验证的生产商业合同，仅限隔离的维护兼容，不得作为付费内容生产依据。

## AI 生成或辅助内容

公告与反馈附件分别记录 AI 声明。公告发布要求记录文本来源、模型或供应商、模型名称、提示词哈希、人工复核和面向用户的披露标志；含可识别人物还需记录肖像或个人信息处理依据。权利投诉通过后台下架工作流处理，保留理由和管理员审计记录，不以直接删除掩盖来源问题。
