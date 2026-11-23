# 词汇宇宙维护

本说明仅针对 WordNet 自建候选；生成和验证不等于权利审批或部署。模型、向量与坐标是本地开发证据，不放入浏览器包；用户学习数据不参与地图生成。WordNet 原包及本地模型哈希见 `WORD_UNIVERSES_WORDNET_ONLY_CANDIDATE.md`。

当前基础模型及训练报告分别为 `.op-cache/source-investigation/wordnet-production-model-v3-20261123.npz` 和 `.op-cache/source-investigation/wordnet-production-training-v3-20261123.json`；基础坐标为 `.op-cache/source-investigation/wordnet-production-layout-v3-20261123.npz`。模型文件不能加载时必须停止，不能静默改用其他模型；替换模型、WordNet 版本或相关算法需要新一轮兼容性、数据权利和发布复核。模型对生成时的 scikit-learn 版本做精确检查。

本机验证使用 NumPy 2.5.3 和 scikit-learn 1.6.1。地图生成器复用了旧生成器的通用形近与文件工具，因此当前导入阶段还需要本机已有的 ONNX Runtime 1.27.0 和 tokenizers 0.22.2；自建路径不读取或加载 BGE 等预训练模型。上述 Python 运行库和冻结模型均不打入 Web 产物。

仅新增单词时，可用冻结模型计算候选向量，并使用先前坐标和形近图基底：

```powershell
$taskDir = '.op-cache/universe-refresh-YYYYMMDD-01' # 改为新的、不存在的目录
New-Item -ItemType Directory -Path $taskDir -ErrorAction Stop | Out-Null
$wordnetZip = '.op-cache/source-investigation/wordnet-3.0-nltk.zip'
$model = '.op-cache/source-investigation/wordnet-production-model-v3-20261123.npz'
$training = '.op-cache/source-investigation/wordnet-production-training-v3-20261123.json'
$previousCoordinates = '.op-cache/source-investigation/wordnet-production-layout-v3-20261123.npz'
$previousVersion = '0a07d3bce8f9b09a'
$previousReport = "data/universes/$previousVersion/report.json"
$previousIndex = "data/universes/$previousVersion/index.json"
$modelHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $model).Hash.ToLowerInvariant()
$trainingHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $training).Hash.ToLowerInvariant()
py -3 tools/encode_wordnet_frozen_model.py --wordnet-zip $wordnetZip --model $model --model-sha256 $modelHash --base-training-report $training --base-training-report-sha256 $trainingHash --vectors-out "$taskDir/vectors.npz" --report-out "$taskDir/encoding.json"
py -3 tools/build_wordnet_layout.py --wordnet-zip $wordnetZip --vectors "$taskDir/vectors.npz" --previous-coordinates $previousCoordinates --out "$taskDir/coordinates.npz" --report "$taskDir/layout.json"
py -3 tools/build_wordnet_universes.py --wordnet-zip $wordnetZip --model $model --vectors "$taskDir/vectors.npz" --training-report "$taskDir/encoding.json" --base-training-report $training --coordinates "$taskDir/coordinates.npz" --layout-report "$taskDir/layout.json" --previous-report $previousReport --previous-index $previousIndex --out "$taskDir/candidate"
py -3 tools/verify_wordnet_universes.py --root "$taskDir/candidate" --vector-file "$taskDir/vectors.npz" --coordinates-file "$taskDir/coordinates.npz" --wordnet-zip $wordnetZip --model-file $model --previous-report $previousReport --previous-index $previousIndex
```

把 `previousVersion` 和 `previousCoordinates` 一起更新为最近一次经审核候选的版本与坐标，不能只替换其中一个。生成脚本在旧词向量、来源模型、旧图内容或必要哈希不一致时停止；不会自动搬动旧点。新词位置明确为估算，不自动产生近义关系。确实需要更改既有词向量或重建布局时，应单独评估并获得必要审核，不能绕过失败保护。每个输出目录及半成品目标均要求不存在，避免覆盖已有证据。

使用的 WordNet 数据包须符合其许可，包含必要的版权、许可和免责声明；最终产物、所用依赖、逐字段权利链和适用渠道仍需实际核验。历史权利问题继续保留，不因普通维护或免费测试自动变为已清关。
