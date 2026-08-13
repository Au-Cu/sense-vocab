begin;

do $$
declare
  v_entry jsonb;
  v_issue_id uuid;
  v_current_revision bigint;
  v_expected_revision bigint;
begin
  for v_entry in
    select value
    from jsonb_array_elements($updates$
    [
      {
        "issueKey": "LC-RISK-001",
        "expectedRevision": 1,
        "severity": "BLOCKER",
        "status": "remediation_in_progress",
        "title": "逐义项内容权利链仍未闭合，清洁候选待终审",
        "description": "当前运行时权利台账仍有 10,218 个义项处于 BLOCKER。清洁重建已覆盖 24,583 个目标字段，其中形成 21,848 个候选、2,735 个字段保持 evidence_pending；候选尚未获得用户终审，也未写入运行时词库。",
        "verifiedFacts": "候选批次 CD-CLEAN-CONTINUOUS-2026-08-12-A 保留稳定 ID、词书引用和用户状态边界；455 个重点字段已复核，其中 334 个独立重写、121 个原候选通过，重点范围 D-019 失败为 0。当前运行时仍为 10,235 个义项，权利台账为 CLEARED 17、BLOCKER 10,218。",
        "evidenceBasis": "artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json、当前 data/content-rights-ledger.jsonl 与 data/content-rights-ledger-summary.json。候选证据只证明整改进度，不证明内容已经获批、应用或商业清关。",
        "lcAnalysis": "重点复核和候选生成降低了后续人工整改成本，但 2,735 个字段缺少合法输入证据或仍被阻断，21,848 个候选也仍待用户逐字段终审；OpenAI Codex 的精确部署版本不可得。按 D-017 默认拒绝，整体风险保持 BLOCKER。",
        "releaseImpact": "收费、自动续费或大规模商业推广范围仍不可发行；本次候选不得作为已上线或已清关内容统计。",
        "remediationPlan": "完成用户逐字段终审；驳回或重做问题候选；补齐 2,735 个 evidence_pending 字段的合法输入证据；确认模型与供应商证据；仅将获批字段原位应用后重建运行时 bundle、身份锁验证和字段级权利台账。",
        "nextStep": "先完成候选文件终审，再对批准字段建立可回退变更集并运行内容身份、内容质量、D-019、字段级权利链和受影响范围测试。",
        "acceptanceEvidence": "批准字段的新旧值哈希、稳定内容 ID、输入权证据、模型或人工作者记录、审核人和日期、应用后 bundle/台账哈希及适用门禁结果；收费发行还需拟发行范围 BLOCKER/HIGH 清零。",
        "unresolvedQuestions": "2,735 个字段的合法输入证据如何补齐；OpenAI Codex 精确部署版本及适用商业证据尚未取得；用户终审结论尚未形成。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "涉及继续使用第三方原文、模型商业范围或无法独立确认的权利事项时，取得权利人、供应商或适格专业意见。",
        "owner": "CD / LC",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["24,583 个清洁目标字段", "21,848 个候选字段", "2,735 个 evidence_pending 字段", "data/content-rights-ledger.jsonl", "data/vocabulary-bundle.json"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"label":"当前内容权利台账","repoPath":"data/content-rights-ledger.jsonl","accessDate":"2026-08-12","sha256":"0892a39f1694958bc420aba869a1ee548c6252c7b9c070dd74a1647f7235f9a9"},
          {"label":"当前权利台账摘要","repoPath":"data/content-rights-ledger-summary.json","accessDate":"2026-08-12","sha256":"79086001753be50cdbbcf1392d66c46da7a5b56f7090f2588544e0238d0b04b9"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": "240cc81289792b0a65ebc10238495ff5de6f3724a7e2cd0bcf4c17c5fc2397d7",
        "contentHashAfter": "0892a39f1694958bc420aba869a1ee548c6252c7b9c070dd74a1647f7235f9a9",
        "changeSummary": "记录全量清洁候选与 455 个重点字段复核进度；风险级别保持 BLOCKER，候选继续待用户终审且未应用。"
      },
      {
        "issueKey": "LC-RIGHTS-001",
        "expectedRevision": 1,
        "severity": "BLOCKER",
        "status": "remediation_in_progress",
        "title": "2,840 条 SemCor 例句已生成独立候选但尚未替换",
        "description": "当前运行时仍有 2,840 条 exampleSource=semcor 的例句。清洁批次已按稳定 senseId 为这些目标生成独立候选，但候选尚待用户终审、尚未应用，不能消除现有 SemCor 商业再分发权利阻断。",
        "verifiedFacts": "当前运行时计数为 2,840；生成流程声明不把 SemCor 原句或译文作为模型输入，候选只使用已清关的目标义项锚点。候选包未修改运行时、数据库、词书引用或用户状态。",
        "evidenceBasis": "2026-08-12 合规看板证据清单、CONTENT_PROVENANCE.md、THIRD_PARTY_NOTICES.md 和候选机器证据哈希。",
        "lcAnalysis": "独立候选只有在用户终审通过、逐字段生成证据完整、原位应用并重建台账后，才可能移除对应运行时字段的 SemCor 阻断；当前阶段风险保持 BLOCKER。",
        "releaseImpact": "现有 SemCor 例句仍阻断拟发行范围的商业放行。",
        "remediationPlan": "逐字段终审独立候选，驳回语义漂移或证据不足项；批准后保持 wordId/senseId 不变原位替换，并保留新旧值哈希和完整生成证据。",
        "nextStep": "从审核文件完成 2,840 个 SemCor example 候选及相应译文的终审，批准后再进入应用变更集。",
        "acceptanceEvidence": "逐句稳定内容 ID、目标义项锚点权利证据、新旧值哈希、模型/作者记录、用户审核结论、应用后来源字段和权利台账。",
        "unresolvedQuestions": "用户终审尚未完成；精确模型部署版本证据仍缺失；未批准字段继续保持阻断。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "如任何运行时字段继续使用 SemCor 原文，需要权利人或适格书面意见确认商业再分发范围。",
        "owner": "CD",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["2,840 条 exampleSource=semcor 例句", "相应 exampleZh 候选", "data/content-rights-ledger.jsonl"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-12","sha256":"2da1325ad81e8e2da035521b64cc8b0953a439c60c3ab3a2e67e06d76ae0f82c"},
          {"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-12"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": null,
        "contentHashAfter": null,
        "changeSummary": "记录 2,840 条 SemCor 例句已有独立候选但未终审、未应用；风险级别保持 BLOCKER。"
      },
      {
        "issueKey": "LC-RIGHTS-002",
        "expectedRevision": 1,
        "severity": "BLOCKER",
        "status": "remediation_in_progress",
        "title": "8,917 个历史翻译字段已进入清洁候选，仍待终审",
        "description": "当前审计有 8,917 个历史 Google 翻译来源字段及 2 个历史外部服务阻断。清洁批次已基于字段级清关英文输入生成候选，但候选尚未终审或应用。",
        "verifiedFacts": "候选范围中历史 Google 翻译来源命中 8,917 个字段；候选生成规则禁止把旧译文作为输入或权利来源。当前 data/content-rights-summary.json 仍记录 translationSourcesRequiringCommercialReview=8917、legacyExternalServicesRequiringReplacement=2。",
        "evidenceBasis": "2026-08-12 合规看板证据清单与当前 data/content-rights-summary.json。",
        "lcAnalysis": "重新翻译候选改善了整改路径，但机器翻译或 AI 输出不自动清关；旧字段仍在运行时，且用户终审、精确模型证据和应用后字段级台账尚未完成，风险保持 BLOCKER。",
        "releaseImpact": "相关翻译与历史外部服务继续阻断商业发行。",
        "remediationPlan": "终审每个候选的目标义项绑定、自然度和双语对齐；批准后原位替换并记录新旧值哈希、输入权、模型版本、人工审核和应用后来源。",
        "nextStep": "完成 8,917 个历史翻译字段及相关新例句译文的用户终审；替换 2 个历史外部服务的剩余依赖。",
        "acceptanceEvidence": "逐字段稳定内容 ID、新旧值哈希、清关英文输入、模型资产与版本、提示词/参数哈希、用户审核结论和应用后权利台账。",
        "unresolvedQuestions": "用户终审和精确 Codex 部署版本证据尚缺；2 个历史外部服务仍未闭合。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / R&D",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["8,917 个历史 Google 翻译来源字段", "2 个历史外部服务", "data/content-rights-summary.json"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"label":"当前内容权利摘要","repoPath":"data/content-rights-summary.json","accessDate":"2026-08-12","sha256":"a5367d2e86294fa96f65c34ff5983f102de98b36119642b82ad018ae74c87672"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": "ed2bd8f5644dfa8de10d7e1f04bd9a00828d922b8f44e12f3bdd7c443f2f9c43",
        "contentHashAfter": "a5367d2e86294fa96f65c34ff5983f102de98b36119642b82ad018ae74c87672",
        "changeSummary": "把当前翻译阻断数更新为 8,917，并记录清洁候选已生成但仍待终审、未应用。"
      },
      {
        "issueKey": "LC-MODEL-INPUT-001",
        "expectedRevision": 1,
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "清洁批次已隔离旧内容输入，模型输入证据仍未完全闭合",
        "description": "本次清洁候选仅允许使用字段级清关的 WordNet 英文定义、目标义项锚点和相邻义项定义；旧翻译、SemCor、quotation、semantic 来源不明例句、用户反馈及个人信息均不得作为生成输入。仍有 2,735 个字段因合法输入证据不足保持 evidence_pending。",
        "verifiedFacts": "候选机器证据记录 legacyContentUsedAsRightsSource=false、无运行时或数据库写入；输入清单和提示词均有 SHA-256。重点 455 项的输入、修订清单和输出哈希已记录。",
        "evidenceBasis": "2026-08-12 合规看板证据清单、CONTENT_PROVENANCE.md 及候选批次输入/输出哈希。",
        "lcAnalysis": "本批输入隔离规则可验证，但不能补足 2,735 个字段缺失的输入权证据，也不能覆盖历史批次；风险维持 HIGH。",
        "releaseImpact": "缺少输入权证据的候选不得应用或标记 CLEARED，历史模型输入问题仍影响商业发行。",
        "remediationPlan": "为 evidence_pending 字段取得字段级清关输入，或继续阻断；对未来批次固定保存输入类别、来源、权利基础、哈希和个人信息排除记录。",
        "nextStep": "逐项补齐 2,735 个字段的输入权证据，并对应用批次生成最终输入清单哈希。",
        "acceptanceEvidence": "逐字段输入来源、权利人、许可证或合同版本、允许用途、输入哈希、隐私判断和批次关联。",
        "unresolvedQuestions": "2,735 个字段的可用合法输入仍待补齐；历史维护输入是否全部可追溯仍未知。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / R&D",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["CD-CLEAN-CONTINUOUS-2026-08-12-A 输入清单", "2,735 个 evidence_pending 字段", "历史模型输入批次"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-12","sha256":"2da1325ad81e8e2da035521b64cc8b0953a439c60c3ab3a2e67e06d76ae0f82c"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": null,
        "contentHashAfter": "7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83",
        "changeSummary": "记录清洁批次未使用旧内容作为输入权来源，并保留 2,735 个输入证据阻断；风险级别保持 HIGH。"
      },
      {
        "issueKey": "LC-MODEL-OUTPUT-001",
        "expectedRevision": 1,
        "severity": "HIGH",
        "status": "remediation_in_progress",
        "title": "21,848 个候选已生成，重点 455 项已复核，仍待用户终审",
        "description": "清洁批次已形成 21,848 个候选字段；455 个重点字段完成 CD 复核，其中 334 个独立重写、121 个通过原候选，重点范围 D-019 失败为 0。候选仍未获得用户终审，且精确 Codex 部署版本不可得。",
        "verifiedFacts": "候选分布为 definitionZh 8,803、example 5,351、exampleZh 7,694；每项保存稳定内容 ID、候选哈希、目标义项绑定、相邻义项排除和 D-019 判定。候选包状态明确为待用户审核、未写运行时、未写数据库、未部署。",
        "evidenceBasis": "2026-08-12 合规看板证据清单、审核工作簿与机器证据文件的 SHA-256。",
        "lcAnalysis": "结构化证据和重点复核提升了可审性，但人工/AI 复核不等同于用户批准或商业清关；精确模型版本缺失，且未覆盖全部候选的用户终审，风险保持 HIGH。",
        "releaseImpact": "候选不得直接进入收费商业发行范围，也不得计为已解决反馈或已清关运行时字段。",
        "remediationPlan": "完成用户逐字段终审；驳回或重做问题项；为批准项补齐精确可用的模型/供应商证据或采用可独立确认的原创路径；应用后重建字段级台账。",
        "nextStep": "由用户在审核文件中完成批准、驳回或需修改结论；随后只对批准字段建立应用变更集。",
        "acceptanceEvidence": "用户逐字段审核结论、最终候选哈希、模型/作者和输入权证据、应用后新旧值哈希、运行时来源及权利台账。",
        "unresolvedQuestions": "精确 Codex 部署版本不可得；21,848 个候选尚无用户终审结论；2,735 个字段仍无候选。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / LC",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["21,848 个候选字段", "455 个重点复核字段", "审核工作簿", "机器证据文件"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"label":"审核工作簿哈希","fileName":"Sense-Vocab-重点复核完成-待终审-2026-08-12.xlsx","accessDate":"2026-08-12","sha256":"6f0ec817d1cf0a7ff2ae95845d113a0d9405a19dba7c4a4796f8da34d29543bc"},
          {"label":"机器证据哈希","fileName":"Sense-Vocab-重点复核完成-机器证据-2026-08-12.json","accessDate":"2026-08-12","sha256":"e8f0aaf3b6cd749de37809e26f5ad746389bb676843aa6c98cd7ab937663b91c"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": null,
        "contentHashAfter": "7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83",
        "changeSummary": "记录 21,848 个候选和 455 个重点复核结果；候选仍待用户终审且未商业清关，风险级别保持 HIGH。"
      },
      {
        "issueKey": "LC-RIGHTS-003",
        "expectedRevision": 1,
        "severity": "CLEARED",
        "status": "closed",
        "title": "1,747 个运行时音频绑定具备逐项权利元数据",
        "description": "当前运行时 1,747 个带音频的义项均具备作者、许可证、Wikimedia Commons 来源页和证据哈希；本轮新增或修正 130 个音频绑定，并将 110 种已核验读音绑定到独立录音。",
        "verifiedFacts": "多发音变更集覆盖 112 种实际读音，其中 110 种具备独立录音；decrease 名词 /ˈdikris/ 与 insult 动词 /ɪnˈsʌlt/ 因无可靠专属录音保持为空并标为 evidence_pending，不在本次 CLEARED 音频字段范围内。变更集 138 个 audio/IPA/IPA-source 字段的字段级权利结论为 CLEARED。",
        "evidenceBasis": "data/content-change-sets/rd-multi-pronunciation-2026-08-12-rights-ledger.json、变更清单、当前运行时 bundle、Wikimedia 权利缓存和 104/104 测试结果。",
        "lcAnalysis": "CLEARED 仅覆盖当前运行时已绑定的 1,747 个音频字段及变更集明确列明的 138 个字段；不覆盖两种缺失录音、浏览器 TTS、外部发音服务、未来音频或整套词库的其他内容权利。",
        "releaseImpact": "当前已绑定 Wikimedia 音频不再因缺少逐项作者、许可证、来源页或证据哈希构成阻断；其他声线与商业发行问题仍由独立卡片控制。",
        "remediationPlan": "保持每次音频变更的逐字段证据、运行时署名展示和哈希同步；无法核验的专属读音继续留空。",
        "nextStep": "为两种缺失读音寻找可独立核验且可按许可证使用的专属录音；新增后重新建立变更集并复核。",
        "acceptanceEvidence": "1,747 个运行时音频字段逐项具备作者、许可证、来源页和证据哈希；130 个新增或修正绑定通过变更集权利门禁，正式域名核心文件与已验证 dist 哈希一致。",
        "unresolvedQuestions": "decrease 名词与 insult 动词的专属录音仍缺失；此项不改变其他音频服务或声线的未清关状态。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D / CD",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["1,747 个运行时音频绑定", "130 个新增或修正音频字段", "110 种已核验独立录音", "data/wikimedia-audio-rights-cache.json"],
        "evidenceRefs": [
          {"label":"多发音字段级权利台账","repoPath":"data/content-change-sets/rd-multi-pronunciation-2026-08-12-rights-ledger.json","accessDate":"2026-08-12","sha256":"acbd318029b03b28439d172e48cc387fb2ee911f8189d5fce3a122ed189a341a"},
          {"label":"多发音变更清单","repoPath":"data/content-change-sets/rd-multi-pronunciation-2026-08-12.json","accessDate":"2026-08-12","sha256":"4ad46d43e4585a0c1064a86a96e0e8366e6562abe7582aebcd1c935def12b7a2"},
          {"label":"当前运行时词库","repoPath":"data/vocabulary-bundle.json","accessDate":"2026-08-12","sha256":"bab0df3b7e655658bbd10b9a99de0be5621d693e4588c1eee2aa274b3bf69f0a"},
          {"label":"Wikimedia 权利缓存","repoPath":"data/wikimedia-audio-rights-cache.json","accessDate":"2026-08-12","sha256":"a215a75e01ff6b731ea9c4925dd5f8036eebb8a2660b3b9d2c34723b398c8b71"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"当前 Web 运行时已绑定的 Wikimedia 音频","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {"authorOrRightsholder":"逐文件作者或权利人见运行时字段与字段级权利台账","licenseOrPermission":"逐文件 Wikimedia Commons 许可证见运行时字段与证据缓存","sourceUrl":"https://commons.wikimedia.org/","versionOrDate":"2026-08-12 当前运行时与变更集核验","commercialScope":"仅适用于当前运行时已绑定的 1,747 个 Wikimedia 音频字段并持续履行各自许可证条件；不覆盖两种缺失录音、TTS、外部服务或未来音频","sha256":"acbd318029b03b28439d172e48cc387fb2ee911f8189d5fce3a122ed189a341a"},
        "contentHashBefore": "f52aa4ef650751602adf9a396fe84a3076d02125d096521ed4141113040d6774",
        "contentHashAfter": "bab0df3b7e655658bbd10b9a99de0be5621d693e4588c1eee2aa274b3bf69f0a",
        "changeSummary": "把 Wikimedia 音频 CLEARED 适用范围更新到当前 1,747 个运行时绑定，并明确两种缺失录音不在清关范围。"
      },
      {
        "issueKey": "LC-VOICE-001",
        "expectedRevision": 1,
        "severity": "HIGH",
        "status": "remediation_in_progress",
        "title": "多发音独立录音已补齐大部，TTS 与外部声线范围仍待确认",
        "description": "本轮核对 112 种实际读音，110 种已绑定具备逐项权利证据的独立 Wikimedia 录音；两种无可靠专属录音的读音保持为空。浏览器/操作系统 TTS、外部发音服务及其商业条款仍未形成完整适用清单。",
        "verifiedFacts": "自动、手动和教程播放会按实际读音播放全部已核验独立录音；同一读音或 URL 去重，单条失败继续。decrease 名词和 insult 动词不使用其他读音冒充。已绑定音频字段的署名缺口为 0。",
        "evidenceBasis": "2026-08-12 多发音变更集、字段级权利台账、当前运行时 bundle、THIRD_PARTY_NOTICES.md 和公网哈希核对。",
        "lcAnalysis": "本次对 Wikimedia 文件层的修复不自动覆盖浏览器/操作系统 TTS 服务条款、外部发音服务合同、声线人格权或目标司法辖区；整体声线卡风险保持 HIGH。",
        "releaseImpact": "当前已绑定 Wikimedia 录音可以按各自许可证使用，但未确认的 TTS/外部声线路径仍限制商业渠道和发行判断。",
        "remediationPlan": "逐路径记录供应商、声线、条款版本、商业用途、地区限制、回退行为和必要人格权依据；无可靠专属录音时继续留空。",
        "nextStep": "核对当前实际启用的浏览器/操作系统 TTS 与任何外部发音回退，形成目标设备、渠道和司法辖区的适用清单。",
        "acceptanceEvidence": "逐路径服务条款、版本、地区、商业范围、必要人格权依据及真实设备回退验证。",
        "unresolvedQuestions": "目标设备和浏览器范围尚未确定；两种专属录音仍缺失；TTS 与外部发音服务条款尚未闭合。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "必要时由服务供应商、权利人或适格专业人员确认商业使用和声线人格权范围。",
        "owner": "R&D / LC",
        "reviewer": "CD（用户授权更新）",
        "affectedAssets": ["110 种已核验独立录音", "2 种缺失专属录音", "浏览器与操作系统 TTS", "外部发音回退"],
        "evidenceRefs": [
          {"label":"2026-08-12 合规看板证据清单","repoPath":"artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json","accessDate":"2026-08-12","sha256":"7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83"},
          {"label":"多发音字段级权利台账","repoPath":"data/content-change-sets/rd-multi-pronunciation-2026-08-12-rights-ledger.json","accessDate":"2026-08-12","sha256":"acbd318029b03b28439d172e48cc387fb2ee911f8189d5fce3a122ed189a341a"},
          {"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-12"}
        ],
        "applicableScope": {"appVersion":"1.5.0","commitSha":null,"channels":["Web"],"businessModel":"收费、自动续费或大规模商业推广","jurisdictions":[],"reviewDate":"2026-08-12"},
        "rightsClearance": {},
        "contentHashBefore": "f52aa4ef650751602adf9a396fe84a3076d02125d096521ed4141113040d6774",
        "contentHashAfter": "bab0df3b7e655658bbd10b9a99de0be5621d693e4588c1eee2aa274b3bf69f0a",
        "changeSummary": "记录 110 种独立录音已补齐、两种读音明确留空；TTS 与外部声线风险仍保持 HIGH。"
      }
    ]
    $updates$::jsonb)
  loop
    select issue.id
    into v_issue_id
    from public.compliance_issues as issue
    where issue.issue_key = v_entry ->> 'issueKey'
    for update;

    if not found then
      raise exception 'Compliance issue % not found', v_entry ->> 'issueKey';
    end if;

    select snapshot.revision
    into v_current_revision
    from public.compliance_issue_snapshots as snapshot
    where snapshot.issue_id = v_issue_id
    order by snapshot.revision desc
    limit 1;

    v_expected_revision := (v_entry ->> 'expectedRevision')::bigint;
    if v_current_revision is distinct from v_expected_revision then
      raise exception 'Compliance issue % revision conflict: expected %, current %',
        v_entry ->> 'issueKey', v_expected_revision, v_current_revision
        using errcode = '40001';
    end if;

    insert into public.compliance_issue_snapshots (
      issue_id, revision, severity, lifecycle_status, title,
      problem_description, verified_facts, evidence_basis, lc_analysis,
      release_impact, remediation_plan, next_step_solution,
      acceptance_evidence, unresolved_questions,
      external_confirmation_required, external_confirmation,
      owner_name, reviewer_name, review_due_at, affected_assets,
      evidence_refs, applicable_scope, rights_clearance,
      content_hash_before, content_hash_after, change_summary,
      created_by, created_at
    ) values (
      v_issue_id,
      v_current_revision + 1,
      v_entry ->> 'severity',
      v_entry ->> 'status',
      v_entry ->> 'title',
      v_entry ->> 'description',
      v_entry ->> 'verifiedFacts',
      v_entry ->> 'evidenceBasis',
      v_entry ->> 'lcAnalysis',
      v_entry ->> 'releaseImpact',
      v_entry ->> 'remediationPlan',
      v_entry ->> 'nextStep',
      v_entry ->> 'acceptanceEvidence',
      v_entry ->> 'unresolvedQuestions',
      coalesce((v_entry ->> 'externalConfirmationRequired')::boolean, false),
      coalesce(v_entry ->> 'externalConfirmation', ''),
      coalesce(v_entry ->> 'owner', ''),
      coalesce(v_entry ->> 'reviewer', ''),
      null,
      coalesce(v_entry -> 'affectedAssets', '[]'::jsonb),
      coalesce(v_entry -> 'evidenceRefs', '[]'::jsonb),
      coalesce(v_entry -> 'applicableScope', '{}'::jsonb),
      coalesce(v_entry -> 'rightsClearance', '{}'::jsonb),
      nullif(v_entry ->> 'contentHashBefore', ''),
      nullif(v_entry ->> 'contentHashAfter', ''),
      v_entry ->> 'changeSummary',
      null,
      clock_timestamp()
    );
  end loop;
end;
$$;

do $$
declare
  v_current_revision bigint;
begin
  perform pg_advisory_xact_lock(hashtext('sense-vocab-compliance-release'));

  select release.revision
  into v_current_revision
  from public.compliance_release_snapshots as release
  order by release.revision desc
  limit 1;

  if v_current_revision is distinct from 1 then
    raise exception 'Compliance release revision conflict: expected 1, current %',
      v_current_revision using errcode = '40001';
  end if;

  insert into public.compliance_release_snapshots (
    revision, conclusion, app_version, commit_sha, channels, business_model,
    jurisdictions, review_date, evidence_generated_at, scope_notes, basis,
    evidence_refs, reviewer_name, change_summary, created_by, created_at
  ) values (
    2,
    'not_releasable',
    '1.5.0',
    null,
    '["Web"]'::jsonb,
    '收费、自动续费或大规模商业推广',
    '[]'::jsonb,
    date '2026-08-12',
    timestamptz '2026-08-12T23:41:37+08:00',
    '当前 Web 运行时来自包含未提交部署改动的工作树，无法用 HEAD commit 单独标识。清洁候选基线为旧 bundle f52aa4…，当前运行时 bundle 为 bab0df…；候选尚未应用，后续应用前必须按当前字段值重新核对。具体司法辖区仍未确认。',
    '商业发行结论维持不可发行：当前运行时权利台账仍有 10,218 个 BLOCKER 义项；21,848 个清洁候选尚待用户终审且未应用；2,735 个目标字段保持 evidence_pending；OpenAI Codex 精确部署版本不可得，候选未商业清关；运营主体、司法辖区、供应商、隐私和其他独立 BLOCKER/HIGH 仍未闭合。多发音变更集对 138 个 audio/IPA/IPA-source 字段的局部 CLEARED 不扩张为整套词库或收费商业发行清关。',
    jsonb_build_array(
      jsonb_build_object('label','2026-08-12 合规看板证据清单','repoPath','artifacts/compliance/compliance-dashboard-evidence-2026-08-12.json','accessDate','2026-08-12','sha256','7ef8f59b9d45e10e44ca77f7bdabccb6e05d164d8e3e6e74df2f7808ab7d9b83'),
      jsonb_build_object('label','当前内容权利台账','repoPath','data/content-rights-ledger.jsonl','accessDate','2026-08-12','sha256','0892a39f1694958bc420aba869a1ee548c6252c7b9c070dd74a1647f7235f9a9'),
      jsonb_build_object('label','当前运行时词库','repoPath','data/vocabulary-bundle.json','accessDate','2026-08-12','sha256','bab0df3b7e655658bbd10b9a99de0be5621d693e4588c1eee2aa274b3bf69f0a'),
      jsonb_build_object('label','多发音字段级权利台账','repoPath','data/content-change-sets/rd-multi-pronunciation-2026-08-12-rights-ledger.json','accessDate','2026-08-12','sha256','acbd318029b03b28439d172e48cc387fb2ee911f8189d5fce3a122ed189a341a'),
      jsonb_build_object('label','商业发行检查清单','repoPath','COMMERCIAL_RELEASE_CHECKLIST.md','accessDate','2026-08-12')
    ),
    'CD（用户授权更新）',
    '同步 2026-08-12 清洁候选复核与多发音权利证据；商业发行结论维持不可发行。',
    null,
    clock_timestamp()
  );
end;
$$;

commit;
