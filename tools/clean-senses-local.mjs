import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const inputPath = path.join(rootDir, "data", "kaoyan-words.json");
const sourcePath = path.join(rootDir, "data", "kaoyan-source.json");
const backupPath = path.join(rootDir, "data", "kaoyan-words.before-local-clean.json");
const reportPath = path.join(rootDir, "data", "kaoyan-clean-report.json");

const DRY_RUN = process.argv.includes("--dry-run");
const NO_WRITE = process.argv.includes("--no-write");
const previewArg = process.argv.find((arg) => arg.startsWith("--preview="));

const POS_ORDER = [
  "n.",
  "v.",
  "adj.",
  "adv.",
  "prep.",
  "conj.",
  "pron.",
  "num.",
  "int.",
  "abbr.",
  "adj./adv.",
];

const NAME_MARKER_PATTERN = /\u4EBA\u540D|\u59D3\u6C0F/;
const NAME_TRANSLATION_PREFIX_PATTERN = /^(?:\u82F1|\u6CD5|\u5FB7|\u4FC4|\u7F57|\u5308|\u585E|\u6CE2|\u6377|\u745E\u5178|\u610F|\u897F|\u8461|\u8377|\u632A|\u4E39|\u82AC|\u5E0C|\u571F|\u6CF0|\u67EC|\u5370|\u65E5|\u97E9|\u7F8E|\u52A0|\u6FB3|\u65B0|\u5357\u975E|\u963F\u62C9\u4F2F|\u65AF\u6D1B\u4F10|\u82CF\u683C\u5170|\u7231\u5C14\u5170|\u5A01\u5C14\u58EB|\u9A6C\u91CC|\u5580|\u5188|\u51E0\u6BD4|\u585E\u5185|\u4E1C\u5357\u4E9A\u56FD\u5BB6\u534E\u8BED)(?:[\u3001\uFF0C,].*)?$/;

const CONCEPT_ALIASES = [
  ["行动", "行为", "举动", "动作", "活动", "品行"],
  ["作用", "功能", "功用", "效用"],
  ["启动", "激活", "开动", "发动", "使开始起作用"],
  ["驱动", "驱使", "促使"],
  ["活跃", "积极", "敏捷", "活跃的", "积极的", "敏捷的"],
  ["相互作用", "互相作用", "相互影响", "互相影响"],
  ["放射性", "放射性的", "有辐射的", "放射引起的"],
  ["反应", "作出反应", "回应"],
  ["反对", "反抗"],
  ["反作用", "起反作用"],
  ["等级", "级别"],
  ["分等", "分级", "分等级", "把分等级"],
  ["分数", "成绩"],
  ["毕业生", "获学位者"],
  ["毕业", "接受学位"],
  ["提升", "升级", "使升级"],
  ["祝贺", "恭喜", "致贺", "道贺"],
  ["祝贺词", "贺辞", "贺词", "致贺词"],
  ["认出", "识别"],
  ["承认", "公认"],
  ["赏识", "表扬"],
  ["考虑", "细想"],
  ["体谅", "顾及"],
  ["认为", "看作"],
  ["导致", "致使", "造成", "由而造成"],
  ["收费", "索费", "收取费用"],
  ["控告", "指责", "谴责"],
  ["发行", "发布", "发表", "颁布"],
  ["流出", "放出", "排出"],
  ["问题", "争论点", "争端"],
  ["证据", "证明"],
  ["校样", "样张"],
  ["试验", "实验", "验证", "考验"],
  ["测量", "勘测", "勘定"],
  ["调查", "审视", "全面审视"],
  ["俯瞰", "眺望", "环视"],
  ["引导", "带领"],
  ["处理", "实施", "管理"],
  ["品行", "行为", "举动"],
  ["过程", "进程", "进行", "推移"],
  ["工序", "制作法", "工艺"],
  ["加工", "处理"],
  ["阻拦", "拦住", "妨碍", "禁止"],
  ["条", "杆", "棒", "棍", "闩"],
  ["栅", "栏", "障碍"],
  ["闩上", "关上"],
  ["圆", "圆形物"],
  ["周围", "附近"],
  ["绕过", "绕行", "迂回"],
  ["弄圆", "使变圆"],
  ["轻抚", "抚摸"],
  ["敲击", "击打", "击", "敲"],
  ["一击", "一下", "一划", "一笔"],
  ["刻度", "标度"],
  ["天平", "磅秤"],
  ["鱼鳞", "鳞"],
  ["缩减", "缩小"],
  ["滑", "滑倒", "滑落", "滑动"],
  ["错误", "小错", "疏忽", "口误", "笔误"],
  ["纸片", "纸条"],
  ["脸红", "面红", "发红"],
  ["冲洗", "用水冲洗"],
  ["齐平", "同高"],
  ["滋味", "风味", "味道"],
  ["食欲", "胃口"],
  ["兴趣", "兴味", "爱好"],
  ["欣赏", "享受", "品味", "品尝", "喜爱"],
  ["平", "平的", "平坦", "平坦的", "扁平"],
  ["公寓", "套房"],
  ["电流", "水流", "气流", "流"],
  ["潮流", "趋势"],
  ["当前", "现在", "最近"],
  ["电流", "水流", "气流"],
  ["流通", "通用", "流行"],
  ["通用", "流行", "流通"],
  ["增加", "增长", "上升"],
  ["安装", "装配", "固定", "架置"],
  ["镶嵌", "嵌入"],
  ["支架", "底座", "底板"],
  ["内脏", "肠子", "肠"],
  ["胆量", "勇气"],
  ["本能", "直觉"],
  ["犯规", "违反规则"],
  ["弄脏", "弄污", "污秽"],
  ["难闻", "发臭"],
  ["令人厌恶", "糟透"],
  ["鞭打", "抽打"],
  ["抨击", "斥责", "责骂"],
  ["眼睫毛", "睫毛"],
  ["鞭子", "鞭梢"],
  ["柜台", "吧台"],
  ["相反", "反方向", "背道而驰"],
  ["反击", "还击"],
  ["反驳", "回答"],
  ["洞", "窟窿"],
  ["挖空", "凿空"],
  ["民意测验", "民调"],
  ["投票", "政治选举", "大选"],
  ["获得选票", "获得票"],
];

const EXAMPLE_RULES = [
  [/使困窘|局促不安|窘迫|为难/, (word) => `The sudden question embarrassed her in front of the class.`],
  [/阻碍|麻烦/, (word) => `A lack of money embarrassed the whole plan.`],
  [/启动|激活|开始起作用/, (word) => `Press the button to activate the alarm.`],
  [/驱动|驱使/, (word) => `Curiosity activated his desire to learn.`],
  [/刺激/, (word) => `Light can activate this chemical reaction.`],
  [/使活动|使活泼/, (word) => `Warm-up exercises activate the muscles before running.`],
  [/放射性/, (word) => `The process can activate the material in the reactor.`],
  [/上船|登船|上飞机|登机/, (word) => `The passengers embarked before sunrise.`],
  [/着手|从事|开始/, (word) => `She embarked on a new project after graduation.`],
  [/表演|演出/, (word) => `He acted well in the school play.`],
  [/举动|行为|动作/, (word) => `You should act with care in a difficult situation.`],
  [/起作用|生效|有效/, (word) => `The medicine began to act within minutes.`],
  [/法令|法律/, (word) => `The new act changed the rules for small businesses.`],
  [/一幕/, (word) => `The final act of the play was the most powerful.`],
  [/问题|争端|议题|争论点/, (word) => `The issue was discussed at the meeting.`],
  [/发行|发布|发表/, (word) => `The company issued a short statement yesterday.`],
  [/发给|颁发/, (word) => `The office issued each visitor a pass.`],
  [/流出|放出|排出/, (word) => `Smoke issued from the old chimney.`],
  [/费用|收费|索费/, (word) => `There is no charge for this service.`],
  [/电荷|充电/, (word) => `Please charge the phone before you leave.`],
  [/掌管|负责/, (word) => `She is in charge of the whole team.`],
  [/控告|指责/, (word) => `The police charged him with theft.`],
  [/命令/, (word) => `The officer gave the charge clearly.`],
  [/冲去|冲锋/, (word) => `The soldiers charged across the field.`],
  [/城市|市内|都市/, (word) => `Urban life can be busy and exciting.`],
  [/赤裸|裸|无遮蔽/, (word) => `He walked across the beach with bare feet.`],
  [/空的/, (word) => `The room looked bare after the furniture was moved out.`],
  [/稀少|仅有/, (word) => `They had only a bare supply of food left.`],
  [/露出|暴露/, (word) => `The report bared the truth about the accident.`],
  [/目录|名录|号码簿/, (word) => `I found her number in the directory.`],
  [/健全|清醒|理智|明智/, (word) => `A sane decision saved the team from trouble.`],
  [/钝|迟钝|愚笨/, (word) => `The dull knife could not cut the bread.`],
  [/无趣|单调|枯燥/, (word) => `The lecture was dull, but the topic was important.`],
  [/阴暗|呆滞/, (word) => `The sky looked dull before the rain.`],
  [/定义|下定义/, (word) => `The teacher asked us to define the term clearly.`],
  [/阐述|阐释|说明/, (word) => `She defined her position in a short speech.`],
  [/规定|限定/, (word) => `The contract defines each worker's duties.`],
  [/迎合|满足/, (word) => `The hotel caters to families with young children.`],
  [/饮食|餐饮/, (word) => `The restaurant catered the wedding dinner.`],
  [/争论|辩论/, (word) => `They argued about the best way to solve the problem.`],
  [/主张|坚持/, (word) => `He argued that the plan would save money.`],
  [/说服|劝说/, (word) => `She argued him into accepting the offer.`],
  [/带来/, (word) => `Please bring your notebook to class.`],
  [/促使|引起/, (word) => `The news brought a smile to her face.`],
  [/赚钱|赚得|挣得/, (word) => `He earns enough money to support his family.`],
  [/获得|博得/, (word) => `Her hard work earned everyone's respect.`],
  [/出生|出世/, (word) => `She was born in a small town.`],
  [/天生/, (word) => `He is a born leader.`],
  [/幸福|高兴|快乐/, (word) => `She looked happy when she heard the news.`],
  [/巧妙/, (word) => `That was a happy choice of words.`],
  [/博学|有学问/, (word) => `The learned professor answered every question.`],
  [/学术/, (word) => `The article was written in a learned style.`],
  [/坚强|强壮|牢固|强劲|猛烈/, (word) => `A strong wind blew through the valley.`],
  [/擅长/, (word) => `She is strong in mathematics.`],
  [/遭受|忍受|经历/, (word) => `Many families suffered during the storm.`],
  [/患病|痛苦/, (word) => `He suffered from a serious illness.`],
  [/坐/, (word) => `Please sit near the window.`],
  [/位于/, (word) => `The village sits on a hill above the river.`],
  [/结婚|嫁|娶/, (word) => `They married in a small church.`],
  [/合并|结合/, (word) => `The two companies merged last year.`],
  [/中间|之中|围绕/, (word) => `She stood amid a crowd of reporters.`],
  [/谦虚|谦逊/, (word) => `He remained modest after his success.`],
  [/适度|有节制/, (word) => `They made a modest profit this year.`],
  [/端庄/, (word) => `She wore a modest black dress.`],
  [/晕眩|头晕|眩晕/, (word) => `The climb made him feel dizzy.`],
  [/混乱|昏乱|茫然/, (word) => `The bright lights made her dizzy.`],
  [/成熟|熟的/, (word) => `The ripe apples fell from the tree.`],
  [/时机成熟/, (word) => `The time is ripe for change.`],
  [/海军|军舰/, (word) => `The naval officer inspected the ship.`],
  [/徘徊|逗留|闲荡/, (word) => `They lingered outside the theater after the show.`],
  [/拖延|磨蹭/, (word) => `Don't linger when the train is about to leave.`],
  [/腐烂|腐朽/, (word) => `The rotten fruit was thrown away.`],
  [/堕落|极坏|恶臭/, (word) => `The room had a rotten smell.`],
  [/高兴|乐意|令人高兴/, (word) => `I am glad to hear that you are safe.`],
  [/驯服|温顺|驯养/, (word) => `The horse became tame after months of training.`],
  [/乏味|沉闷|平淡/, (word) => `The ending felt tame after such an exciting story.`],
  [/高的|长的|高耸/, (word) => `The tall building can be seen from far away.`],
  [/夸大|过分/, (word) => `That sounds like a tall story.`],
  [/崇拜|敬慕|爱慕|喜爱/, (word) => `She adores her little brother.`],
  [/愉快|欢乐|宜人/, (word) => `We had a jolly evening with old friends.`],
  [/非常|很/, (word) => `That was jolly good news.`],
  [/月亮|月球|阴历/, (word) => `The lunar calendar is still used for many festivals.`],
  [/秃|光秃/, (word) => `The bald man smiled at the children.`],
  [/无装饰|单调/, (word) => `The wall looked bald without any pictures.`],
  [/高傲|崇高|高级|高耸/, (word) => `The lofty tower rose above the city.`],
  [/愉快|舒适|讨人喜欢|和蔼/, (word) => `It was a pleasant walk through the park.`],
  [/阴暗|成荫/, (word) => `We rested under a shady tree.`],
  [/名声不好/, (word) => `He was involved in a shady deal.`],
  [/苗条|修长/, (word) => `She wore a slim black coat.`],
  [/减轻体重|变苗条/, (word) => `He tried to slim down before the race.`],
  [/薄的|少的|微小/, (word) => `There is only a slim chance of success.`],
];

const WORD_EXAMPLE_RULES = {
  bank: [
    [/银行/, (word) => `${article(word)} ${word} is a place where people save money, open accounts, or borrow loans.`],
    [/岸|堤/, (word) => `A river ${word} is the land along the side of a river.`],
  ],
  basin: [
    [/脸盆/, (word) => `${article(word)} ${word} is a bowl used for washing hands or holding water.`],
    [/水池/, (word) => `Rainwater collected in the stone ${word}, like water in a shallow pool.`],
    [/盆$/, (word) => `He rinsed the apples in a small ${word} filled with water.`],
    [/内海/, () => "The sea basin is almost enclosed by land."],
    [/流域/, () => "Farmers in the basin depend on the river."],
    [/盆地|洼地|凹地/, () => "The town lies in a dry mountain basin."],
  ],
  basement: [
    [/建筑物的底部|底部/, () => "Engineers checked the basement of the old building."],
    [/地下室/, () => "They kept the bicycles in the basement."],
    [/地窖/, () => "The family stored potatoes in the cool basement."],
  ],
  basic: [
    [/基本的/, (word) => `A ${word} rule is one of the first and most necessary rules to learn.`],
    [/基础的/, (word) => `The book explains ${word} grammar before advanced grammar.`],
    [/基础/, () => "The basics are the first ideas you must know before learning more."],
    [/要素/, () => "The basics are the essential parts that everything else depends on."],
  ],
  react: [
    [/反应|回应/, (word) => `To ${word} is to respond to something that has just happened.`],
    [/反对|反抗/, (word) => `To ${word} against a rule is to oppose or resist it.`],
    [/起反作用/, (word) => `A policy can ${word} against its makers when it produces the opposite result.`],
    [/起作用|影响/, (word) => `Chemicals can ${word} on each other and produce a new substance.`],
  ],
  active: [
    [/主动语态/, () => "In the active voice, the subject performs the action."],
    [/积极分子/, () => "An activist works publicly for political or social change."],
    [/活跃|积极|敏捷/, (word) => `An ${word} person takes part in work, exercise, or discussion instead of sitting still.`],
    [/在活动中/, (word) => `An ${word} volcano is still able to erupt.`],
    [/主动/, (word) => `An ${word} learner asks questions instead of waiting passively.`],
    [/有效/, (word) => `The ${word} ingredient is the part of the medicine that actually works.`],
    [/现役/, (word) => `An ${word} soldier is still serving in the army.`],
  ],
  actual: [
    [/实际/, (word) => `The ${word} cost is the real cost, not the guessed cost.`],
    [/现实/, (word) => `The ${word} world is the real world, not an imagined one.`],
    [/真实/, (word) => `${capitalizeWord(word)} events really happened and were not invented.`],
    [/目前/, (word) => `The ${word} situation is what is happening now, not what was expected.`],
  ],
  capital: [
    [/首都/, (word) => `${article(word)} ${word} is the city where a country's government is based.`],
    [/大写字母/, (word) => `A ${word} letter is an uppercase letter, such as A instead of a.`],
    [/资本/, (word) => `${article(word)} ${word} is money used to start or grow a business.`],
    [/主要的/, (word) => `A ${word} reason is a very important reason.`],
  ],
  character: [
    [/性格|品质/, (word) => `${article(word)} ${word} is the set of qualities that make a person honest, brave, kind, or weak.`],
    [/特性|特征/, (word) => `${article(word)} ${word} is a feature that makes something different from others.`],
    [/人物|角色/, (word) => `${article(word)} ${word} in a story is one of the people in it.`],
    [/字符/, (word) => `${article(word)} ${word} is a letter, number, or symbol on a page or screen.`],
    [/印|刻/, (word) => `To ${word} a mark is to cut or print it onto a surface.`],
  ],
  current: [
    [/电流|水流|气流|涌流/, (word) => `${article(word)} ${word} is a steady flow, such as electricity in a wire or water in a river.`],
    [/趋势|潮流/, (word) => `${article(word)} ${word} is a general trend that many people or events follow.`],
    [/当前|现在|最近/, (word) => `The ${word} situation is the situation happening now.`],
    [/流通|通用|流行/, (word) => `${word[0].toUpperCase()}${word.slice(1)} money or language is widely used now.`],
  ],
  sound: [
    [/语音/, (word) => `${article(word)} ${word} can be a speech sound used in pronunciation.`],
    [/噪音|吵闹/, (word) => `${article(word)} ${word} can be a loud or unpleasant noise.`],
    [/声音/, (word) => `${article(word)} ${word} is something you can hear, such as a voice, bell, or noise.`],
    [/海峡/, (word) => `${article(word)} ${word} can be a narrow passage of sea between two pieces of land.`],
    [/听力范围/, (word) => `If something is within ${word}, it is close enough to be heard.`],
    [/探条/, (word) => `${article(word)} ${word} can be a medical instrument used for examining inside the body.`],
    [/测.*深/, (word) => `Sailors ${word} the water to measure its depth.`],
    [/听诊/, (word) => `A doctor may ${word} a patient's chest to listen to breathing or the heartbeat.`],
    [/测量/, (word) => `Sailors ${word} the water to measure how deep it is.`],
    [/使发声/, (word) => `The alarm will ${word} a warning when smoke is detected.`],
    [/试探/, (word) => `She tried to ${word} him out before asking the difficult question.`],
    [/宣告/, (word) => `The judge will ${word} the official decision in court.`],
    [/健全|健康/, (word) => `${article(word)} ${word} body or system is healthy and not damaged.`],
    [/合理|可靠/, (word) => `${article(word)} ${word} argument is sensible and can be trusted.`],
    [/有效彻底/, (word) => `${article(word)} ${word} solution is complete and effective.`],
    [/彻底|充分/, (word) => `After a long day, he was ${word} asleep until morning.`],
  ],
};

const HIGH_SIGNAL_EXAMPLE_RULES = [
  [/银行/, (word) => `${article(word)} ${word} is a place where people save money, open accounts, or borrow loans.`],
  [/河岸|岸|堤/, (word) => `People stood on the ${word.includes(" ") ? word : `river ${word}`} and watched the water flow.`],
  [/费用|收费|索费/, (word) => `A ${word} is the money you must pay for a service.`],
  [/电荷/, (word) => `A positive or negative ${word} can attract or repel another electrical particle.`],
  [/充电/, (word) => `To ${word} a phone is to put electricity back into its battery.`],
  [/掌管|负责/, (word) => `The person in ${word} is responsible for leading the work.`],
  [/控告|指责|谴责/, (word) => `Police may ${word} someone with theft when they accuse him of stealing.`],
  [/命令/, (word) => `A military ${word} is an order that soldiers must obey.`],
  [/负载|装载/, (word) => `A heavy ${word} is the weight carried by a truck, machine, or structure.`],
  [/首都/, (word) => `${article(word)} ${word} is the city where a country's government is based.`],
  [/资本/, (word) => `${article(word)} ${word} is money invested in a business.`],
  [/大写字母/, (word) => `A ${word} letter is an uppercase letter, such as B instead of b.`],
  [/性格|品质/, (word) => `${article(word)} ${word} is the set of personal qualities that make someone honest, brave, kind, or weak.`],
  [/特性|特征|特点/, (word) => `${article(word)} ${word} is a feature that helps identify or describe something.`],
  [/人物|角色/, (word) => `${article(word)} ${word} in a novel or film is one of the people in the story.`],
  [/字符/, (word) => `${article(word)} ${word} is a letter, number, or symbol on a page or screen.`],
  [/声音|语音|噪音|吵闹/, (word) => `${article(word)} ${word} is something you can hear, such as a voice, bell, or noise.`],
  [/海峡/, (word) => `${article(word)} ${word} can be a narrow sea passage between two pieces of land.`],
  [/电流|水流|气流|涌流/, (word) => `${article(word)} ${word} is a steady flow, such as electricity in a wire or water in a river.`],
  [/趋势|潮流/, (word) => `${article(word)} ${word} is a general direction in which ideas, events, or people are moving.`],
  [/当前|现在|最近|目前/, (word) => `The ${word} situation is the one happening now, not the one from the past.`],
  [/流通|通用|流行/, (word) => `${word[0].toUpperCase()}${word.slice(1)} words, money, or fashions are widely used now.`],

  [/一致/, (word) => `Two reports are ${word} when they give the same facts and do not disagree.`],
  [/极好的|优秀|卓越/, (word) => `${article(word)} ${word} result is much better than ordinary work.`],
  [/控制|支配|统治/, (word) => `To ${word} a machine, country, or situation is to make it follow your decisions.`],
  [/范围|限度|幅度/, (word) => `${article(word)} ${word} is the area, distance, or limits that something covers.`],
  [/结合|联合|合并/, (word) => `To ${word} two things is to put them together so they work as one.`],
  [/影响/, (word) => `A strong ${word} can change what people think, choose, or do.`],
  [/增加|增长|上升/, (word) => `To ${word} a number is to make it larger than before.`],
  [/减少|缩小|降低/, (word) => `To ${word} a number is to make it smaller than before.`],
  [/引起|导致|造成|致使/, (word) => `One event can ${word} another event by making it happen.`],
  [/妨碍|阻碍|阻止|抑制|禁止/, (word) => `A barrier can ${word} people from entering a place.`],
  [/说明|解释|阐明|阐释/, (word) => `To ${word} a rule is to make its meaning clear.`],
  [/设计/, (word) => `To ${word} a bridge is to plan its shape, structure, and purpose before it is built.`],
  [/忍受|容忍|承受/, (word) => `To ${word} pain or difficulty is to accept it without giving up.`],
  [/刺激|激励/, (word) => `Bright light can ${word} the eyes, and praise can ${word} a student to work harder.`],
  [/刺|戳|扎/, (word) => `To ${word} something is to push a sharp point into it.`],
  [/主要的|重要的/, (word) => `${article(word)} ${word} reason is one of the most important reasons.`],
  [/保证|担保/, (word) => `${article(word)} ${word} is a promise that something will happen or work.`],
  [/通知|告知/, (word) => `To ${word} someone is to give that person news or information.`],
  [/损害|破坏|毁坏/, (word) => `To ${word} a phone, road, or relationship is to harm or break it.`],
  [/处理|解决|应付/, (word) => `To ${word} a problem is to deal with it until it is under control.`],
  [/计划|方案/, (word) => `${article(word)} ${word} describes what someone intends to do next.`],
  [/促进|推动/, (word) => `Good schools can ${word} learning by making study easier and more effective.`],
  [/支持|赞成/, (word) => `To ${word} an idea is to help it or say that you agree with it.`],
  [/同意|认可|承认/, (word) => `To ${word} is to say that something is true, acceptable, or allowed.`],
  [/开始|着手/, (word) => `To ${word} a task is to start doing it.`],
  [/显示|展示|表明/, (word) => `A chart can ${word} changes in prices more clearly than words alone.`],
  [/获得|取得|得到/, (word) => `To ${word} a ticket, degree, or prize is to get it.`],
  [/部分|部件/, (word) => `${article(word)} ${word} is one piece of a larger whole.`],
  [/坚持|坚称|主张/, (word) => `To ${word} is to say something firmly and refuse to change your mind.`],
  [/要求|请求/, (word) => `To ${word} help is to ask for it clearly.`],
  [/大量|许多|巨大的/, (word) => `${article(word)} ${word} amount is a very large amount.`],
  [/倾斜|斜坡/, (word) => `A road that ${word}s rises or falls instead of staying flat.`],
  [/争论|辩论|争吵/, (word) => `To ${word} is to discuss a disagreement, often with strong reasons or emotions.`],
  [/理解|懂得/, (word) => `To ${word} an idea is to know what it means.`],
  [/符合|适合|满足/, (word) => `To ${word} a standard is to be good enough for that standard.`],
  [/旋转|转动/, (word) => `A wheel can ${word} around its center.`],
  [/提出|建议|提议/, (word) => `To ${word} a plan is to put it forward for others to consider.`],
  [/限制|限定/, (word) => `To ${word} something is to set a boundary on how much it can grow or happen.`],
  [/组织/, (word) => `To ${word} an event is to arrange its people, time, and details.`],
  [/混乱|紊乱/, (word) => `${article(word)} ${word} is a state where things are not in order and people are confused.`],
  [/鼓励/, (word) => `To ${word} someone is to give that person confidence to keep going.`],
  [/发射|射出/, (word) => `To ${word} a rocket is to send it into the air or space.`],
  [/认为|看作|视为/, (word) => `To ${word} something important is to think of it in that way.`],
  [/努力/, (word) => `${article(word)} ${word} is hard work used to achieve a goal.`],
  [/停止|终止/, (word) => `To ${word} is to no longer continue.`],
  [/转移|移动|迁移/, (word) => `To ${word} something is to move it from one place or person to another.`],
  [/折磨|痛苦/, (word) => `To ${word} someone is to cause severe pain or mental suffering.`],
  [/传播|扩散/, (word) => `News, fire, or disease can ${word} from one place to another.`],
  [/完成|结束/, (word) => `To ${word} a task is to finish it.`],
  [/想象|设想/, (word) => `To ${word} something is to form a picture or idea of it in your mind.`],
  [/方法|手段|方式/, (word) => `${article(word)} ${word} is a way of doing something.`],
  [/循环|周期/, (word) => `${article(word)} ${word} is a series of events that happens again and again.`],
  [/出现|显现/, (word) => `To ${word} is to become visible or start to exist in a place.`],
  [/保护|防护/, (word) => `To ${word} someone is to keep that person safe from harm.`],
  [/安排|布置/, (word) => `To ${word} a meeting is to decide its time, place, and details.`],
  [/强调|着重/, (word) => `To ${word} a point is to show that it is especially important.`],
  [/分配|分发/, (word) => `To ${word} work or money is to share it among people or places.`],
  [/称赞|表扬|赞美/, (word) => `To ${word} someone is to say that person did something well.`],
  [/装饰/, (word) => `To ${word} a room is to make it look more attractive.`],
  [/估价|评价|评估/, (word) => `To ${word} something is to judge its value, quality, or importance.`],
  [/看法|观点|意见/, (word) => `${article(word)} ${word} is what someone thinks about a subject.`],
  [/渴望|欲望/, (word) => `${article(word)} ${word} is a strong wish for something.`],
  [/冲突|矛盾/, (word) => `${article(word)} ${word} is a serious disagreement or fight.`],
  [/闪光|闪耀/, (word) => `A light can ${word} when it shines suddenly and brightly.`],
  [/战斗|斗争/, (word) => `${article(word)} ${word} is a fight between people, armies, or ideas.`],
  [/抓住|捕捉/, (word) => `To ${word} something is to take and hold it firmly.`],
  [/种类|类别|类型/, (word) => `${article(word)} ${word} is one group of things with the same features.`],
  [/欺骗|骗/, (word) => `To ${word} someone is to make that person believe something false.`],
  [/可靠|可信/, (word) => `${article(word)} ${word} source can be trusted to give true information.`],
  [/证明|证实|验证/, (word) => `To ${word} something is to show with facts that it is true.`],
  [/给予|提供/, (word) => `To ${word} help is to give help to someone who needs it.`],
  [/惯例|常规/, (word) => `${article(word)} ${word} is the usual way something is done.`],
  [/前进|进步/, (word) => `To ${word} is to move forward or make progress.`],
  [/叙述|描述/, (word) => `To ${word} an event is to tell what happened.`],
  [/发现/, (word) => `To ${word} something is to find it for the first time.`],
  [/恢复|复原/, (word) => `To ${word} is to return to a normal or healthy state.`],
  [/指示|指令/, (word) => `${article(word)} ${word} tells someone what to do next.`],
  [/显著|明显/, (word) => `${article(word)} ${word} change is easy to notice.`],
  [/困境|困难/, (word) => `${article(word)} ${word} is a difficult situation with no easy answer.`],
  [/恐吓|威胁/, (word) => `To ${word} someone is to frighten that person into doing something.`],
  [/交往|交流|联系/, (word) => `To ${word} with someone is to communicate or have a relationship with that person.`],
  [/帮助|协助/, (word) => `To ${word} someone is to make it easier for that person to do something.`],
  [/假装|装作/, (word) => `To ${word} is to act as if something false were true.`],
  [/倾向|趋向/, (word) => `To ${word} toward something is to be likely to choose or do it.`],
  [/尝试|试图/, (word) => `To ${word} is to try to do something.`],
  [/加强|增强/, (word) => `To ${word} something is to make it stronger.`],
  [/调查|研究/, (word) => `To ${word} a problem is to examine it carefully to learn the truth.`],
  [/尊敬|尊重/, (word) => `To ${word} someone is to treat that person as important and worthy.`],
  [/行为|行动|动作|举动/, (word) => `${article(word)} ${word} is something that a person does, not just something they think.`],
  [/作用|功能|功用|效用/, (word) => `${article(word)} ${word} is what something does or what it is used for.`],
  [/运转|运行/, (word) => `A machine is in ${word} when it is working and moving properly.`],
  [/情节/, (word) => `The ${word} of a story is the series of events that happen in it.`],
  [/主动语态/, () => "In the active voice, the subject performs the action."],
  [/积极分子/, () => "An activist works publicly for political or social change."],
  [/现实|真实|实际/, (word) => `${capitalizeWord(word)} facts are real facts, not guesses or imaginary ideas.`],
  [/交易/, (word) => `${article(word)} ${word} is a business deal in which money, goods, or services are exchanged.`],
  [/事务|事情/, (word) => `${article(word)} ${word} is a matter or piece of business that needs attention.`],
  [/学报|期刊/, (word) => `${article(word)} ${word} can be a publication that contains academic reports or articles.`],
  [/代理人|代理商|中介|经销商|经销处/, (word) => `${article(word)} ${word} represents another person or company in business.`],
  [/机关|机构|部门/, (word) => `${article(word)} ${word} is an organization that performs official or public work.`],
  [/议程|议事日程/, (word) => `${article(word)} ${word} is a list of things to discuss at a meeting.`],
  [/记事册/, (word) => `${article(word)} ${word} is a notebook or calendar for recording things to do.`],
  [/代表/, (word) => `${article(word)} ${word} speaks or acts for another person or group.`],
  [/创伤/, (word) => `${article(word)} ${word} is a serious wound or deep emotional injury.`],
  [/苦恼|焦虑不安|不安|困扰/, (word) => `${article(word)} ${word} is strong mental pain, worry, or trouble.`],
  [/摇动|搅动|搅拌/, (word) => `To ${word} a liquid is to move it around quickly so it does not stay still.`],
  [/鼓动|煽动/, (word) => `To ${word} people is to urge them to take action, often against someone or something.`],
  [/骚动/, (word) => `${article(word)} ${word} is noisy public excitement or unrest.`],
  [/艺术|美术/, (word) => `${article(word)} ${word} includes painting, music, literature, and other creative work.`],
  [/技术|技艺/, (word) => `${article(word)} ${word} is a learned skill used to do something well.`],
  [/文科/, (word) => `${article(word)} ${word} subject studies language, history, literature, or society rather than science.`],
  [/动脉/, (word) => `${article(word)} ${word} carries blood away from the heart.`],
  [/干线|干道|要道/, (word) => `${article(word)} ${word} is a main road, railway, or route that carries heavy traffic.`],
  [/主流/, (word) => `${article(word)} ${word} is the main direction or group that most people follow.`],
  [/文章/, (word) => `${article(word)} ${word} is a piece of writing in a newspaper, magazine, or website.`],
  [/论文/, (word) => `${article(word)} ${word} is a formal piece of academic writing.`],
  [/条款|条文/, (word) => `${article(word)} ${word} is a numbered part of a law, contract, or agreement.`],
  [/冠词/, (word) => `${article(word)} ${word} is a grammar word such as "a", "an", or "the".`],
  [/清楚地讲话|发音清晰|口才好|善于表达/, (word) => `${article(word)} ${word} speaker expresses ideas clearly and fluently.`],
  [/表达/, (word) => `To ${word} an idea is to say it clearly in words, signs, or actions.`],
  [/关节/, (word) => `${article(word)} ${word} is a place where bones connect and bend.`],
  [/连接|接合/, (word) => `To ${word} two parts is to fasten them together so they form one piece.`],
  [/人工|人造/, (word) => `${capitalizeWord(word)} things are made by people rather than by nature.`],
  [/人为/, (word) => `${capitalizeWord(word)} causes come from human action, not natural forces.`],
  [/虚伪|做作|矫揉造作/, (word) => `${capitalizeWord(word)} behavior looks false because it does not feel natural or sincere.`],
  [/仿造/, (word) => `${capitalizeWord(word)} objects are made to look like something real or natural.`],
  [/武断/, (word) => `${capitalizeWord(word)} decisions are made without enough reason or evidence.`],
  [/取缔|查禁|禁止/, (word) => `To ${word} something is to officially say that people must not do or use it.`],
  [/禁令|禁忌/, (word) => `${article(word)} ${word} is an official rule or social rule against doing something.`],
  [/离弃|丢弃|遗弃|抛弃|放弃/, (word) => `To ${word} something is to leave it behind or stop trying to keep it.`],
  [/放任|狂热/, (word) => `${article(word)} ${word} is a state of acting freely without control or restraint.`],
  [/条|带/, (word) => `${article(word)} ${word} can be a long narrow strip of material.`],
  [/乐队/, (word) => `${article(word)} ${word} is a group of musicians who play together.`],
  [/波段/, (word) => `${article(word)} ${word} is a range of radio waves or frequencies.`],
  [/一群|一伙/, (word) => `${article(word)} ${word} is a group of people or things together.`],
  [/环/, (word) => `${article(word)} ${word} can be a ring-shaped strip around something.`],
  [/缚|捆/, (word) => `To ${word} things is to tie them together with a strip or rope.`],
  [/绷带/, (word) => `${article(word)} ${word} is a strip of cloth used to cover or support an injured part of the body.`],
  [/旗/, (word) => `${article(word)} ${word} is a piece of cloth with a sign or color that represents a group or country.`],
  [/宴会/, (word) => `${article(word)} ${word} is a formal meal for many people, often for a celebration.`],
  [/款待/, (word) => `To ${word} guests is to give them food, drink, and friendly attention.`],
  [/契约|协议|合同/, (word) => `${article(word)} ${word} is a formal agreement between people or organizations.`],
  [/扩大|扩展/, (word) => `To ${word} something is to make it larger in size, range, or influence.`],
  [/职业/, (word) => `${article(word)} ${word} is the kind of work someone does for a living.`],
  [/决定|决心/, (word) => `${article(word)} ${word} is a firm choice or intention to do something.`],
  [/本质|精华/, (word) => `${article(word)} ${word} is the most important inner nature of something.`],
  [/居住/, (word) => `To ${word} in a place is to live there.`],
  [/接近|靠近/, (word) => `To ${word} something is to move nearer to it.`],
  [/通道|途径/, (word) => `${article(word)} ${word} is a way through a place or a way to achieve something.`],
  [/超过/, (word) => `To ${word} a limit is to go beyond it.`],
  [/成功/, (word) => `To ${word} is to achieve what you tried to do.`],
  [/进展|进程/, (word) => `${article(word)} ${word} is movement toward a goal over time.`],
  [/环境/, (word) => `${article(word)} ${word} is the conditions around a person, animal, or thing.`],
  [/包含|包括/, (word) => `To ${word} something is to have it as one part.`],
  [/覆盖/, (word) => `To ${word} something is to put or spread something over it.`],
  [/揭露|暴露/, (word) => `To ${word} a secret is to make it known.`],
  [/精确|准确/, (word) => `${capitalizeWord(word)} information is correct in every detail.`],
  [/象征/, (word) => `${article(word)} ${word} represents an idea, feeling, country, or group.`],
  [/培养|训练/, (word) => `To ${word} a skill is to develop it through practice.`],
  [/引诱|诱惑/, (word) => `To ${word} someone is to attract that person into doing something, often something wrong.`],
  [/适当|合适/, (word) => `${capitalizeWord(word)} behavior fits the situation and is not unsuitable.`],
  [/装备|设备|装置/, (word) => `${article(word)} ${word} is a tool, machine, or set of things used for a purpose.`],
  [/不足|缺乏|缺点|缺陷/, (word) => `${article(word)} ${word} is something missing, weak, or wrong.`],
  [/实现|完成/, (word) => `To ${word} a goal is to make it real or finish it successfully.`],
  [/产生|生成/, (word) => `To ${word} something is to make it come into existence.`],
  [/利用|使用/, (word) => `To ${word} something is to use it for a purpose.`],
  [/碎片|片断/, (word) => `${article(word)} ${word} is a small broken piece of something larger.`],
  [/形成|构成/, (word) => `To ${word} something is to make or become its shape, structure, or whole.`],
  [/遵守/, (word) => `To ${word} a rule is to follow it.`],
  [/可怕|严厉/, (word) => `${capitalizeWord(word)} words, weather, or punishment are very severe or frightening.`],
  [/报告/, (word) => `${article(word)} ${word} gives information about an event, study, or situation.`],
  [/玷污|弄脏/, (word) => `To ${word} something is to make it dirty or damage its good name.`],
  [/授予|颁发/, (word) => `To ${word} a prize or degree is to officially give it to someone.`],
  [/致敬|问候/, (word) => `${article(word)} ${word} is a respectful greeting or sign of honor.`],
  [/指导|引导/, (word) => `To ${word} someone is to show that person where to go or what to do.`],
  [/团体|群/, (word) => `${article(word)} ${word} is several people or things together.`],
  [/情绪/, (word) => `${article(word)} ${word} is a feeling such as anger, joy, fear, or sadness.`],
  [/宣布|公布/, (word) => `To ${word} something is to say it publicly or officially.`],
  [/重复/, (word) => `To ${word} something is to do or say it again.`],
  [/批准/, (word) => `To ${word} a plan is to officially accept it.`],
  [/厌恶|讨厌/, (word) => `To ${word} something is to dislike it very strongly.`],
  [/追求/, (word) => `To ${word} a goal is to try hard to get or achieve it.`],
  [/凝视/, (word) => `To ${word} is to look steadily for a long time.`],
  [/打扰|扰乱/, (word) => `To ${word} someone is to interrupt or make it hard for that person to continue.`],
  [/搜索|寻找/, (word) => `To ${word} is to look carefully for something.`],
  [/迅速/, (word) => `${capitalizeWord(word)} action happens quickly.`],
  [/紧握|抓紧/, (word) => `To ${word} something is to hold it tightly.`],
  [/补充/, (word) => `To ${word} something is to add what is missing.`],
  [/包围/, (word) => `To ${word} a place is to be all around it.`],
  [/束缚|约束/, (word) => `To ${word} someone is to limit that person's freedom.`],
  [/爆发/, (word) => `To ${word} is to start suddenly and violently.`],
  [/擦伤/, (word) => `${article(word)} ${word} is a small injury made by rubbing or scraping the skin.`],
  [/戏弄|取笑/, (word) => `To ${word} someone is to make fun of that person.`],
  [/萌芽|芽/, (word) => `${article(word)} ${word} is a small new growth from a plant.`],
];

const NOUN_FALLBACK_TEMPLATES = {
  person: [
    (word) => `The ${word} answered the question calmly.`,
    (word) => `A good ${word} can guide the whole team.`,
    (word) => `The young ${word} learned from every mistake.`,
    (word) => `The ${word} arrived early for the interview.`,
    (word) => `People trusted the ${word} during the crisis.`,
    (word) => `The ${word} explained the decision clearly.`,
  ],
  place: [
    (word) => `They walked through the ${word} after lunch.`,
    (word) => `The old ${word} was quiet in the morning.`,
    (word) => `Many people gathered near the ${word}.`,
    (word) => `The road led to a small ${word}.`,
    (word) => `They returned to the ${word} before dark.`,
    (word) => `A map showed the ${word} in great detail.`,
  ],
  object: [
    (word) => `She put the ${word} on the table.`,
    (word) => `The old ${word} was repaired yesterday.`,
    (word) => `He carried the ${word} carefully across the room.`,
    (word) => `The ${word} lay beside the open window.`,
    (word) => `They packed the ${word} before leaving.`,
    (word) => `A label was attached to the ${word}.`,
  ],
  event: [
    (word) => `The ${word} lasted for several hours.`,
    (word) => `Everyone remembered the ${word} clearly.`,
    (word) => `The sudden ${word} changed their plans.`,
    (word) => `The ${word} began without warning.`,
    (word) => `News of the ${word} spread quickly.`,
    (word) => `They prepared carefully for the ${word}.`,
  ],
  abstract: [
    (word) => `The ${word} shaped the final decision.`,
    (word) => `A clear ${word} helped them understand the problem.`,
    (word) => `The report explained the ${word} in detail.`,
    (word) => `The ${word} became clear after a long discussion.`,
    (word) => `Their argument depended on this ${word}.`,
    (word) => `The teacher gave a simple example of the ${word}.`,
  ],
  default: [
    (word) => `The ${word} appeared in the story.`,
    (word) => `They discussed the ${word} after class.`,
    (word) => `The example shows how the ${word} is used.`,
    (word) => `The ${word} was mentioned in the article.`,
    (word) => `They found the ${word} in an old book.`,
    (word) => `This sentence gives the ${word} a clear context.`,
  ],
};

const CONTEXTUAL_NOUN_FALLBACKS = {
  person: [
    (word) => `${article(word)} ${word} is a person connected with this role, job, or identity.`,
    (word) => `${article(word)} ${word} usually refers to someone who does this kind of work or takes this role.`,
    (word) => `In this sense, ${article(word).toLowerCase()} ${word} is not an object but a person.`,
  ],
  place: [
    (word) => `${article(word)} ${word} is a place or area where this kind of activity or feature can be found.`,
    (word) => `People can go to, pass through, or point to ${article(word).toLowerCase()} ${word} as a location.`,
    (word) => `In this sense, ${article(word).toLowerCase()} ${word} names a physical place rather than an action.`,
  ],
  object: [
    (word) => `${article(word)} ${word} is a physical thing used, carried, seen, or touched in this context.`,
    (word) => `In this sense, ${article(word).toLowerCase()} ${word} is an object rather than an idea or action.`,
    (word) => `People can hold, use, move, or point to ${article(word).toLowerCase()} ${word}.`,
  ],
  event: [
    (word) => `${article(word)} ${word} is an event, action, or process that happens in time.`,
    (word) => `In this sense, ${article(word).toLowerCase()} ${word} is something that takes place, begins, or ends.`,
    (word) => `People can prepare for, watch, or remember ${article(word).toLowerCase()} ${word}.`,
  ],
  abstract: [
    (word) => `${article(word)} ${word} is an idea, quality, condition, or result rather than a physical thing.`,
    (word) => `In this sense, ${article(word).toLowerCase()} ${word} affects what people think, decide, or do.`,
    (word) => `People discuss ${article(word).toLowerCase()} ${word} when they are talking about this idea or condition.`,
  ],
  default: [
    (word) => `${capitalizeWord(word)} in this sense needs clue words around it because it is not a concrete object.`,
    (word) => `This use of ${word} points to a specific meaning rather than a generic sentence.`,
    (word) => `A helpful sentence for ${word} should make this sense clear from context.`,
  ],
};

const aliasByCanonical = new Map();
for (const group of CONCEPT_ALIASES) {
  const canonical = normalizeForCompare(group[0]);
  for (const item of group) {
    const normalized = normalizeForCompare(item);
    if (!aliasByCanonical.has(normalized)) {
      aliasByCanonical.set(normalized, canonical);
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildSourceByWord() {
  if (!fs.existsSync(sourcePath)) return new Map();
  return new Map(readJson(sourcePath).map((entry) => [entry.word, entry]));
}

const sourceByWord = buildSourceByWord();

function article(word) {
  return /^[aeiou]/i.test(String(word || "")) ? "An" : "A";
}

function capitalizeWord(word) {
  const text = String(word || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function normalizePos(pos = "") {
  const raw = String(pos).toLowerCase().replace(/\s/g, "");
  if (/^(v|vt|vi)\.?$/.test(raw)) return "v.";
  if (/^n\.?$/.test(raw)) return "n.";
  if (/^(a|adj)\.?$/.test(raw)) return "adj.";
  if (/^(ad|adv)\.?$/.test(raw)) return "adv.";
  if (/^prep\.?$/.test(raw)) return "prep.";
  if (/^conj\.?$/.test(raw)) return "conj.";
  if (/^pron\.?$/.test(raw)) return "pron.";
  if (/^num\.?$/.test(raw)) return "num.";
  if (/^int\.?$/.test(raw)) return "int.";
  if (/^abbr\.?$/.test(raw)) return "abbr.";
  if (raw === "a&ad." || raw === "adj&adv." || raw === "adj./adv.") {
    return "adj./adv.";
  }
  return pos || "";
}

function isPersonNameMarker(sense) {
  const meaning = normalizePunctuation(sense?.meaning);
  return NAME_MARKER_PATTERN.test(meaning);
}

function startsPersonNameBlock(sense) {
  const meaning = normalizePunctuation(sense?.meaning);
  return normalizePos(sense?.pos) === "n." && /^\([^)]+\)/.test(meaning) && isPersonNameMarker(sense);
}

function isPersonNameTranslation(sense) {
  if (normalizePos(sense?.pos) !== "n.") return false;

  const meaning = normalizePunctuation(sense?.meaning);
  const match = meaning.match(/^\(([^)]{1,32})\).+/);
  if (!match) return false;

  return NAME_TRANSLATION_PREFIX_PATTERN.test(match[1]);
}

function filterPersonNameSenses(senses = []) {
  const filtered = [];
  let inPersonNameBlock = false;

  for (const sense of senses) {
    if (isPersonNameMarker(sense)) {
      inPersonNameBlock = startsPersonNameBlock(sense);
      continue;
    }

    if (inPersonNameBlock && isPersonNameTranslation(sense)) {
      continue;
    }

    inPersonNameBlock = false;
    filtered.push(sense);
  }

  return filtered;
}

function normalizePunctuation(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\uFF0C\s+/g, "\uFF0C")
    .replace(/\s+\uFF0C/g, "\uFF0C")
    .replace(/[,\u3001;\uFF1B/]+/g, "\uFF0C")
    .replace(/\uFF08/g, "(")
    .replace(/\uFF09/g, ")")
    .replace(/\s+/g, "")
    .replace(/\uFF0C+/g, "\uFF0C")
    .replace(/^\uFF0C|\uFF0C$/g, "");
}

function cleanDisplayText(text) {
  return normalizePunctuation(text)
    .replace(/[\u3010\uFF3B\[][\s\S]{1,12}[\u3011\uFF3D\]]/g, "")
    .replace(/[\u3008\u300A][^\u3009\u300B]{1,8}[\u3009\u300B]/g, "")
    .replace(/[<>]+/g, "")
    .replace(/\((?:pl\.|sing\.|on|against|recognise|\u7F8E|\u82F1|\u5E38|\u901A\u5E38|\u5C24\u6307|the|a|an|to|of|in|with|for|from|by|about|into|up|out|off|over|under|as|at|adj|adv|v|n|vi|vt)[^)]{0,20}\)/gi, "")
    .replace(/\([^)]{1,16}\)/g, "")
    .replace(/\([^)]*$/g, "")
    .replace(/\(\u7684\)/g, "\u7684")
    .replace(/[A-Z]\s*$/g, "")
    .replace(/\uFF0C+/g, "\uFF0C")
    .replace(/^\uFF0C|\uFF0C$/g, "");
}

function splitMeaning(meaning) {
  const cleaned = cleanDisplayText(meaning);
  if (!cleaned) return [];

  const tokens = cleaned
    .split("\uFF0C")
    .map((token) =>
      token
        .replace(/^[.:\u3002\uFF1A]+|[.:\u3002\uFF1A]+$/g, "")
        .replace(/^\([^)]*\)/g, "")
        .replace(/[<>A]+$/g, "")
        .trim(),
    )
    .filter(Boolean);

  return tokens.filter((token) => {
    const normalized = normalizeForCompare(token);
    if (!normalized) return false;
    if (normalized.length !== 1) return true;
    return !tokens.some((other) => {
      if (other === token) return false;
      const otherNormalized = normalizeForCompare(other);
      return otherNormalized.length > 1 && otherNormalized.includes(normalized);
    });
  });
}

function normalizeForCompare(text) {
  return cleanDisplayText(text)
    .replace(/[()]/g, "")
    .replace(/[.\u3002:\uFF1A]/g, "")
    .replace(/\u2026/g, "")
    .replace(/^(\u4F7F\u5F97?)/, "\u4F7F")
    .replace(/^\u628A/, "")
    .replace(/^(\u4E00\u79CD|\u4E00\u4E2A|\u4E00\u9879|\u4E00\u4EF6|\u67D0\u79CD)(?=.)/, "")
    .replace(/[\u7684\u5730]$/g, "")
    .replace(/\u4E92\u76F8/g, "\u76F8\u4E92")
    .replace(/\u7531\u2026\u800C/g, "\u7531\u800C")
    .replace(/\u2026/g, "")
    .replace(/[^\p{Letter}\p{Number}\u4E00-\u9FFF]/gu, "");
}

function canonicalToken(token) {
  const normalized = normalizeForCompare(token);
  return aliasByCanonical.get(normalized) || normalized;
}

function meaningChars(token) {
  const stopChars = new Set(
    Array.from("\u7684\u5730\u5F97\u4E00\u662F\u5728\u548C\u6216\u4E0E\u53CA\u7B49\u67D0\u5404\u628A\u4F7F\u4E3A"),
  );
  return Array.from(new Set(canonicalToken(token).replace(/[a-zA-Z0-9]/g, "")))
    .filter((char) => char && !stopChars.has(char));
}

function overlapRatio(a, b) {
  const aChars = meaningChars(a);
  const bChars = meaningChars(b);
  if (!aChars.length || !bChars.length) return 0;
  const bSet = new Set(bChars);
  const shared = aChars.filter((char) => bSet.has(char)).length;
  return shared / Math.min(aChars.length, bChars.length);
}

function sharedCharCount(a, b) {
  const aChars = meaningChars(a);
  const bSet = new Set(meaningChars(b));
  return aChars.filter((char) => bSet.has(char)).length;
}

function tokenLooksRelated(a, b) {
  const left = canonicalToken(a);
  const right = canonicalToken(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 2 && right.length >= 2 && (left.includes(right) || right.includes(left))) {
    return true;
  }
  if (Math.min(left.length, right.length) >= 2 && sharedCharCount(a, b) >= 2 && overlapRatio(a, b) >= 0.75) {
    return true;
  }
  return false;
}

function shouldConnectSiblingTokens(a, b, tokenCount) {
  if (tokenCount > 3) return false;
  if (tokenLooksRelated(a, b)) return true;
  return sharedCharCount(a, b) >= 2 && overlapRatio(a, b) >= 0.67;
}

function pickBestTokens(group) {
  const byToken = new Map();
  for (const node of group) {
    const normalized = normalizeForCompare(node.token);
    if (!normalized) continue;

    if (!byToken.has(normalized)) {
      byToken.set(normalized, {
        token: node.token,
        normalized,
        canonical: canonicalToken(node.token),
        count: 0,
        bestImportance: 0,
      });
    }

    const entry = byToken.get(normalized);
    entry.count += 1;
    entry.bestImportance = Math.max(entry.bestImportance, node.source.importance || 0);
    if (node.token.length < entry.token.length) entry.token = node.token;
  }

  const candidates = Array.from(byToken.values()).sort((a, b) =>
    b.count - a.count ||
    b.bestImportance - a.bestImportance ||
    a.token.length - b.token.length,
  );

  const genericShortTokens = new Set(["流", "性", "级", "分", "权"]);
  const tokens = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = candidate.normalized;
    if (!normalized || seen.has(normalized)) continue;
    if (
      normalized.length <= 1 &&
      genericShortTokens.has(normalized) &&
      candidates.some((other) =>
        other !== candidate &&
        other.canonical === candidate.canonical &&
        other.normalized.length > 1
      )
    ) {
      continue;
    }

    const existingIndex = tokens.findIndex((token) => {
      const existing = normalizeForCompare(token);
      return (
        existing === normalized ||
        (existing.length >= 2 && normalized.includes(existing)) ||
        (normalized.length >= 2 && existing.includes(normalized))
      );
    });

    if (existingIndex >= 0) {
      const existing = tokens[existingIndex];
      if (candidate.token.length < existing.length) {
        tokens[existingIndex] = candidate.token;
      }
    } else {
      tokens.push(candidate.token);
    }

    seen.add(normalized);
  }

  return tokens.slice(0, 3);
}

function posRank(pos) {
  const index = POS_ORDER.indexOf(pos);
  return index === -1 ? POS_ORDER.length : index;
}

function hashText(text) {
  let hash = 0;
  for (const char of String(text || "")) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

function nounExampleType(meaning) {
  const text = String(meaning || "");
  if (/人|者|员|家|师|官|商|手|工|兵|客|儿童|学生|经理|专家|代表|成员|读者|作者|顾客|主人/.test(text)) {
    return "person";
  }
  if (/室|房|场|地|区|洲|国|城|镇|村|路|街|河|湖|海|山|岸|港|站|园|院|店|地下室|地窖|流域|盆地|内海|水池/.test(text)) {
    return "place";
  }
  if (/会|战|赛|仪式|会议|运动|活动|过程|行动|行为|谈话|讨论|旅行|游行|争论|攻击|变化|事故|事件|任务/.test(text)) {
    return "event";
  }
  if (/性|度|力|感|权|义|法|思想|观点|原则|原因|关系|能力|可能性|趋势|影响|结果|责任|机会|基础|要素|问题|费用|电荷|命令|控告|负载|资本|标准|优势|劣势/.test(text)) {
    return "abstract";
  }
  if (/物|器|机|具|品|件|车|船|纸|书|表|箱|包|门|窗|盆|瓶|杯|盘|球|刀|钟|衣|帽|鞋|钱|票|卡|图|照片|文件|材料|工具|设备|商品/.test(text)) {
    return "object";
  }
  return "default";
}

function pickUniqueExample(templates, word, sense, index, usedExamples) {
  const offset = (hashText(`${word}:${sense.meaning}`) + index) % templates.length;
  for (let step = 0; step < templates.length; step += 1) {
    const example = templates[(offset + step) % templates.length](word);
    if (!usedExamples.has(example)) return example;
  }
  return templates[offset](word);
}

function supplementalNounExample(word, sense, index, usedExamples) {
  const type = nounExampleType(sense.meaning);
  const settingsByType = {
    person: ["classroom", "office", "meeting", "interview", "team", "workshop", "station", "court"],
    place: ["morning", "map", "journey", "coast", "city", "valley", "route", "guidebook"],
    object: ["shelf", "desk", "box", "bag", "counter", "drawer", "case", "workbench"],
    event: ["morning", "evening", "meeting", "weekend", "season", "campaign", "festival", "schedule"],
    abstract: ["report", "plan", "debate", "lesson", "case", "argument", "policy", "project"],
    default: ["lesson", "article", "story", "report", "conversation", "example", "note", "chapter"],
  };
  const templatesByType = {
    person: (setting) => `${article(word)} ${word} is a person whose role becomes clear in a ${setting}.`,
    place: (setting) => `${article(word)} ${word} is a place that can be shown on a ${setting}.`,
    object: (setting) => `${article(word)} ${word} is a thing someone can use, carry, or store on a ${setting}.`,
    event: (setting) => `${article(word)} ${word} is something that can happen during a ${setting}.`,
    abstract: (setting) => `${article(word)} ${word} is an idea or condition that can shape a ${setting}.`,
    default: (setting) => `${capitalizeWord(word)} has a specific sense in this ${setting}.`,
  };
  const settings = settingsByType[type] || settingsByType.default;
  const template = templatesByType[type] || templatesByType.default;
  const offset = (hashText(`${word}:${sense.meaning}:extra`) + index) % settings.length;
  for (let step = 0; step < settings.length; step += 1) {
    const example = template(settings[(offset + step) % settings.length]);
    if (!usedExamples.has(example)) return example;
  }
  return `The ${word} appeared in example ${index + 1}.`;
}

function fallbackNounExample(word, sense, index, usedExamples) {
  const type = nounExampleType(sense.meaning);
  const templates = CONTEXTUAL_NOUN_FALLBACKS[type] || CONTEXTUAL_NOUN_FALLBACKS.default;
  const example = pickUniqueExample(templates, word, sense, index, usedExamples);
  if (!usedExamples.has(example)) return example;
  return supplementalNounExample(word, sense, index, usedExamples);
}

function avoidDuplicateExample(example, word, sense, index, usedExamples) {
  return example;
}

function meaningPieces(meaning) {
  return normalizePunctuation(meaning)
    .split(/[,\uFF0C;\uFF1B\u3001/()\[\]\s]+/)
    .map((token) => token.replace(/^的|的$/g, "").trim())
    .filter((token) => token.length >= 1);
}

function phraseMatchesSense(phrase, sense) {
  const translation = normalizePunctuation(phrase.translation);
  if (!translation) return false;
  return meaningPieces(sense.meaning).some((token) => token.length >= 1 && translation.includes(token));
}

function phraseContextExample(word, sense, index, usedExamples) {
  const source = sourceByWord.get(word);
  if (!source?.phrases?.length) return null;

  const candidates = source.phrases.filter((phrase) => phraseMatchesSense(phrase, sense));
  if (!candidates.length) return null;

  const offset = (hashText(`${word}:${sense.meaning}:phrase`) + index) % candidates.length;
  for (let step = 0; step < candidates.length; step += 1) {
    const candidate = candidates[(offset + step) % candidates.length];
    const example = phraseSentence(candidate.phrase, candidate.translation, word, sense);
    if (!usedExamples.has(example)) return example;
  }

  return null;
}

function phraseSentence(phrase, translation, word, sense) {
  const lower = phrase.toLowerCase();
  const phraseSense = { ...sense, meaning: translation || sense.meaning };
  for (const [pattern, factory] of HIGH_SIGNAL_EXAMPLE_RULES) {
    if (pattern.test(phraseSense.meaning)) {
      return factory(phrase);
    }
  }

  if (/account/.test(lower)) return `She checked her ${phrase} before paying the bill.`;
  if (/loan|credit|finance/.test(lower)) return `The company used ${article(phrase).toLowerCase()} ${phrase} to borrow money.`;
  if (/river|water|sea|lake|shore|coast/.test(lower)) return `They stood near the ${phrase} and watched the water move.`;
  if (/government|agency|department|office/.test(lower)) return `The ${phrase} handled official public work.`;
  if (/article|journal|paper|thesis/.test(lower)) return `The ${phrase} presented evidence and conclusions in writing.`;
  if (/band/.test(lower) && /jazz|music|rock/.test(lower)) return `The ${phrase} played music on the stage.`;
  if (/agreement|contract/.test(lower)) return `The ${phrase} set out what each side had promised to do.`;
  if (/system|device|equipment|machine/.test(lower)) return `The ${phrase} was built to perform a specific technical job.`;
  if (/role|member|manager|agent|artist|teacher|worker/.test(lower)) return `The ${phrase} describes a person with a specific job or role.`;
  if (/room|hall|house|building|city|road|area|field|center|centre/.test(lower)) return `The ${phrase} names a place where people can go or work.`;

  return `${capitalizeWord(phrase)} is a collocation that points to this meaning of ${word}.`;
}

function supplementalGeneralExample(word, sense, index, usedExamples) {
  const templates = {
    "v.": [
      (w) => `To ${w} is to do this action in a specific situation, not just to be present.`,
      (w) => `People use ${w} when the action itself is the key idea in the sentence.`,
      (w) => `This sense of ${w} points to an action rather than a thing or quality.`,
    ],
    "adj.": [
      (w) => `${capitalizeWord(w)} describes a quality that separates one thing from another.`,
      (w) => `Something ${w} has this quality in a noticeable way.`,
      (w) => `This sense of ${w} describes what a person, thing, or situation is like.`,
    ],
    "adv.": [
      (w) => `${capitalizeWord(w)} describes how an action is done.`,
      (w) => `This sense of ${w} changes the manner, degree, or time of an action.`,
      (w) => `People use ${w} to add detail to a verb or whole sentence.`,
    ],
    default: [
      (w) => `This sense of ${w} is tied to a specific context, not just a vague example.`,
      (w) => `${capitalizeWord(w)} needs surrounding clue words to make this meaning clear.`,
      (w) => `A stronger sentence for ${w} should point directly to this meaning.`,
    ],
  };
  const list = templates[sense.pos] || templates.default;
  return pickUniqueExample(list, word, sense, index, usedExamples);
}

function buildExample(word, sense, index = 0, usedExamples = new Set()) {
  const cleanWord = String(word || "").trim();
  const wordRules = WORD_EXAMPLE_RULES[cleanWord.toLowerCase()];
  if (wordRules) {
    for (const [pattern, factory] of wordRules) {
      if (pattern.test(sense.meaning)) {
        return avoidDuplicateExample(factory(cleanWord), cleanWord, sense, index, usedExamples);
      }
    }
  }

  for (const [pattern, factory] of HIGH_SIGNAL_EXAMPLE_RULES) {
    if (pattern.test(sense.meaning)) {
      return avoidDuplicateExample(factory(cleanWord), cleanWord, sense, index, usedExamples);
    }
  }

  for (const [pattern, factory] of EXAMPLE_RULES) {
    if (pattern.test(sense.meaning)) {
      return avoidDuplicateExample(factory(cleanWord), cleanWord, sense, index, usedExamples);
    }
  }

  const phraseExample = phraseContextExample(cleanWord, sense, index, usedExamples);
  if (phraseExample) return phraseExample;

  if (sense.pos === "v.") {
    return supplementalGeneralExample(cleanWord, sense, index, usedExamples);
  }
  if (sense.pos === "n.") {
    return fallbackNounExample(cleanWord, sense, index, usedExamples);
  }
  if (sense.pos === "adj.") {
    return supplementalGeneralExample(cleanWord, sense, index, usedExamples);
  }
  if (sense.pos === "adv.") {
    return supplementalGeneralExample(cleanWord, sense, index, usedExamples);
  }
  if (sense.pos === "prep.") {
    return `The child stood ${cleanWord} the door.`;
  }
  return supplementalGeneralExample(cleanWord, sense, index, usedExamples);
}

function cleanWord(wordEntry) {
  const nodes = [];
  const sourceSenses = filterPersonNameSenses(wordEntry.senses || []);

  for (const sense of sourceSenses) {
    const pos = normalizePos(sense.pos);
    const tokens = splitMeaning(sense.meaning);
    if (!tokens.length) continue;

    tokens.forEach((token, index) => {
      nodes.push({
        source: sense,
        pos,
        token,
        index,
        sourceTokenCount: tokens.length,
      });
    });
  }

  if (!nodes.length) {
    return {
      ...wordEntry,
      senses: [],
    };
  }

  const parent = nodes.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      if (a.pos !== b.pos) continue;

      if (tokenLooksRelated(a.token, b.token)) {
        union(left, right);
      } else if (
        a.source.id === b.source.id &&
        shouldConnectSiblingTokens(a.token, b.token, a.sourceTokenCount)
      ) {
        union(left, right);
      }
    }
  }

  const clusters = new Map();
  nodes.forEach((node, index) => {
    const root = find(index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(node);
  });

  const senses = Array.from(clusters.values()).map((group) => {
    group.sort((a, b) =>
      (b.source.importance || 0) - (a.source.importance || 0) ||
      a.source.id.localeCompare(b.source.id, undefined, { numeric: true }) ||
      a.index - b.index,
    );

    const best = group[0];
    const displayTokens = pickBestTokens(group);
    const sourceIds = Array.from(new Set(group.map((node) => node.source.id)));

    return {
      id: best.source.id,
      pos: best.pos,
      meaning: displayTokens.join("\uFF0C"),
      importance: Math.max(...group.map((node) => node.source.importance || 0)),
      sourceIds,
    };
  });

  senses.sort((a, b) =>
    b.importance - a.importance ||
    posRank(a.pos) - posRank(b.pos) ||
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );

  const normalizedIds = new Set();
  const usedExamples = new Set();
  const finalSenses = senses.map((sense, index) => {
    let id = sense.id || `${sense.pos.replace(/\W/g, "") || "sense"}-${index + 1}`;
    if (normalizedIds.has(id)) id = `${id}-${index + 1}`;
    normalizedIds.add(id);
    const example = buildExample(wordEntry.word, sense, index, usedExamples);
    usedExamples.add(example);

    return {
      id,
      pos: sense.pos,
      meaning: sense.meaning,
      example,
      importance: Math.max(1, 100 - index * 3),
      sourceIds: sense.sourceIds,
    };
  });

  return {
    id: wordEntry.id,
    word: wordEntry.word,
    senses: finalSenses,
  };
}

function stripDebugFields(words) {
  return words
    .filter((word) => word.senses.length > 0)
    .map((word) => ({
      ...word,
      senses: word.senses.map(({ sourceIds, ...sense }) => sense),
    }));
}

function buildReport(original, cleaned) {
  const beforeSenses = original.reduce((total, word) => total + (word.senses?.length || 0), 0);
  const afterSenses = cleaned.reduce((total, word) => total + word.senses.length, 0);
  const changedWords = cleaned.filter((word, index) =>
    word.senses.length !== (original[index].senses?.length || 0) ||
    word.senses.some((sense, senseIndex) => {
      const previous = original[index].senses?.[senseIndex];
      return !previous || previous.pos !== sense.pos || cleanDisplayText(previous.meaning) !== sense.meaning;
    }),
  );

  const largestReductions = cleaned
    .map((word, index) => ({
      word: word.word,
      before: original[index].senses?.length || 0,
      after: word.senses.length,
      removed: (original[index].senses?.length || 0) - word.senses.length,
      senses: word.senses.map((sense) => ({
        pos: sense.pos,
        meaning: sense.meaning,
        sourceIds: sense.sourceIds,
      })),
    }))
    .filter((item) => item.removed > 0)
    .sort((a, b) => b.removed - a.removed || b.before - a.before)
    .slice(0, 80);

  return {
    generatedAt: new Date().toISOString(),
    words: original.length,
    beforeSenses,
    afterSenses,
    removedSenses: beforeSenses - afterSenses,
    changedWords: changedWords.length,
    largestReductions,
  };
}

const original = readJson(inputPath);
const cleanedWithDebug = original.map(cleanWord);
const report = buildReport(original, cleanedWithDebug);
const cleaned = stripDebugFields(cleanedWithDebug);

if (previewArg) {
  const requestedWords = previewArg
    .slice("--preview=".length)
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  const preview = Object.fromEntries(
    requestedWords.map((word) => [
      word,
      {
        before: original.find((entry) => entry.word.toLowerCase() === word)?.senses || null,
        after: cleanedWithDebug.find((entry) => entry.word.toLowerCase() === word)?.senses || null,
      },
    ]),
  );

  console.log(JSON.stringify(preview, null, 2));
  process.exit(0);
}

if (!NO_WRITE && !DRY_RUN) {
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
  }
  writeJson(inputPath, cleaned);
  writeJson(reportPath, report);
} else if (DRY_RUN) {
  console.log(JSON.stringify(report, null, 2));
}

if (!DRY_RUN) {
  console.log(JSON.stringify({
    words: report.words,
    beforeSenses: report.beforeSenses,
    afterSenses: report.afterSenses,
    removedSenses: report.removedSenses,
    changedWords: report.changedWords,
    output: inputPath,
    backup: backupPath,
    report: reportPath,
  }, null, 2));
}
