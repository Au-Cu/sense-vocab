# 商业发布门禁与人工办理清单

更新：2026-08-09

## 当前结论

**不可按收费、自动续费或大规模商业推广场景发行。** 仓库已经建立严格机器门禁，但内容权利、运营主体、监管路径、供应商合同和生产部署证据尚未全部闭合。`npm run verify:commercial-release` 必须在所有 `BLOCKER` 和 `HIGH` 项清零后才允许通过。

## 1. 内容与版权

- [ ] 为当前 10,235 个义项逐字段完成 `data/content-rights-ledger.jsonl`，不允许以抽样替代。
- [ ] 处理 quotation、semantic 例句、历史翻译来源、来源不明的释义/翻译和有道发音回退；取得书面授权或保持 ID 兼容地原创重写/合法替换。
- [ ] 对 Wikimedia、Tatoeba、Wiktionary/Kaikki 逐项满足许可证、署名、ShareAlike、修改说明和再分发要求。
- [ ] 对模型架构、权重、训练数据、输入、输出、声线和人格权分别留证，不因任一层开放而放行整体。
- [ ] 运行 `npm run enrich:rights`、`npm run audit:content`、`npm run build:rights-ledger` 和 `npm run verify:commercial-release`。

历史文档中的 8,944 是旧审计口径；当前基线应由最新审计生成，不得手工复制。2026-08-09 重新生成前的已知当前记录数为 **8,929**，最终数字以本次生成的 `data/content-rights-summary.json` 和权利台账为准。

## 2. 软件、字体、图片、模型与发布包

- [ ] 运行 `npm run build:third-party-compliance`，检查 `SBOM.cdx.json` 与 `THIRD_PARTY_LICENSES.md` 包含 Three.js 0.185.1 及所有生产和构建依赖。
- [ ] 确认许可证文本、版权声明、NOTICE、源码提供或 ShareAlike 义务随适当发布渠道交付。
- [ ] 对字体、图标、公告图片、反馈附件、品牌素材和 AI 生成内容保存来源、作者、授权、版本、哈希和下架记录。
- [ ] 核验构建后的 `dist/` 确实包含当前 SBOM、许可证包、权利汇总和法律文件。

## 3. 法律文件、同意与隐私

- [ ] 将 v3 法律文档与迁移部署到同一生产版本，核验内容 SHA-256 与 `legal_document_versions` 一致。
- [ ] 验证老用户因 v3 被阻断在重新同意页，记录 v3 后才恢复云端学习数据访问；拒绝不默认为同意。
- [ ] 补全运营主体全称、依法需公开的登记信息、联系地址、隐私/投诉/安全邮箱及响应时限。
- [ ] 与 Cloudflare、Supabase、邮件和其他供应商签署或确认适用 DPA、子处理者、数据位置、跨境机制、删除和事件通知条款。
- [ ] 对账户、学习记录、反馈、附件、日志、邮件、快照和供应商副本完成数据地图、最小必要和删除验证。

## 4. 反馈保留与数据库安全

- [ ] 部署迁移 `20260809060413_compliance_release_controls.sql` 和 `process-feedback-retention` Edge Function。
- [ ] 在 Supabase Vault 配置 `project_url` 与 `retention_secret_key`，执行隔离记录的端到端 180 天保留测试。
- [ ] 查询生产数据库函数 ACL、`SECURITY DEFINER`、`search_path`、RLS 和 Storage policy；通过 anon、普通用户、管理员、service role 权限矩阵测试。
- [ ] 监控 cron 运行、失败队列和审计日志，验证附件先删、数据库后删及失败重试。

## 5. 运营主体、司法辖区与监管

- [ ] 确定运营主体、用户所在地、服务器和供应商位置、Web/应用商店渠道、收费方式、退款与自动续费规则。
- [ ] 中国大陆提供服务前，以实际主体和架构确认 ICP 备案/许可、APP 备案、网络出版或其他内容资质、个人信息跨境路径及未成年人要求。
- [ ] 香港或其他目标地区发行前，分别评估当地隐私、消费者、电子交易、自动续费、广告与未成年人规则。
- [ ] 保留主管部门答复、许可证、备案号、律师书面意见和适用范围；用户愿意承担风险不能替代这些义务。

## 6. 收费、宣传与投诉

- [ ] 商户主体、价格、周期、权益、取消、退款、发票、自动续费提醒和投诉处理通过真实沙箱及渠道规则测试。
- [ ] 不使用“官方指定”“保证提分”“绝不侵权”等无法证明的陈述；“雅思词汇”持续声明与 IELTS 官方无隶属、授权或赞助关系。
- [ ] 邀请奖励须明确资格、期限、限制、防刷和撤销规则，不构成误导或非法营销激励。

## 7. 最终验收

- [ ] `npm run verify:content-identity`
- [ ] `npm run audit:supabase-security`
- [ ] `npm run build:web`
- [ ] `npm test`
- [ ] `npm run verify:commercial-release`
- [ ] 对最终 `dist/` 计算哈希并与源文件、SBOM、许可证包和权利汇总核对。
- [ ] 在目标生产环境复核迁移、Edge Function、定时任务、权限、同意版本、公告下架、删除链路和公开法律文件。

只有全部门禁通过且外部必须确认事项取得适格书面证据后，才可在该明确主体、版本、渠道、司法辖区和商业模式下标记 `CLEARED`；这不表示永久或零风险。
