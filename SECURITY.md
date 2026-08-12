# 安全说明

版本：2026-08-09-v3

## 已落地的仓库控制

- Supabase 表启用 RLS，写操作通过受限 RPC 与并发版本校验。
- `SECURITY DEFINER` 函数固定空 `search_path`；迁移撤销 `public`、`anon`、`authenticated` 的默认函数执行权，只按浏览器 RPC 白名单重新授权。
- 匿名公告读取改为 `SECURITY INVOKER`，且只返回权利状态为 `verified` 的已发布公告；账户通知使用认证 RPC。
- 反馈和公告图片保存在私有或受控 Storage 路径；客户端限制数量、格式、像素与体积并重新编码。
- 公告发布要求权利基础、作者或授权、人物同意依据、AI 来源与人工复核；下架采用“标记下架 → 删除 Storage → 完成审计”的顺序。
- CSP、HSTS、禁止嵌入、MIME 嗅探防护和最小浏览器权限已配置。
- `npm run audit:supabase-security` 生成 `data/supabase-security-audit.json`；`npm run verify:commercial-release` 将关键安全缺口纳入商业发行门禁。

## 部署前验收

1. 在本地重建数据库并运行全部迁移与测试。
2. 将新迁移和 Edge Function 部署到目标 Supabase 项目，再查询实际函数 owner、`prosecdef`、`proconfig` 和 ACL，不以迁移文本代替生产验证。
3. 验证 anon、普通认证用户、管理员和 service role 的允许/拒绝矩阵。
4. 配置保留任务 Vault secrets，做一条隔离测试记录的端到端删除演练。
5. Supabase、Cloudflare 和管理员账户启用 MFA；密钥使用独立权限与轮换策略。

## 运营要求

- 不得把 service-role key、数据库密码、管理员令牌或保留任务 secret 写入前端、仓库、截图或工单。
- 至少每月检查管理员访问、异常认证、失败保留任务和供应商安全通知。
- 至少每季度验证备份可恢复性，记录恢复时间、数据范围和演练结果。
- 对生产变更保存迁移版本、执行人、时间、验证查询与回滚方案。

## 漏洞报告

应用内反馈可用于说明受影响页面、复现步骤和影响范围，但不得附带真实用户数据或凭据。正式商业运营前仍需公布独立安全联系方式、漏洞分级、响应时限和必要的监管通知流程。
