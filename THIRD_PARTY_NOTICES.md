# 第三方内容与软件声明

版本：2026-07-29-v1

本文件记录“义项背词”免费测试版已知使用或参考的第三方内容和软件。具体词条的
`exampleSource`、`exampleSourceId`、`exampleOwner` 和 `exampleLicense`
元数据在可用时随内容保存。缺少完整权利链的内容列入
`data/content-rights-audit.json`，在完成授权或独立重写前不得用于付费商业版本。

## Princeton WordNet 3.0 / SemCor

- 项目：https://wordnet.princeton.edu/
- 许可证：https://wordnet.princeton.edu/license-and-commercial-use

WordNet Release 3.0

This software and database is being provided to you, the LICENSEE, by Princeton
University under the following license. By obtaining, using and/or copying this
software and database, you agree that you have read, understood, and will comply
with these terms and conditions.

Permission to use, copy, modify and distribute this software and database and
its documentation for any purpose and without fee or royalty is hereby granted,
provided that you agree to comply with the following copyright notice and
statements, including the disclaimer, and that the same appear on ALL copies of
the software, database and documentation, including modifications that you make
for internal use or for distribution.

WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON UNIVERSITY MAKES NO
REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED. BY WAY OF EXAMPLE, BUT NOT
LIMITATION, PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF
MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY
PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.

The name of Princeton University or Princeton may not be used in advertising or
publicity pertaining to distribution of the software and/or database. Title to
copyright in this software, database and any associated documentation shall at
all times remain with Princeton University and LICENSEE agrees to preserve same.

## Open Multilingual Wordnet

- 项目：https://omwn.org/
- 许可证：CC BY 4.0
- 许可证全文：https://creativecommons.org/licenses/by/4.0/
- 使用时需保留项目名称、来源链接、许可证及修改说明。

## Wiktionary / Kaikki

- Wiktionary：https://en.wiktionary.org/
- Kaikki：https://kaikki.org/
- 许可证：数据项通常按 CC BY-SA 3.0 提供，具体以来源页面为准。
- 许可证全文：https://creativecommons.org/licenses/by-sa/3.0/
- Wiktionary 版权说明：https://en.wiktionary.org/wiki/Wiktionary:Copyrights
- Kaikki 数据说明：https://kaikki.org/dictionary/
- 来源中的第三方书籍或新闻引文可能另受原作品权利限制，已列为待复核内容。

## Tatoeba

- 项目：https://tatoeba.org/
- 下载与许可：https://tatoeba.org/en/downloads
- 句子通常采用 CC BY 2.0 FR 或由贡献者另行标注的许可证。
- CC BY 2.0 FR：https://creativecommons.org/licenses/by/2.0/fr/deed.en
- 应按句保留句子 ID、贡献者和许可证；缺少这些字段的句子列为待复核内容。

## ECDICT

- 项目：https://github.com/skywind3000/ECDICT
- 许可证：MIT License，以项目仓库所附许可证为准。
- 当前仅将其标签用于非官方词书范围整理，不表示任何考试机构认可。

## CMU Pronouncing Dictionary

- 项目：http://www.speech.cs.cmu.edu/cgi-bin/cmudict
- 仓库：https://github.com/cmusphinx/cmudict
- 许可证：BSD-style license，以项目发行包所附许可证为准。

## Argos / OPUS-MT 英中模型

- 本地模型包：English - Chinese version 1.9
- 作者：Jörg Tiedemann、Santhosh Thottingal
- 论文：OPUS-MT — Building open translation services for the World
- 许可证：原始 OPUS 模型为 CC BY 4.0
- 许可证全文：https://creativecommons.org/licenses/by/4.0/
- 本项目将该模型用于离线英译中维护，并对输出继续进行内容审核；使用方式相对于原始模型
  增加了本地 CTranslate2 推理和应用侧清洗。

## 发音

历史词库包含来自 Wikimedia Commons 的远程音频链接，但没有逐文件保存作者、
许可证和来源页信息。为避免免费测试版发音功能缺失，当前继续保留这些链接，并尝试通过
Wikimedia Commons 官方 API 补齐 `audioAuthor`、`audioLicense` 和
`audioSourcePage`。每个文件的许可条件可能不同，付费发布前仍需逐文件核验并提供署名。

当词条没有 Wikimedia 音频或播放失败时，当前免费测试版暂时调用有道发音接口，
再失败时使用浏览器本地语音合成。该有道接口尚无书面商业授权证明，因此只作为功能兼容
回退保留，不应直接沿用到付费版本。

## 临时翻译回退

英译中维护已使用上面的本地 Argos/OPUS 模型。少量需要中译英的离线维护脚本由于尚未
配置同方向的合规模型，暂时保留历史非正式 Google Translate 端点。该端点不会在浏览器
运行时调用，也不得直接用于付费商业内容生产；应在商业发布前替换为有合同的正式服务或
许可清晰的本地中英模型。

## 前端依赖

- Supabase JavaScript Client：https://github.com/supabase/supabase-js （MIT）
- esbuild：https://github.com/evanw/esbuild （MIT）
- Playwright：https://github.com/microsoft/playwright （Apache-2.0）

构建产生的 `cloud-client.js.LEGAL.txt` 保存打包依赖中要求保留的法律注释。
