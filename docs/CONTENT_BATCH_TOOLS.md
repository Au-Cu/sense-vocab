# CD 批量内容工具

本页说明 R&D 已提供的本地候选生成工具。工具只写独立作业结果、缓存和审计报告，不修改正式词库；任何候选仍须按 D-017、D-019 进行字段级权利记录、目标义项与相邻义项人工复核，并由用户明确批准后才能应用。

## 环境

```powershell
py -m pip install -r requirements-content-batch.txt
```

英文到简体中文的严格批处理默认读取 `ARGOS_EN_ZH_MODEL_DIR`，未设置时使用 `D:\Files\argos-en-zh-audit`。模型缺失或语言方向不受支持时，作业明确失败；新入口不会静默调用历史非官方 Google 接口。

## 批量翻译

以 [`tools/fixtures/content-batch-translation-v1.json`](../tools/fixtures/content-batch-translation-v1.json) 为输入结构示例。每项必须提供唯一 `itemId`、稳定 `wordId`/`senseId`、目标字段和原文；词性、synset、源语言和目标语言随项记录。作业级 `rulesVersion` 是内容/Prompt 规则版本，规则变化时必须更新，以使旧缓存自动失效；工具自身还绑定内置 pipeline 版本，处理规则升级时同样失效。

```powershell
py tools/content_batch_job.py `
  --input path\to\cd-batch.json `
  --output path\to\cd-batch-result.json
```

默认缓存位于被 Git 忽略的 `data/.content-batch-cache/translations-v1.sqlite3`，使用 SQLite 完整同步事务，避免大批次 checkpoint 反复重写整份缓存。输出按原输入顺序保存，并逐项记录状态、缓存/续跑命中、模型资产哈希、参数哈希、输入输出哈希、token 桶、重试和耗时。每个推理批次后先提交缓存事务，再原子更新结果 checkpoint；安全中断后以完全相同命令重跑即可继续。若输出路径已有不同输入或不同运行参数的结果，命令会阻断，需改用新路径。

当前默认值来自 8 核 Snapdragon 8cx Gen 3 的固定基准：`batch-size=24`、`inter-threads=1`、`intra-threads=8`、`compute-type=float32`。换机器时可显式覆盖并重新跑基准：

```powershell
py tools/benchmark-content-batch.py `
  --batch-size 24 `
  --inter-threads 1 `
  --intra-threads 8 `
  --repeats 3 `
  --tuning-repeats 2
```

原始结果写入 `artifacts/benchmarks/content-batch-current.json`，包含机器、模型/fixture 哈希、逐轮吞吐、输出一致性、线程/批次组合和矩阵评分对照。

## 例句匹配

`tools/match-ielts-semantic-examples.py` 保留原有筛选阈值和候选选择逻辑，但 embedding 会按“文本哈希 + 模型资产/版本”保存到被 Git 忽略的 `data/.semantic-embedding-cache/`，只计算新增或失效文本；义项×候选与相邻义项排除评分改用矩阵计算。脚本只使用 `data/.fastembed-cache/` 中已批准的本地模型资产，缺失时明确阻断，不在作业中联网下载。

命令始终只生成候选审核报告，不回写输入词库；历史 `--dry-run` 参数仍可保留在旧调用中，但已不再改变行为：

```powershell
py tools/match-ielts-semantic-examples.py `
  --words-path path\to\candidate-words.json `
  --report-path path\to\semantic-review.json
```

报告逐项保留 `itemId`、`wordId`、`senseId`、词性、synset、目标字段、候选来源元数据、输入/候选哈希和 `pending` 审核状态。脚本仍只生成自动候选与审核信息；向量相似度、阈值和排序不能替代 CD 的 D-019 逐候选语义复核。

## 针对性验证

```powershell
py -m unittest discover -s tools -p "test_content_batch.py" -v
py -m py_compile tools/batch_content_utils.py tools/translation_provider.py tools/content_batch_job.py tools/semantic_example_matching.py tools/match-ielts-semantic-examples.py tools/benchmark-content-batch.py tools/test_content_batch.py
git diff --check
```
