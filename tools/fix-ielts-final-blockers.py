import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "ielts-new-words.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalized_zh(value):
    return str(value or "").strip().rstrip("。") + "。"


def curated_sense(pos, meaning, definition, example, example_zh):
    return {
        "pos": pos,
        "meaning": meaning,
        "definition": definition,
        "definitionSentence": definition,
        "definitionSource": "manual-ielts-final-review",
        "definitionZh": normalized_zh(meaning),
        "definitionZhSource": "aligned-meaning",
        "example": example,
        "exampleZh": normalized_zh(example_zh),
        "exampleZhSource": "manual-ielts-final-review",
        "exampleSource": "manual-ielts-final-review",
        "meaningSource": "manual-ielts-final-review",
        "auditStatus": "manual-reviewed",
    }


CURATED = {
    "all": [
        curated_sense(
            "adj.",
            "所有的，一切的",
            "the whole number or amount of a group, with no exceptions",
            "All laboratory samples must be labelled before they are placed in cold storage.",
            "所有实验室样本在放入冷藏库前都必须贴好标签。",
        ),
        curated_sense(
            "pron.",
            "全部，一切",
            "every person or thing in the group being discussed",
            "The rescue team found all of the missing hikers before nightfall.",
            "救援队在天黑前找到了所有失踪的徒步者。",
        ),
        curated_sense(
            "adv.",
            "完全地，全然",
            "completely or entirely",
            "After the overnight snowfall, the mountain road was all white and barely visible.",
            "一夜降雪后，山路一片雪白，几乎看不清了。",
        ),
    ],
    "area": [
        curated_sense(
            "n.",
            "地区，区域",
            "a particular part of a place or geographical region",
            "The coastal area was evacuated before the tropical storm reached the mainland.",
            "热带风暴登陆前，沿海地区已被疏散。",
        ),
        curated_sense(
            "n.",
            "面积",
            "the amount of space covered by a two-dimensional surface",
            "The rectangular field has an area of two thousand square metres.",
            "这块长方形田地的面积为两千平方米。",
        ),
        curated_sense(
            "n.",
            "领域，范围",
            "a particular subject, activity, or field of knowledge",
            "Cybersecurity is an area of research that combines computing, law, and risk management.",
            "网络安全是一个融合计算机、法律和风险管理的研究领域。",
        ),
    ],
    "case": [
        curated_sense(
            "n.",
            "情况，情形",
            "a particular situation or example of something",
            "In this case, the infection can be treated with antibiotics instead of surgery.",
            "在这种情况下，感染可以用抗生素治疗，而不必手术。",
        ),
        curated_sense(
            "n.",
            "外框，框架",
            "a frame fitted around an opening such as a door or window",
            "The carpenter repaired the wooden window case before installing the new glass.",
            "木匠在安装新玻璃前修好了木制窗框。",
        ),
        curated_sense(
            "n.",
            "案件，诉讼",
            "a matter examined and decided by a court of law",
            "The prosecutor presented new DNA evidence during the murder case.",
            "检察官在这起谋杀案审理中出示了新的 DNA 证据。",
        ),
        curated_sense(
            "n.",
            "箱，盒，套",
            "a protective container made to hold or carry an object",
            "The violinist returned the instrument to its padded case after the concert.",
            "音乐会结束后，小提琴手把乐器放回带衬垫的琴盒。",
        ),
    ],
    "eke": [
        curated_sense(
            "v.",
            "勉强维持，艰难地获得",
            "to obtain just enough of something with difficulty, especially in the phrase eke out",
            "The family eked out a living by growing vegetables on a small plot of dry land.",
            "这家人靠在一小块旱地上种菜勉强维持生计。",
        ),
    ],
    "fascinating": [
        curated_sense(
            "adj.",
            "极有吸引力的，迷人的",
            "so interesting that it holds your attention",
            "The documentary offers a fascinating look at how whales communicate across vast oceans.",
            "这部纪录片以引人入胜的方式展现了鲸如何跨越辽阔海洋进行交流。",
        ),
    ],
    "fifth": [
        curated_sense(
            "adj.",
            "第五的",
            "coming after the fourth and before the sixth",
            "The fifth chapter explains how the experiment was designed and controlled.",
            "第五章解释了这项实验是如何设计和控制的。",
        ),
        curated_sense(
            "n.",
            "五分之一",
            "one of five equal parts",
            "One fifth of the survey participants said they cycled to work every day.",
            "五分之一的调查参与者表示他们每天骑车上班。",
        ),
    ],
    "hard-working": [
        curated_sense(
            "adj.",
            "勤奋的，工作努力的",
            "putting a great deal of effort and care into work",
            "The hard-working research team checked every measurement twice before publishing its results.",
            "这支勤奋的研究团队在发布结果前把每项测量数据都核对了两遍。",
        ),
    ],
    "hardy": [
        curated_sense(
            "adj.",
            "耐寒的，能耐受恶劣条件的",
            "strong enough to survive difficult weather or living conditions",
            "These hardy mountain goats survive freezing winds and scarce winter food.",
            "这些耐寒的山羊能熬过刺骨寒风和冬季食物短缺。",
        ),
    ],
    "monsoon": [
        curated_sense(
            "n.",
            "季风",
            "a seasonal wind in South and Southeast Asia that changes direction during the year",
            "The summer monsoon carries moist air from the ocean and brings heavy rain across southern Asia.",
            "夏季季风从海洋带来湿润空气，并给南亚大范围地区带来暴雨。",
        ),
        curated_sense(
            "n.",
            "雨季",
            "the rainy season associated with the summer monsoon",
            "Farmers plant rice at the start of the monsoon, when weeks of rain begin to fill the fields.",
            "农民在雨季开始、连绵降雨逐渐灌满田地时种下水稻。",
        ),
    ],
    "ordeal": [
        curated_sense(
            "n.",
            "痛苦的经历，严峻考验",
            "a very painful, difficult, or exhausting experience",
            "After three days without food or shelter, reaching the rescue camp ended their ordeal.",
            "在三天没有食物和住处后，他们抵达救援营地，终于结束了这场磨难。",
        ),
    ],
    "ravage": [
        curated_sense(
            "v.",
            "严重破坏，摧毁",
            "to cause severe and extensive damage to a place or thing",
            "The wildfire ravaged the valley, destroying farms, forests, and hundreds of homes.",
            "野火重创了山谷，烧毁了农场、森林和数百所房屋。",
        ),
        curated_sense(
            "n.",
            "破坏，蹂躏造成的后果",
            "the destructive effects of violence, disease, or time, usually used in the plural",
            "The ravages of war left the city without clean water, electricity, or functioning hospitals.",
            "战争的破坏使这座城市失去了清洁用水、电力和正常运转的医院。",
        ),
    ],
    "scotland": [
        curated_sense(
            "n.",
            "苏格兰",
            "a country in the northern part of the island of Great Britain",
            "Scotland is known for its Highlands, historic castles, and capital city of Edinburgh.",
            "苏格兰以高地、历史悠久的城堡和首府爱丁堡而闻名。",
        ),
    ],
    "serious": [
        curated_sense(
            "adj.",
            "严重的；严肃认真的",
            "important, dangerous, or requiring careful attention",
            "The surgeon said the infection was serious and required immediate treatment.",
            "外科医生说感染情况很严重，需要立即治疗。",
        ),
    ],
    "sporadic": [
        curated_sense(
            "adj.",
            "零星的，时断时续的",
            "happening occasionally and at irregular intervals",
            "Sporadic gunfire broke the silence, with long quiet intervals between the shots.",
            "零星的枪声打破了寂静，每次枪响之间都隔着很长一段安静时间。",
        ),
    ],
    "touchy": [
        curated_sense(
            "adj.",
            "敏感的，棘手的",
            "likely to cause offence or requiring careful handling",
            "Pay negotiations are a touchy subject because a careless remark can offend either side.",
            "薪酬谈判是个敏感话题，因为一句不慎的话就可能冒犯任何一方。",
        ),
    ],
    "wave": [
        curated_sense(
            "n.",
            "波，波浪",
            "a moving ridge on the surface of water",
            "A powerful wave crashed over the sea wall and flooded the road behind it.",
            "一股巨浪越过海堤，淹没了后面的道路。",
        ),
        curated_sense(
            "n.",
            "一波，一阵",
            "a sudden occurrence or increase in a particular activity or feeling",
            "A wave of resignations followed the company announcement, with twelve managers leaving in one week.",
            "公司发布公告后出现了一波辞职潮，一周内有十二名经理离职。",
        ),
        curated_sense(
            "v.",
            "挥手示意",
            "to move a hand or object from side to side as a signal",
            "The guide waved a red flag to warn the hikers that the bridge was unsafe.",
            "向导挥动红旗，警告徒步者那座桥不安全。",
        ),
        curated_sense(
            "n.",
            "波动，波",
            "a disturbance that transfers energy through matter or space",
            "Seismic waves travelled through the rock and were recorded by sensors hundreds of kilometres away.",
            "地震波穿过岩层，被数百公里外的传感器记录下来。",
        ),
    ],
    "word": [
        curated_sense(
            "n.",
            "单词，词",
            "a single unit of language that has meaning and can be spoken or written",
            "The word bank can refer either to a financial institution or to the land beside a river.",
            "单词 bank 既可以指金融机构，也可以指河岸。",
        ),
        curated_sense(
            "n.",
            "字，计算机数据单位",
            "a fixed-size group of bits handled as one unit by a computer processor",
            "The processor handles a 64-bit word, allowing it to move eight bytes of data at once.",
            "该处理器以一个 64 位字为单位，一次可移动八字节数据。",
        ),
    ],
}


CURATED.update({
    "aggregate": [
        curated_sense(
            "n.",
            "总数，合计",
            "a total formed by combining several separate amounts",
            "The aggregate of the five regional budgets exceeds two million dollars.",
            "五个地区预算的总额超过二百万美元。",
        ),
        curated_sense(
            "adj.",
            "总计的，合计的",
            "formed by adding several separate amounts together",
            "The survey reports an aggregate score calculated from all twelve questions.",
            "该调查报告给出了由全部十二道题合并计算出的总分。",
        ),
        curated_sense(
            "v.",
            "合计，总计",
            "to amount to a particular total when combined",
            "Ticket sales from the three concerts aggregated more than fifty thousand pounds.",
            "三场音乐会的门票销售额合计超过五万英镑。",
        ),
        curated_sense(
            "v.",
            "聚集，汇集",
            "to collect separate things into a group or whole",
            "The platform aggregates rainfall measurements from hundreds of weather stations.",
            "该平台汇集了数百个气象站的降雨量数据。",
        ),
    ],
    "air": [
        curated_sense(
            "n.",
            "空气",
            "the mixture of gases that surrounds the Earth and is breathed by people and animals",
            "Opening both windows allowed cool fresh air to circulate through the crowded classroom.",
            "打开两扇窗户后，凉爽的新鲜空气在拥挤的教室里流通起来。",
        ),
        curated_sense(
            "v.",
            "通风，晾晒",
            "to expose a room or an object to fresh air",
            "After the rain stopped, she aired the damp blankets outside in the sun.",
            "雨停后，她把受潮的毯子拿到室外阳光下晾晒。",
        ),
        curated_sense(
            "v.",
            "播出，发表",
            "to broadcast a programme or express an opinion publicly",
            "The television station will air the documentary after the evening news.",
            "电视台将在晚间新闻之后播出这部纪录片。",
        ),
    ],
    "amphibian": [
        curated_sense(
            "n.",
            "两栖动物",
            "an animal such as a frog that can live both in water and on land",
            "A frog begins life as an aquatic tadpole before becoming an adult amphibian on land.",
            "青蛙幼年时是水生蝌蚪，之后才成长为在陆地生活的成年两栖动物。",
        ),
        curated_sense(
            "adj.",
            "两栖类的",
            "relating to animals that live both in water and on land",
            "Polluted ponds can destroy amphibian eggs before the young frogs hatch.",
            "受到污染的池塘会在幼蛙孵化前破坏两栖动物的卵。",
        ),
    ],
    "attack": [
        curated_sense(
            "n.",
            "攻击，袭击",
            "an act of using violence or weapons against someone or something",
            "The army launched a surprise attack on the enemy base before dawn.",
            "军队在黎明前对敌军基地发动了突然袭击。",
        ),
        curated_sense(
            "v.",
            "攻击，袭击",
            "to use violence or weapons against someone or something",
            "The guard dog attacked the intruder as he climbed over the fence.",
            "入侵者翻越围栏时，警犬向他发起了攻击。",
        ),
        curated_sense(
            "v.",
            "抨击，严厉批评",
            "to criticize someone or something strongly and publicly",
            "Opposition leaders attacked the proposal for raising taxes on low-income families.",
            "反对党领导人严厉抨击了提高低收入家庭税负的提案。",
        ),
        curated_sense(
            "n.",
            "疾病发作",
            "a sudden short period of illness, especially involving the heart or breathing",
            "Doctors treated him immediately when he suffered a severe asthma attack.",
            "他哮喘严重发作时，医生立即为他进行了治疗。",
        ),
    ],
    "awareness": [
        curated_sense(
            "n.",
            "意识，认识",
            "knowledge or understanding of a situation or fact",
            "The campaign raised public awareness of the health risks caused by air pollution.",
            "这项活动提高了公众对空气污染健康风险的认识。",
        ),
    ],
    "book": [
        curated_sense(
            "n.",
            "书，书籍",
            "a written or printed work consisting of pages bound together",
            "She borrowed a history book from the library to research the Industrial Revolution.",
            "她从图书馆借了一本历史书，用来研究工业革命。",
        ),
        curated_sense(
            "n.",
            "账簿，账目",
            "a written record of the financial accounts of a business, usually used in the plural",
            "The auditor examined the company's books to trace the missing payments.",
            "审计员检查了公司的账目，以追查失踪的款项。",
        ),
        curated_sense(
            "v.",
            "预订",
            "to arrange in advance to have a seat, room, or service",
            "We booked a double room near the station for the night before the conference.",
            "我们为会议前一晚预订了车站附近的一间双人房。",
        ),
        curated_sense(
            "v.",
            "登记，记录在案",
            "to record someone's name and details officially, especially after an offence",
            "Police booked the driver for speeding and recorded his licence details.",
            "警方以超速为由登记处理了这名司机，并记录了他的驾照信息。",
        ),
    ],
    "chant": [
        curated_sense(
            "v.",
            "反复呼喊，吟唱",
            "to repeat words or sing a phrase continuously and rhythmically",
            "Supporters chanted the team's name in rhythm throughout the final match.",
            "决赛期间，球迷们一直有节奏地反复高喊球队的名字。",
        ),
        curated_sense(
            "n.",
            "反复呼喊的口号，吟唱",
            "a phrase or song repeated continuously and rhythmically",
            "A loud protest chant rose from the crowd outside the parliament building.",
            "议会大楼外的人群中响起了响亮而反复的抗议口号。",
        ),
    ],
    "check": [
        curated_sense(
            "v.",
            "检查，核对",
            "to examine something in order to verify its accuracy, quality, or condition",
            "The engineer checked every safety valve before restarting the machine.",
            "工程师在重新启动机器前检查了每一个安全阀。",
        ),
        curated_sense(
            "n.",
            "检查，核查",
            "an examination made to verify that something is correct or safe",
            "Airport staff carried out a security check on every passenger's luggage.",
            "机场工作人员对每位乘客的行李进行了安全检查。",
        ),
        curated_sense(
            "n.",
            "支票",
            "a written instruction directing a bank to pay a particular amount of money",
            "The client paid the final invoice by check after the work was completed.",
            "工程完成后，客户用支票支付了最后一张发票。",
        ),
        curated_sense(
            "v.",
            "制止，抑制",
            "to stop or slow the progress of something",
            "Rapid vaccination helped check the spread of the disease across the region.",
            "迅速开展疫苗接种帮助遏制了疾病在该地区的传播。",
        ),
    ],
    "chord": [
        curated_sense(
            "n.",
            "和弦，和音",
            "three or more musical notes played together",
            "The guitarist played a final chord while the singer held the last note.",
            "歌手拖住最后一个音时，吉他手弹出了最后一个和弦。",
        ),
        curated_sense(
            "n.",
            "弦",
            "a straight line joining two points on a curve or circle",
            "Draw a chord between the two marked points on the circumference of the circle.",
            "在圆周上两个标记点之间画一条弦。",
        ),
    ],
    "clear": [
        curated_sense(
            "adj.",
            "清楚的，明确的",
            "easy to understand and free from confusion or doubt",
            "The lecturer gave clear instructions, so every group followed the same procedure.",
            "讲师给出了明确的说明，因此每个小组都遵循了同一套步骤。",
        ),
        curated_sense(
            "v.",
            "清除，移走",
            "to remove unwanted objects or obstructions from a place",
            "Workers cleared fallen branches from the road after the storm.",
            "暴风雨过后，工人们清除了道路上的断枝。",
        ),
        curated_sense(
            "v.",
            "放晴，变晴朗",
            "to become bright and free from cloud, mist, or rain",
            "The sky cleared after noon, allowing the rescue helicopter to take off.",
            "中午过后天空放晴，救援直升机得以起飞。",
        ),
    ],
    "cooking": [
        curated_sense(
            "n.",
            "烹饪，做饭",
            "the activity or process of preparing food using heat",
            "Slow cooking made the tough meat tender enough to cut with a fork.",
            "慢火烹饪使坚韧的肉变得用叉子就能切开。",
        ),
    ],
    "empty": [
        curated_sense(
            "adj.",
            "空的",
            "containing nothing",
            "The fuel tank was empty, so the generator stopped during the power cut.",
            "油箱已经空了，因此发电机在停电期间停止了运转。",
        ),
        curated_sense(
            "v.",
            "倒空，清空",
            "to remove everything from a container or place",
            "Please empty the recycling bin before placing new bottles inside it.",
            "在放入新瓶子之前，请先清空回收箱。",
        ),
    ],
    "end": [
        curated_sense(
            "n.",
            "末端，结束",
            "the final part or point of something in time or space",
            "At the end of the tunnel, rescuers finally saw daylight.",
            "在隧道尽头，救援人员终于看到了日光。",
        ),
        curated_sense(
            "n.",
            "目的，目标",
            "a result or purpose that someone intends to achieve",
            "Reducing childhood poverty was the ultimate end of the new social policy.",
            "减少儿童贫困是这项新社会政策的最终目标。",
        ),
        curated_sense(
            "v.",
            "结束，终止",
            "to bring or come to a finish",
            "The two countries signed an agreement to end the border conflict.",
            "两国签署协议，以结束边境冲突。",
        ),
    ],
    "field": [
        curated_sense(
            "n.",
            "田地，场地",
            "an open area of land used for farming or sport",
            "Farmers planted wheat across the field after the spring rain softened the soil.",
            "春雨使土壤变软后，农民在田地里种下了小麦。",
        ),
        curated_sense(
            "n.",
            "领域，专业",
            "a particular subject of study, knowledge, or work",
            "Her research opened a new field of study linking genetics with language development.",
            "她的研究开辟了一个把遗传学与语言发展联系起来的新研究领域。",
        ),
        curated_sense(
            "n.",
            "战场",
            "a place where a battle is fought",
            "The wounded soldiers were carried from the field to a hospital behind the front line.",
            "受伤士兵被从战场送往前线后方的一所医院。",
        ),
        curated_sense(
            "n.",
            "字段",
            "a space in a database or form reserved for a particular item of information",
            "Enter your passport number in the required field on the online form.",
            "请在在线表格的必填字段中输入护照号码。",
        ),
    ],
    "fire": [
        curated_sense(
            "n.",
            "火，火焰",
            "the heat, light, and flames produced when something burns",
            "Campers gathered around the fire to cook food and keep warm after sunset.",
            "日落后，露营者围在火堆旁做饭取暖。",
        ),
        curated_sense(
            "n.",
            "火灾",
            "an uncontrolled burning that causes danger or damage",
            "A faulty electrical cable started a fire that destroyed three apartments.",
            "一根有故障的电缆引发火灾，烧毁了三套公寓。",
        ),
        curated_sense(
            "n.",
            "炮火，射击",
            "shots fired from guns or other weapons",
            "The soldiers took cover when heavy enemy fire struck the hillside.",
            "猛烈的敌军炮火击中山坡时，士兵们寻找掩护。",
        ),
        curated_sense(
            "v.",
            "开火，射击",
            "to discharge a gun or other weapon",
            "The officer ordered the guards not to fire unless they were attacked.",
            "军官命令警卫，除非受到攻击，否则不得开火。",
        ),
        curated_sense(
            "v.",
            "解雇",
            "to dismiss someone from a job",
            "The company fired the manager after an audit revealed repeated fraud.",
            "审计发现多次欺诈行为后，公司解雇了这名经理。",
        ),
    ],
    "hand": [
        curated_sense(
            "n.",
            "手",
            "the part of the body at the end of the arm",
            "The nurse washed her hands carefully before changing the patient's bandage.",
            "护士在为病人更换绷带前仔细洗了手。",
        ),
        curated_sense(
            "n.",
            "指针",
            "a pointer on a clock or measuring instrument",
            "When the minute hand reached twelve, the station clock struck six.",
            "分针指向十二时，车站的大钟敲了六下。",
        ),
        curated_sense(
            "v.",
            "递，交给",
            "to give or pass something directly to another person",
            "She handed the customs officer her passport and arrival card.",
            "她把护照和入境卡递给了海关人员。",
        ),
        curated_sense(
            "n.",
            "帮助，援手",
            "help given to someone",
            "Several neighbours gave the elderly couple a hand with moving their furniture.",
            "几位邻居帮这对老年夫妇搬了家具。",
        ),
    ],
    "learn": [
        curated_sense(
            "v.",
            "学习，学会",
            "to gain knowledge or skill through study, teaching, or experience",
            "Children learn new vocabulary faster when they meet the words in meaningful stories.",
            "儿童在有意义的故事中遇到新词时，学习词汇会更快。",
        ),
        curated_sense(
            "v.",
            "得知，获悉",
            "to discover or be told a fact or piece of information",
            "We learned from the laboratory report that the water was unsafe to drink.",
            "我们从实验室报告中得知，这些水不宜饮用。",
        ),
    ],
    "mar": [
        curated_sense(
            "v.",
            "损坏，破坏",
            "to spoil the appearance or quality of something",
            "Deep scratches marred the polished surface of the antique table.",
            "深深的划痕破坏了古董桌子光亮的表面。",
        ),
    ],
    "might": [
        curated_sense(
            "n.",
            "力量，威力",
            "great strength or power",
            "The empire used its military might to control the surrounding territories.",
            "这个帝国利用其军事实力控制周边领土。",
        ),
        curated_sense(
            "modal.",
            "可能，也许",
            "used to express possibility",
            "Dark clouds over the mountains suggest that it might rain this afternoon.",
            "山上的乌云表明今天下午可能会下雨。",
        ),
    ],
    "pacific": [
        curated_sense(
            "adj.",
            "和平的，温和的",
            "peaceful and not aggressive",
            "The mediator sought a pacific solution that both rival groups could accept.",
            "调解人寻求一种两个敌对团体都能接受的和平解决方案。",
        ),
        curated_sense(
            "n.",
            "太平洋",
            "the ocean between Asia and Australia in the west and the Americas in the east",
            "The research vessel crossed the Pacific to measure deep-ocean temperatures.",
            "这艘科考船横渡太平洋，以测量深海温度。",
        ),
    ],
    "palpitate": [
        curated_sense(
            "v.",
            "心悸，快速跳动",
            "to beat rapidly or irregularly, especially of the heart",
            "Her heart began to palpitate after she drank several cups of strong coffee.",
            "她喝了几杯浓咖啡后，心脏开始快速跳动。",
        ),
    ],
    "point": [
        curated_sense(
            "n.",
            "点，小点",
            "a very small round mark",
            "Mark each sampling site with a red point on the map.",
            "在地图上用一个红点标出每个采样地点。",
        ),
        curated_sense(
            "n.",
            "要点，论点",
            "the main idea or purpose of something said or written",
            "Her main point was that prevention costs less than emergency treatment.",
            "她的主要论点是，预防的成本低于紧急治疗。",
        ),
        curated_sense(
            "n.",
            "得分，分数",
            "a unit used for scoring a game, test, or competition",
            "The basketball team won by a single point in the final second.",
            "这支篮球队在最后一秒以一分之差获胜。",
        ),
        curated_sense(
            "n.",
            "地点，位置",
            "a particular place or position",
            "Rescue boats met at a fixed point two kilometres from the coast.",
            "救援船在距海岸两公里的固定地点会合。",
        ),
        curated_sense(
            "v.",
            "指出，指向",
            "to direct attention or indicate a direction with a finger or object",
            "The sign points visitors toward the emergency exit beside the stairs.",
            "这个标志把访客指向楼梯旁的紧急出口。",
        ),
        curated_sense(
            "v.",
            "削尖，使尖锐",
            "to make the end of something sharp",
            "The child pointed the pencil with a sharpener before beginning the drawing.",
            "孩子在开始画画前用卷笔刀把铅笔削尖。",
        ),
    ],
    "post": [
        curated_sense(
            "n.",
            "邮件，邮政",
            "letters and parcels carried by a postal service",
            "The signed contract arrived by post two days after it was sent.",
            "签署好的合同寄出两天后通过邮政送达。",
        ),
        curated_sense(
            "n.",
            "职位，岗位",
            "a job or official position",
            "She accepted a teaching post at a rural secondary school.",
            "她接受了乡村一所中学的教学岗位。",
        ),
        curated_sense(
            "n.",
            "柱，杆",
            "a strong upright pole fixed in the ground",
            "Workers attached the warning sign to a metal post beside the road.",
            "工人们把警告牌固定在路边的一根金属柱上。",
        ),
        curated_sense(
            "v.",
            "邮寄",
            "to send a letter or parcel through the postal service",
            "Please post the application before Friday so it arrives by the deadline.",
            "请在星期五前寄出申请，以便在截止日期前送达。",
        ),
        curated_sense(
            "v.",
            "发布，张贴",
            "to publish information or display a notice publicly",
            "The university posted the examination results on its website.",
            "大学在网站上公布了考试结果。",
        ),
    ],
    "satellite": [
        curated_sense(
            "n.",
            "卫星，人造卫星",
            "an object that moves around a planet, especially a machine sent into space",
            "The weather satellite sends new images of the storm to forecasters every hour.",
            "气象卫星每小时向预报员发送新的风暴图像。",
        ),
    ],
    "school": [
        curated_sense(
            "n.",
            "学校",
            "an institution where people, especially children, receive education",
            "The village school provides free lunches and textbooks to every pupil.",
            "这所乡村学校为每名学生提供免费午餐和教科书。",
        ),
        curated_sense(
            "n.",
            "学派，思想流派",
            "a group of people sharing a particular set of ideas or methods",
            "These economists belong to a school of thought that favours strict control of inflation.",
            "这些经济学家属于一个主张严格控制通货膨胀的思想流派。",
        ),
        curated_sense(
            "n.",
            "鱼群",
            "a large group of fish swimming together",
            "Divers watched a school of silver fish turn together around the coral reef.",
            "潜水员看着一群银色的鱼在珊瑚礁周围整齐转向。",
        ),
        curated_sense(
            "v.",
            "教育，训练",
            "to educate or train someone thoroughly",
            "Years of field research schooled her in recognizing subtle changes in animal behaviour.",
            "多年的野外研究训练她识别动物行为的细微变化。",
        ),
    ],
    "type": [
        curated_sense(
            "n.",
            "类型，种类",
            "a group of things that share particular characteristics",
            "This type of battery performs well in cold weather but costs more to manufacture.",
            "这种电池在寒冷天气下性能良好，但制造成本更高。",
        ),
        curated_sense(
            "v.",
            "打字，键入",
            "to write information using a keyboard",
            "She typed the interview notes into the research database.",
            "她把访谈笔记键入了研究数据库。",
        ),
    ],
    "volatile": [
        curated_sense(
            "adj.",
            "不稳定的，易变的",
            "likely to change suddenly or become dangerous",
            "Oil prices remained volatile as traders reacted to each new political crisis.",
            "交易员对每一次新的政治危机作出反应，导致油价持续剧烈波动。",
        ),
        curated_sense(
            "adj.",
            "易挥发的",
            "evaporating easily at ordinary temperatures",
            "The laboratory stores volatile chemicals in sealed containers away from heat.",
            "实验室把易挥发的化学品存放在远离热源的密封容器中。",
        ),
        curated_sense(
            "n.",
            "挥发性物质",
            "a substance that evaporates easily",
            "The instrument detects volatiles released by heated rock samples.",
            "该仪器能够检测加热岩石样本释放出的挥发性物质。",
        ),
    ],
    "water": [
        curated_sense(
            "n.",
            "水",
            "the clear liquid essential for life that falls as rain and fills rivers and seas",
            "The village pumps drinking water from a deep well during the dry season.",
            "旱季时，这个村庄从深井中抽取饮用水。",
        ),
        curated_sense(
            "v.",
            "给……浇水",
            "to pour water onto plants or soil",
            "Gardeners water the young trees every morning until their roots are established.",
            "在幼树根系稳固前，园丁每天早晨给它们浇水。",
        ),
    ],
})

# WordNet does not model many preposition, conjunction, modal, and discourse
# uses. These high-frequency IELTS headwords therefore need an explicit
# learner-facing treatment instead of accepting whichever rare synset happens
# to be available.
CURATED.update({
    "in": [
        curated_sense(
            "prep.",
            "在……里面；在……期间",
            "inside a place, area, situation, or period of time",
            "The signed contract is in the blue folder, and the payment is due in ten days.",
            "签署好的合同在蓝色文件夹里，款项须在十天内支付。",
        ),
        curated_sense(
            "adv.",
            "进入；在里面",
            "into or inside a place",
            "The laboratory door was open, so the technician went in to check the equipment.",
            "实验室的门开着，于是技术员走进去检查设备。",
        ),
        curated_sense(
            "adj.",
            "流行的，时髦的",
            "currently fashionable or popular",
            "Reusable water bottles are in now because many students want to reduce plastic waste.",
            "可重复使用的水瓶现在很流行，因为许多学生希望减少塑料垃圾。",
        ),
    ],
    "on": [
        curated_sense(
            "prep.",
            "在……上面",
            "touching and supported by the surface of something",
            "The research notes are on the desk beside the microscope.",
            "研究笔记放在显微镜旁边的桌面上。",
        ),
        curated_sense(
            "prep.",
            "关于，涉及",
            "about a particular subject",
            "The professor gave a lecture on renewable energy and urban air pollution.",
            "教授作了一场关于可再生能源和城市空气污染的讲座。",
        ),
        curated_sense(
            "adv.",
            "开着；在运转",
            "in operation or functioning",
            "The warning light is still on, so the engineer has not restarted the machine.",
            "警示灯仍然亮着，所以工程师还没有重启机器。",
        ),
        curated_sense(
            "adv.",
            "继续下去",
            "continuing forward or continuing an activity",
            "After a short interruption, the speaker went on with her presentation.",
            "短暂中断后，演讲者继续进行她的报告。",
        ),
        curated_sense(
            "adj.",
            "已安排的，正在进行的",
            "planned to happen or currently taking place",
            "The outdoor concert is still on despite the light rain.",
            "尽管下着小雨，露天音乐会仍按计划举行。",
        ),
    ],
    "say": [
        curated_sense(
            "v.",
            "说，讲",
            "to express something using words",
            "The witness said that she had seen a red car leave the building before dawn.",
            "证人说，她在黎明前看见一辆红色汽车驶离大楼。",
        ),
        curated_sense(
            "v.",
            "写着；表明",
            "to contain particular words or communicate particular information",
            "The notice says that all visitors must wear protective glasses in the workshop.",
            "告示上写着，所有访客在车间内都必须佩戴护目镜。",
        ),
        curated_sense(
            "n.",
            "发言权，决定权",
            "the right or opportunity to influence a decision",
            "Local residents should have a say in how the riverside land is developed.",
            "当地居民应该对河岸土地如何开发拥有发言权。",
        ),
    ],
    "as": [
        curated_sense(
            "prep.",
            "作为，以……身份",
            "in the role or function of",
            "She worked as a nurse in a rural clinic before studying public health.",
            "在学习公共卫生之前，她曾在一家乡村诊所担任护士。",
        ),
        curated_sense(
            "conj.",
            "当……时；随着",
            "while something is happening or changing",
            "As the temperature rose, the ice on the lake became dangerously thin.",
            "随着气温升高，湖面的冰变得非常薄，十分危险。",
        ),
        curated_sense(
            "conj.",
            "因为，由于",
            "because of the fact that",
            "As the final train had already left, we stayed near the station overnight.",
            "由于末班火车已经开走，我们在车站附近住了一夜。",
        ),
        curated_sense(
            "adv.",
            "同样地，一样",
            "to the same degree, usually in a comparison",
            "The northern route is not as steep as the path through the valley.",
            "北线不像穿过山谷的那条小路那么陡。",
        ),
    ],
    "go": [
        curated_sense(
            "v.",
            "去，前往",
            "to move or travel from one place to another",
            "Researchers go to the island each spring to observe the migrating birds.",
            "研究人员每年春天前往该岛观察候鸟。",
        ),
        curated_sense(
            "v.",
            "运转，运行",
            "to function or operate",
            "The backup generator began to go as soon as the main power supply failed.",
            "主电源一中断，备用发电机就开始运转。",
        ),
        curated_sense(
            "v.",
            "变得，进入某种状态",
            "to become or enter a particular condition",
            "Without refrigeration, the milk will go sour within a few hours.",
            "如果不冷藏，牛奶几小时内就会变酸。",
        ),
        curated_sense(
            "v.",
            "进展，进行",
            "to develop or proceed in a particular way",
            "The clinical trial went well, and no serious side effects were reported.",
            "临床试验进展顺利，未报告严重副作用。",
        ),
        curated_sense(
            "n.",
            "尝试",
            "an attempt at doing something",
            "I had a go at repairing the bicycle before taking it to a mechanic.",
            "我先尝试自己修理自行车，然后才把它送去维修店。",
        ),
    ],
    "get": [
        curated_sense(
            "v.",
            "得到，获得",
            "to obtain, receive, or buy something",
            "Students can get a free copy of the report from the university library.",
            "学生可以从大学图书馆免费获得一份报告。",
        ),
        curated_sense(
            "v.",
            "变得，进入某种状态",
            "to become or reach a particular state",
            "The roads get slippery when overnight rain freezes before sunrise.",
            "夜雨在日出前结冰时，道路会变得湿滑。",
        ),
        curated_sense(
            "v.",
            "理解，明白",
            "to understand an idea, explanation, or joke",
            "After the tutor drew a diagram, I finally got how the circuit worked.",
            "导师画出示意图后，我终于明白了电路的工作原理。",
        ),
        curated_sense(
            "v.",
            "到达",
            "to arrive at a place",
            "We got to the airport two hours before the international flight departed.",
            "我们在国际航班起飞前两小时到达了机场。",
        ),
        curated_sense(
            "v.",
            "取来，拿来",
            "to go somewhere and bring someone or something back",
            "Could you get the first-aid kit from the cupboard beside the stairs?",
            "你能从楼梯旁的柜子里把急救箱拿来吗？",
        ),
    ],
    "take": [
        curated_sense(
            "v.",
            "拿走，携带",
            "to carry or move someone or something to another place",
            "Please take these blood samples to the laboratory before they become too warm.",
            "请在这些血液样本变得过热前把它们送到实验室。",
        ),
        curated_sense(
            "v.",
            "选择；接受",
            "to choose, accept, or use something",
            "Most commuters take the earlier train when heavy snow is forecast.",
            "天气预报有大雪时，大多数通勤者会选择较早的那班火车。",
        ),
        curated_sense(
            "v.",
            "花费，需要",
            "to require a particular amount of time, effort, or space",
            "Restoring the damaged wetland may take several years of careful work.",
            "修复受损湿地可能需要数年的细致工作。",
        ),
        curated_sense(
            "v.",
            "服用；摄入",
            "to consume medicine, food, or drink",
            "Patients should take the tablets with food to reduce stomach irritation.",
            "患者应随餐服用这些药片，以减少胃部刺激。",
        ),
        curated_sense(
            "v.",
            "拍摄；记录",
            "to record a photograph, measurement, or note",
            "The survey team took photographs of every crack in the bridge.",
            "调查组拍摄了桥上每一道裂缝的照片。",
        ),
    ],
    "give": [
        curated_sense(
            "v.",
            "给，交给",
            "to transfer something to another person",
            "The pharmacist gave the patient written instructions with the medicine.",
            "药剂师把书面用药说明和药品一起交给了患者。",
        ),
        curated_sense(
            "v.",
            "提供，给予",
            "to provide someone with something",
            "The scholarship gives rural students access to university education.",
            "这项奖学金为农村学生提供接受大学教育的机会。",
        ),
        curated_sense(
            "v.",
            "产生，带来",
            "to produce a result, feeling, or effect",
            "Large windows give the classroom plenty of natural light.",
            "大窗户给教室带来了充足的自然光。",
        ),
        curated_sense(
            "v.",
            "发表，举行",
            "to perform or deliver an activity such as a speech or lesson",
            "The scientist gave a public lecture on the risks of antibiotic resistance.",
            "这位科学家就抗生素耐药性的风险作了一场公开讲座。",
        ),
    ],
    "good": [
        curated_sense(
            "adj.",
            "好的，优质的",
            "of a high quality or standard",
            "Good insulation keeps the house warm while reducing energy consumption.",
            "优质保温材料既能让房屋保持温暖，又能降低能源消耗。",
        ),
        curated_sense(
            "adj.",
            "有益的，有好处的",
            "having a helpful or beneficial effect",
            "Regular exercise is good for heart health and can improve sleep quality.",
            "规律运动有益于心脏健康，也能改善睡眠质量。",
        ),
        curated_sense(
            "adj.",
            "善良的，品行端正的",
            "morally right, kind, or well behaved",
            "A good neighbour checked on the elderly couple during the power cut.",
            "停电期间，一位好心邻居前去看望那对老年夫妇。",
        ),
        curated_sense(
            "n.",
            "益处，好处",
            "benefit or advantage",
            "The new drainage system was built for the good of the whole community.",
            "新排水系统是为整个社区的利益而建的。",
        ),
    ],
    "may": [
        curated_sense(
            "modal.",
            "可能，也许",
            "used to express possibility",
            "Sea levels may rise faster if polar ice continues to melt.",
            "如果极地冰层继续融化，海平面可能会更快上升。",
        ),
        curated_sense(
            "modal.",
            "可以，获准",
            "used to ask for or give permission",
            "Visitors may enter the archive only after showing valid identification.",
            "访客出示有效身份证明后方可进入档案馆。",
        ),
        curated_sense(
            "n.",
            "五月",
            "the fifth month of the year",
            "The field survey will begin in May, when the mountain roads reopen.",
            "实地调查将在五月山路重新开放时开始。",
        ),
    ],
    "back": [
        curated_sense(
            "n.",
            "背部",
            "the rear part of the human body from the neck to the waist",
            "The nurse placed a cushion behind the patient's back to support his spine.",
            "护士在患者背后放了一个靠垫，以支撑他的脊柱。",
        ),
        curated_sense(
            "n.",
            "后部，背面",
            "the rear or reverse side of something",
            "The emergency exit is at the back of the lecture hall.",
            "紧急出口位于报告厅后部。",
        ),
        curated_sense(
            "adv.",
            "回到原处；向后",
            "to an earlier place, position, or condition",
            "After collecting the samples, the researchers carried them back to the laboratory.",
            "采集完样本后，研究人员把它们带回了实验室。",
        ),
        curated_sense(
            "v.",
            "支持，资助",
            "to support a person, proposal, or organization",
            "Several medical charities backed the campaign for free childhood vaccinations.",
            "数家医疗慈善机构支持为儿童免费接种疫苗的活动。",
        ),
        curated_sense(
            "v.",
            "倒退，后退",
            "to move backwards",
            "The driver backed the truck slowly into the loading area.",
            "司机把卡车缓慢倒入装货区。",
        ),
        curated_sense(
            "adj.",
            "后面的，后部的",
            "located at the rear of something",
            "The equipment is stored in the back room behind the main office.",
            "设备存放在主办公室后面的房间里。",
        ),
    ],
    "even": [
        curated_sense(
            "adv.",
            "甚至，连",
            "used to emphasize something surprising or extreme",
            "The flood damaged every bridge, and even the emergency vehicles could not cross the river.",
            "洪水损坏了所有桥梁，甚至连应急车辆也无法过河。",
        ),
        curated_sense(
            "adj.",
            "平坦的，平整的",
            "level, smooth, and without noticeable variation",
            "Workers spread the concrete until the surface was completely even.",
            "工人把混凝土铺开，直到表面完全平整。",
        ),
        curated_sense(
            "adj.",
            "相等的，势均力敌的",
            "equal in amount, score, or strength",
            "With ten minutes remaining, the two teams were even at two goals each.",
            "比赛还剩十分钟时，两队以二比二战平。",
        ),
        curated_sense(
            "adj.",
            "偶数的",
            "divisible exactly by two",
            "Every even number can be divided by two without leaving a remainder.",
            "每个偶数都能被二整除而没有余数。",
        ),
        curated_sense(
            "v.",
            "使平整；使相等",
            "to make something level or equal",
            "The gardener added soil to even the ground before laying the path.",
            "园丁在铺设小路前加土把地面整平。",
        ),
    ],
    "leave": [
        curated_sense(
            "v.",
            "离开，出发",
            "to go away from a person or place",
            "The last ferry leaves the island at six in the evening.",
            "最后一班渡轮晚上六点驶离该岛。",
        ),
        curated_sense(
            "v.",
            "留下，遗留",
            "to cause something to remain in a place or condition",
            "Please leave the completed questionnaire on the researcher's desk.",
            "请把填好的问卷留在研究人员的桌上。",
        ),
        curated_sense(
            "v.",
            "使保持某种状态",
            "to allow someone or something to remain in a particular state",
            "Opening the freezer door for too long can leave the food partly thawed.",
            "冰柜门打开太久会使食物部分解冻。",
        ),
        curated_sense(
            "n.",
            "假期，休假",
            "official permission to be absent from work or duty",
            "She took two weeks of medical leave after the operation.",
            "手术后她休了两周病假。",
        ),
        curated_sense(
            "n.",
            "许可，准许",
            "formal permission to do something",
            "The court granted the journalist leave to appeal the decision.",
            "法院准许这名记者对该裁决提出上诉。",
        ),
    ],
    "feel": [
        curated_sense(
            "v.",
            "感觉，感到",
            "to experience an emotion or physical condition",
            "Many patients feel anxious before surgery, even when the procedure is routine.",
            "许多患者在手术前会感到焦虑，即使手术属于常规操作。",
        ),
        curated_sense(
            "v.",
            "摸到，感知",
            "to notice something through touch or physical sensation",
            "The doctor could feel a steady pulse at the patient's wrist.",
            "医生能在患者手腕处摸到稳定的脉搏。",
        ),
        curated_sense(
            "v.",
            "认为，觉得",
            "to believe or have an opinion",
            "Residents feel that the new bus route will reduce traffic in the town centre.",
            "居民认为新公交线路将减少市中心的交通拥堵。",
        ),
        curated_sense(
            "n.",
            "氛围，感觉",
            "the general impression or atmosphere of a place or situation",
            "Wooden shelves and warm lighting give the library a welcoming feel.",
            "木质书架和暖色灯光给图书馆营造出亲切的氛围。",
        ),
        curated_sense(
            "n.",
            "手感；直觉",
            "an intuitive understanding or physical impression",
            "After several practice flights, the pilot developed a feel for the controls.",
            "经过几次飞行练习，飞行员逐渐掌握了操纵装置的感觉。",
        ),
    ],
})


def preserve_pronunciation(entry, senses):
    existing = entry.get("senses", [])
    by_pos = {}
    for sense in existing:
        if sense.get("ipa") and sense.get("pos") not in by_pos:
            by_pos[sense.get("pos")] = sense
    fallback = next((sense for sense in existing if sense.get("ipa")), {})
    for index, sense in enumerate(senses, 1):
        pronunciation = by_pos.get(sense["pos"], fallback)
        for field in ("ipa", "ipaSource", "audio"):
            if pronunciation.get(field):
                sense[field] = pronunciation[field]
        sense["id"] = f"sense-{index}"
        sense["importance"] = max(1, 100 - (index - 1) * 3)


def main():
    words = read_json(WORDS_PATH)
    word_map = {entry["word"]: entry for entry in words}
    missing = sorted(set(CURATED) - set(word_map))
    if missing:
        raise RuntimeError(f"Missing IELTS words for final curation: {missing}")

    for word, senses in CURATED.items():
        entry = word_map[word]
        preserve_pronunciation(entry, senses)
        entry["senses"] = senses

    stressed_in_audio = (
        "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9f/"
        "LL-Q1860_%28eng%29-Pvanp7-in_%28stressed%29.wav/"
        "LL-Q1860_%28eng%29-Pvanp7-in_%28stressed%29.wav.mp3"
    )
    for sense in word_map["in"]["senses"]:
        sense["ipa"] = "/ɪn/"
        sense["ipaSource"] = "kaikki-wiktionary-stressed"
        sense["audio"] = stressed_in_audio

    batter = word_map["batter"]["senses"][0]
    batter["meaning"] = "连续击打，反复猛打"
    batter["definitionZh"] = "连续击打，反复猛打。"

    # A concise Chinese rendering is safer than a machine translation that
    # accidentally changes the sense. Examples retain their full translations.
    for entry in words:
        for index, sense in enumerate(entry.get("senses", []), 1):
            sense["id"] = f"sense-{index}"
            sense["importance"] = max(1, 100 - (index - 1) * 3)
            sense["definitionZh"] = normalized_zh(sense.get("meaning"))
            sense["definitionZhSource"] = "aligned-meaning"

    write_json(WORDS_PATH, words)
    print(json.dumps({
        "words": len(words),
        "senses": sum(len(entry.get("senses", [])) for entry in words),
        "curatedWords": len(CURATED),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
