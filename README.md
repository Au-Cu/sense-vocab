# Sense Vocab

Sense Vocab 是一款按“单词义项”而不是只按“单词”学习的英语词汇网页应用。它优先保证长期可坚持、学习状态可信和数据安全，并支持游客本地学习与账户多设备同步。

当前提供《考研词汇》和《雅思词汇》两本词书。每本词书独立维护计划、义项状态、学习记录和统计，同时共用经过身份锁保护的单词与义项内容池。

正式版本的新功能、问题修复、内容调整、兼容性说明和验证结果统一记录在 [GitHub Releases](https://github.com/Au-Cu/sense-vocab/releases) 中。

## 运行

双击项目根目录的 `start-app.bat`，程序会启动本地服务并自动打开浏览器。默认地址：

`http://127.0.0.1:4173/`

## 游客与账户

- 默认使用游客模式，完整学习记录继续保存在当前浏览器的 `localStorage`。
- 首页“更多 > 账户”可注册、登录、找回密码、退出、删除账户，并可手动导出或导入 JSON 备份。
- 注册只需填写一次邮箱和密码，再输入 10 分钟内有效的邮箱验证码；找回密码使用同样的邮箱验证码流程。
- 每个账户拥有一枚一次性邀请码。邀请码兑换成功后旧码立即失效并自动生成新码，邀请双方各延长 14 天会员。
- 第一次登录时，本机游客记录会复制到该账户的独立本地缓存，再上传到云端；原游客记录不会被删除。
- 如果本机和云端同时存在不同记录，程序会并排展示已学单词、义项状态、学习天数、最近学习日期和计划差异；默认推荐安全合并，只保留某一份收进高级选项。
- 登录后每次学习通常先落盘到本机账户缓存；断网时可继续使用，恢复联网后自动同步。本地空间不足时会先自动压缩旧缓存，仍无法写入则在当前页面保留更新并优先同步云端。
- 云端采用版本号进行乐观并发控制。另一台设备已经写入更新时，当前设备会先拉取并按义项、日期、学习窗口自动合并，把收敛结果写入本地账户缓存和云端并回读复核，再以新修订号重试；无法安全自动判定时才要求用户选择记录。
- 多词书状态会作为同一个账户快照同步；计划、义项状态、学习记录、热力图和单词列表统计均按词书隔离。
- 旧版单词书状态会自动迁入《考研词汇》，不会复制到《雅思词汇》或清空原来的学习记录。

## 网页发布

创建只包含运行文件的 Cloudflare Pages 发布目录：

```powershell
npm install
npm run build:web
```

产物位于 `dist/`。若未提供 Supabase 环境变量，构建会沿用项目根目录
`cloud-config.js` 中的公开配置。

需要临时覆盖云项目时，可在构建前同时设置：

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
npm run build:web
```

也可以生成适合 Cloudflare Pages“直接上传”的压缩包：

```powershell
npm run package:web
```

压缩包为项目根目录下的 `sense-vocab-web.zip`。登录 Cloudflare 并部署：

```powershell
npm run cloudflare:login
npm run deploy:cloudflare
```

项目内的 Wrangler 启动器会在当前 Windows ARM64 环境自动改用可用的 x64 Node 运行时。若不使用命令行，也可以在 Cloudflare Pages 控制台直接上传 `dist/` 或压缩包。

## Supabase 数据库

数据库迁移位于 `supabase/migrations/`，包含：

- `profiles`
- `plans`
- `user_state_meta`
- `sense_progress`
- `daily_activity`
- `study_windows`
- `admin_users`
- `feedback_reports`
- 私有的 `feedback-images` Storage bucket
- 基于 `auth.uid()` 的 RLS 策略
- 原子读取、保存、反馈、统计和删除账户 RPC
- 账户快照读取使用数据库共享锁，写入使用修订号 CAS，禁止无版本覆盖。
- 多设备冲突会按义项、日期和学习窗口自动合并；同一义项的并发分歧采用更保守的学习状态。
- 每个浏览器设备拥有稳定版本向量，历史标签页标识会按设备安全合并；重新联网、窗口重新获得焦点及定时轮询都会拉取其他设备更新。
- 学习状态表不向浏览器开放直接写权限，只能通过受输入大小、结构与修订号校验的事务 RPC 保存。

关联 Supabase 项目并应用迁移：

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase config push
```

应用数据库迁移前必须先执行 dry run 并检查实际变更。项目迁移采用追加方式，不得借迁移直接批量改写学习记录、义项状态或用户计划。

前端只允许使用 Supabase 的 Publishable Key（或旧名称 Anon Key）；绝不能把 Service Role Key 写入 `cloud-config.js` 或网页发布目录。
生产环境必须先配置自有 SMTP，再执行 `npx supabase config push` 启用验证码模板。2026 年 6 月后创建的 Supabase 免费项目若继续使用默认邮件服务，将拒绝自定义认证邮件模板；此时不要发布要求用户输入验证码的前端版本。配置完成后应先用非管理员邮箱分别验证注册和找回密码，再部署网页。

仓库中的 `supabase/templates/confirmation.html` 与 `supabase/templates/recovery.html` 已使用 6 位一次性验证码；验证码有效期为 10 分钟。SMTP 密码只能填写在 Supabase 控制台或安全的部署密钥中，不能提交到 Git。

## 问题反馈与后台

- 登录用户可在“账户”中提交文字反馈，并上传最多 4 张、单张不超过 5 MB 的 JPG、PNG 或 WebP 图片。
- 背词页左下角的“反馈”会自动关联当前单词；义项问题绑定稳定的义项 ID，提交后直接返回当前词卡，后台反馈记录可打开对应的只读卡片。
- 反馈图片存放在私有 Storage bucket 中。服务端先创建归属当前账户的反馈记录，随后才允许向该记录的固定目录上传图片；普通用户只能访问和删除自己的图片。
- 反馈提交在数据库侧按账户串行计数，并限制为每小时 10 次、每天 30 次，避免并发绕过和存储滥用。
- 后台没有任何前台入口，发布后的地址为 `/admin.html`；页面同时设置为不参与搜索引擎索引。
- 知道后台地址不等于拥有权限。所有统计、用户和反馈 RPC 都会在数据库侧核验 `admin_users` 白名单。
- 后台概览包含注册用户、今日新增、DAU、WAU、MAU、D1/D7/D30 留存率和待处理反馈。
- DAU、WAU、MAU 分别按香港时区当天、最近 7 天、最近 30 天内有实际学习记录的账户去重统计。
- 留存率按注册日形成 cohort，并检查注册后第 1、7、30 个自然日是否有实际学习记录。
- 用户详情包含注册时间、最近学习日期、学习天数、连续学习天数、最近同步、计划和义项状态。
- 删除账户时，前端先通过 Storage API 删除私有反馈图片，再调用数据库 RPC 删除 Auth 账户及级联数据，避免产生孤立文件。

## 当前规则

- 当前提供《考研词汇》和《雅思词汇》两本词书。修改计划时可切换词书，并为每本词书分别设置每天新学单词数。
- 所有词书共用 `data/vocabulary-bundle.json` 中的单词与义项池；每本词书只保存其需要的 `wordId` 和 `senseId` 引用。
- 同一个义项可以被多本词书复用，但待新学、待强化、待复习、已掌握状态及学习历史按词书独立维护。
- 首页计划、完成日期、热力图、进度统计和单词列表始终使用当前词书口径。
- 修改计划时按剩余词数重新估算完成日期。
- 首页显示进度天数和实际天数，用来观察是否超前或落后。
- 每日任务完成后，首页“开始学习”会变为“增量学习”，可以提前学习后续内容。
- 初始只展示单词。
- 单词卡片右上角可以播放英文读音，优先使用在线发音音频，失败时回退到浏览器发音。
- 点击单词卡片后显示义项。
- 点击某个义项表示本轮已经熟悉，该义项变绿并平滑排到当前卡片末尾。
- 每个义项展示词性，如 `n.`、`v.`、`adj.`、`adv.`。
- 每个学习日依次执行到期复习、计划新学和当日强化；新学未确认的义项会在当日强化阶段再次出现。
- 强化阶段确认的义项转为 `待复习`，下一学习日复习确认后才进入 `已掌握`；强化阶段未确认则保持 `待强化`。
- 以 `待强化` 状态进入次日复习并确认的义项转为 `待复习`，当天强化阶段以绿色已处理状态展示且不会重复强化，下一学习日仍需确认。
- 以 `待复习` 状态进入次日复习并确认的义项直接进入 `已掌握`；若未确认，则回退为 `待强化` 并在当天强化阶段重新出现。
- 不再人工推进日期；日期始终取真实当天，没学习的日子会让预计完成日期顺延。
- “重置本次标记”会立即撤销当前单词在本轮的临时标记；“重学该单词”等破坏性操作保留二次确认。
- 义项顺序先按预设重要度排列，后续可扩展为语料频率、阅读常见度、考试常见度和基础义优先级的综合排序。

## 词库质量重建

正式词库不再按旧义项数组的位置拼接释义和例句。每个自动义项都必须由同一个 WordNet synset 提供单词、词性、英文定义和辨识性例句；中文义项由 Chinese Open Wordnet、同义项词典提示或人工校对表提供。

修改原始词表后，先从本地考研词典源提取英文定义参考：

```bash
py tools/extract-dictionary-fallbacks.py
```

然后运行全库语义重建：

```bash
py tools/rebuild-lexicon-semantic.py
```

语义重建后生成名词和动词词形数据：

```bash
py -m pip install -r requirements-morphology.txt
py tools/build-morphology.py
```

为全部例句生成离线中文翻译（结果写入每个义项的 `exampleZh` 字段）：

```powershell
py -m pip install -r requirements-translation.txt
py tools/build-example-translations.py
```

翻译缓存位于 `data/example-translation-cache.json`，全量报告位于
`data/example-translation-audit.json`。缓存完整后可使用
`py tools/build-example-translations.py --offline` 在不重新运行模型的情况下重建。

生成器会缓存 Wiktionary 名词词头信息，并结合 LemmInflect、WordNet 词族和本地校对表生成复数、第三人称单数、`-ing`、过去式与过去分词。无网络时可使用已有缓存：

```bash
py tools/build-morphology.py --offline
```

常规变化在界面中使用低对比度文字，不规则变化使用正文对比度；`lie`、`hang` 等按义项变化的动词使用红色分组。人工校对项位于 `data/morphology-overrides.json`，生成报告位于 `data/morphology-audit.json`。

最后必须运行独立审计：

```bash
py tools/audit-final-lexicon.py
```

两份报告中的阻断问题都必须为 `0`。审计覆盖空词/空义项、占位例句、同词重复例句、重复义项、词性与标准定义不一致、词义证据断裂、人名或传记义项、目标单词未出现在例句、乱码和异常重复文本。近义项会另列人工复核清单。

人工校对内容优先读取 `data/sense-overrides.json`；标准义项的中文校对读取 `data/synset-meaning-corrections.json`。

生成文件：

- `data/kaoyan-words.json`：《考研词汇》原始词库，构建雅思词书时不得改写
- `data/ielts-new-words.json`：仅收录《雅思词汇》相对考研词书新增的单词与义项
- `data/vocabulary-bundle.json`：应用实际加载的共用义项池与词书引用清单
- `data/lexicon-semantic-audit.json`：语义重建的全词全义项报告
- `data/lexicon-independent-audit.json`：独立审计报告
- `data/kaoyan-words.before-semantic-audit.json`：重建前的完整备份

## 雅思词书

IELTS 官方并不存在一份封闭的必背单词考纲。因此，《雅思词汇》的范围采用
ECDICT 中带 `ielts` 考试标签的词条，词义、音标、词性和词形再与现有义项池、
Wiktionary/Kaikki、Tatoeba、WordNet 及人工校对表对齐。

构建和审计顺序：

```powershell
py tools/extract-ielts-source.py
py tools/fill-ielts-empty-words.py
py tools/finalize-ielts-content.py
py tools/translate-ielts-content.py
py tools/fix-ielts-final-blockers.py
py tools/audit-ielts-final.py
py tools/build-vocabulary-bundle.py
```

`tools/audit-ielts-final.py` 的阻断问题必须为 `0`。构建词书包时还会校验
`data/kaoyan-words.json` 的 SHA-256，确保新增雅思数据不会改变《考研词汇》。

只预览指定词、不覆盖正式词库时，可以运行：

```bash
py tools/rebuild-lexicon-semantic.py --preview bank,book,character
```
