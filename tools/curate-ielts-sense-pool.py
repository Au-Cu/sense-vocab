import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEFAULT_WORDS_PATH = DATA / "ielts-new-words.json"
DEFAULT_SEMANTIC_REPORT_PATH = DATA / "ielts-semantic-example-audit.json"
DEFAULT_REPORT_PATH = DATA / "ielts-curation-audit.json"


def row(pos, meaning, definition, example):
    return {
        "pos": pos,
        "meaning": meaning,
        "definition": definition,
        "example": example,
    }


# These entries cover words for which automatic synset selection either omitted a
# common IELTS sense or could not prove that a corpus sentence matched the sense.
# Each example was reviewed for part of speech, meaning, and contextual clues.
CURATED = {
    "accounting": [
        row(
            "n.",
            "会计，会计制度",
            "the work or system of recording and examining financial transactions",
            "The auditor examined the company's accounting records, invoices, and annual financial statements.",
        ),
    ],
    "accuser": [
        row(
            "n.",
            "控告者，指控者",
            "a person who claims that someone has done something wrong or illegal",
            "The accuser described the alleged assault in court while the defendant's lawyer questioned her evidence.",
        ),
    ],
    "affix": [
        row(
            "v.",
            "粘上，附上",
            "attach something firmly to another object",
            "Please affix the correct postage stamp to the envelope before mailing the application.",
        ),
        row(
            "n.",
            "词缀",
            "a group of letters added to a word to change its meaning or grammatical form",
            "In the word unhappy, the affix un- changes happy to its opposite meaning.",
        ),
    ],
    "antecedent": [
        row(
            "n.",
            "先行词",
            "a word, phrase, or clause to which a pronoun refers",
            "In the sentence Maria lost her keys, Maria is the antecedent of the pronoun her.",
        ),
        row(
            "n.",
            "前因，先例",
            "an earlier event or situation that influences a later one",
            "The historian traced the treaty's political antecedents to disputes that began decades earlier.",
        ),
        row(
            "adj.",
            "先前的，在前的",
            "earlier in time or order",
            "The court examined antecedent events to determine what had caused the conflict.",
        ),
    ],
    "baffle": [
        row(
            "v.",
            "使困惑，难住",
            "make someone unable to understand or explain something",
            "The unexplained signal continued to baffle engineers despite repeated tests of the equipment.",
        ),
        row(
            "n.",
            "挡板，隔板",
            "a plate that controls the flow of liquid, gas, sound, or energy",
            "Engineers installed a baffle inside the tank to stop the fuel from surging during sharp turns.",
        ),
    ],
    "batter": [
        row(
            "v.",
            "连续猛击，反复捶打",
            "hit someone or something hard many times",
            "Powerful waves battered the sea wall throughout the storm and broke several concrete blocks.",
        ),
        row(
            "n.",
            "面糊",
            "a liquid mixture of flour, eggs, and milk used in cooking",
            "She dipped the fish in batter before lowering it into the hot oil.",
        ),
        row(
            "n.",
            "击球手",
            "a player whose turn it is to hit the ball in baseball or cricket",
            "The batter struck the ball over the boundary and scored the winning runs.",
        ),
    ],
    "berth": [
        row(
            "n.",
            "卧铺，铺位",
            "a bed on a train or ship",
            "She reserved a lower berth on the overnight train so she could sleep during the journey.",
        ),
        row(
            "n.",
            "泊位，停泊处",
            "a place where a ship is tied up in a port",
            "The cargo ship waited outside the harbour until a berth became available.",
        ),
        row(
            "v.",
            "停泊",
            "bring a ship into a place where it can be tied up",
            "The captain berthed the ferry beside the terminal before passengers disembarked.",
        ),
    ],
    "best": [
        row(
            "adj.",
            "最好的，最合适的",
            "of the highest quality or most suitable kind",
            "The committee selected the best proposal because it offered strong evidence at a reasonable cost.",
        ),
        row(
            "adv.",
            "最，最好地",
            "more successfully or suitably than anything else",
            "This plant grows best in moist soil with several hours of sunlight each day.",
        ),
        row(
            "n.",
            "最佳状态，最好的人或事物",
            "the highest standard that someone or something can achieve",
            "The final demanded her best, so she trained carefully and arrived fully prepared.",
        ),
    ],
    "better": [
        row(
            "adj.",
            "更好的，更合适的",
            "of a higher quality or more suitable",
            "The revised treatment produced better results with fewer side effects.",
        ),
        row(
            "adv.",
            "更好地，更有效地",
            "more successfully or effectively",
            "Students remember the process better when they practise it instead of only reading about it.",
        ),
        row(
            "v.",
            "改善，胜过",
            "improve something or achieve more than a previous result",
            "The runner bettered her personal record by nearly two seconds.",
        ),
    ],
    "bill": [
        row(
            "n.",
            "账单",
            "a written statement showing how much money is owed",
            "After dinner, the waiter brought a bill listing each dish, the tax, and the total amount due.",
        ),
        row(
            "n.",
            "议案，法案",
            "a proposal for a new law",
            "Parliament debated the education bill before voting on whether it should become law.",
        ),
        row(
            "v.",
            "开账单，收费",
            "send someone a statement of money owed for goods or services",
            "The clinic will bill the insurance company directly for the medical examination.",
        ),
        row(
            "n.",
            "鸟嘴，喙",
            "the hard projecting mouth of a bird",
            "The duck used its broad bill to filter small plants from the shallow water.",
        ),
    ],
    "blink": [
        row(
            "v.",
            "眨眼",
            "close and open the eyes quickly",
            "She blinked several times to clear the dust from her eyes.",
        ),
        row(
            "n.",
            "眨眼，瞬间",
            "a quick closing and opening of the eyes",
            "In the blink of an eye, the warning light changed from green to red.",
        ),
    ],
    "blonde": [
        row(
            "adj.",
            "金发的",
            "having pale yellow or golden hair",
            "The witness described the missing child as a blonde girl wearing a blue coat.",
        ),
        row(
            "n.",
            "金发女子",
            "a woman or girl with pale yellow or golden hair",
            "The blonde in the front row was the violinist who performed the final solo.",
        ),
    ],
    "carcase": [
        row(
            "n.",
            "动物尸体，畜体",
            "the dead body of an animal, especially one prepared as meat",
            "Inspectors removed the damaged animal carcase from the food-processing line.",
        ),
    ],
    "carving": [
        row(
            "n.",
            "雕刻品",
            "an object or design made by cutting wood, stone, or another material",
            "The museum displayed a detailed ivory carving protected inside a glass case.",
        ),
        row(
            "n.",
            "雕刻",
            "the activity of cutting a shape or design into a material",
            "Wood carving requires sharp tools, steady hands, and careful control of the grain.",
        ),
    ],
    "cd-rom": [
        row(
            "n.",
            "只读光盘",
            "a compact disc from which a computer can read stored data",
            "The old encyclopedia came on a CD-ROM that users inserted into a computer to search its articles.",
        ),
    ],
    "centenary": [
        row(
            "n.",
            "一百周年纪念",
            "the hundredth anniversary of an event",
            "The university marked its centenary with an exhibition covering one hundred years of teaching and research.",
        ),
        row(
            "adj.",
            "一百周年的",
            "relating to a hundredth anniversary",
            "A centenary ceremony was held exactly one hundred years after the library opened.",
        ),
    ],
    "chapel": [
        row(
            "n.",
            "小教堂，礼拜堂",
            "a small building or room used for Christian worship",
            "The couple held a quiet wedding in the village chapel beside the old cemetery.",
        ),
    ],
    "cliche": [
        row(
            "n.",
            "陈词滥调，老生常谈",
            "an idea or expression that has been used too often and is no longer original",
            "The editor removed the cliche time will tell because it added nothing specific to the argument.",
        ),
    ],
    "coeducation": [
        row(
            "n.",
            "男女同校教育",
            "the education of male and female students together",
            "The college adopted coeducation and began admitting women to the same courses as men.",
        ),
    ],
    "commitment": [
        row(
            "n.",
            "承诺，投入",
            "a firm decision to do something and the willingness to give it time or effort",
            "Completing the five-year medical course requires sustained commitment, regular study, and clinical practice.",
        ),
        row(
            "n.",
            "义务，责任",
            "something that a person has promised or is required to do",
            "She declined the weekend trip because family commitments required her to remain at home.",
        ),
    ],
    "commuter": [
        row(
            "n.",
            "通勤者",
            "a person who regularly travels between home and work",
            "Thousands of commuters take the early train into the city and return home each evening.",
        ),
    ],
    "contingency": [
        row(
            "n.",
            "可能发生的意外，突发情况",
            "a possible future event that must be prepared for",
            "The hospital kept backup generators ready as a contingency in case the main power supply failed.",
        ),
        row(
            "n.",
            "偶然性，不确定性",
            "the condition of depending on uncertain events",
            "The schedule reflects the contingency of outdoor research, which may be delayed by severe weather.",
        ),
    ],
    "counterbalance": [
        row(
            "n.",
            "平衡力，配重",
            "a weight or force that balances another",
            "A heavy counterbalance allowed the lift to move the passenger cabin with less energy.",
        ),
        row(
            "v.",
            "抵消，平衡",
            "have an equal and opposite effect on something",
            "Higher exports helped counterbalance the decline in domestic consumer spending.",
        ),
    ],
    "custodian": [
        row(
            "n.",
            "看管人，保管人",
            "a person responsible for protecting or maintaining a place or property",
            "The museum custodian checked every gallery and locked the doors after the last visitor left.",
        ),
    ],
    "decoration": [
        row(
            "n.",
            "装饰品",
            "an object used to make a place or thing more attractive",
            "Paper lanterns and flower arrangements served as decorations for the festival hall.",
        ),
        row(
            "n.",
            "装饰",
            "the activity of making something more attractive",
            "The interior decoration combined pale walls, wooden furniture, and locally woven textiles.",
        ),
    ],
    "destine": [
        row(
            "v.",
            "注定，预定",
            "intend or determine something for a particular future",
            "The recovered timber was destined for reuse in the construction of new homes.",
        ),
    ],
    "dilapidated": [
        row(
            "adj.",
            "破旧的，年久失修的",
            "in a very bad condition because of age or neglect",
            "The council closed the dilapidated school after inspectors found a leaking roof and unsafe walls.",
        ),
    ],
    "dilate": [
        row(
            "v.",
            "扩大，扩张",
            "become or make something wider or larger",
            "The eye drops dilate the pupils so the doctor can examine the retina more clearly.",
        ),
    ],
    "din": [
        row(
            "n.",
            "喧闹声，嘈杂声",
            "a loud and unpleasant mixture of noises",
            "Workers could barely hear one another above the din of drills, engines, and metal machinery.",
        ),
    ],
    "disarray": [
        row(
            "n.",
            "混乱，杂乱",
            "a state of confusion or lack of organization",
            "After the sudden resignation, the department was in disarray and no one knew who approved payments.",
        ),
    ],
    "drainage": [
        row(
            "n.",
            "排水，排水系统",
            "the process or system by which water or other liquid is removed",
            "Engineers improved the road's drainage by installing channels that carried rainwater into the river.",
        ),
    ],
    "ensue": [
        row(
            "v.",
            "随之发生，接着发生",
            "happen after something else as a result",
            "A power failure stopped the traffic lights, and severe congestion ensued across the city centre.",
        ),
    ],
    "enrolment": [
        row(
            "n.",
            "登记，注册，入学人数",
            "the act of enrolling or the number of people enrolled",
            "University enrolment rose after the scholarship programme reduced tuition fees for low-income students.",
        ),
    ],
    "eradicate": [
        row(
            "v.",
            "根除，消灭",
            "destroy or remove something completely",
            "A coordinated vaccination campaign eradicated smallpox by preventing the virus from spreading.",
        ),
    ],
    "exhort": [
        row(
            "v.",
            "劝告，敦促",
            "strongly encourage someone to do something",
            "Health officials exhorted residents to boil drinking water until laboratory tests confirmed it was safe.",
        ),
    ],
    "existent": [
        row(
            "adj.",
            "存在的，现有的",
            "existing now or having real existence",
            "Researchers compared the newly discovered manuscript with every existent copy in the national archive.",
        ),
    ],
    "fatuous": [
        row(
            "adj.",
            "愚蠢的，荒谬的",
            "silly and showing a lack of intelligence",
            "The committee rejected the fatuous claim that pollution would disappear without any change in policy.",
        ),
    ],
    "fidelity": [
        row(
            "n.",
            "忠诚，忠实",
            "continued loyalty to a person, belief, or cause",
            "The translator preserved fidelity to the original text instead of adding her own interpretation.",
        ),
        row(
            "n.",
            "精确度，保真度",
            "the degree to which a copy accurately reproduces the original",
            "The new speakers reproduce recorded music with greater fidelity and less distortion.",
        ),
    ],
    "flabby": [
        row(
            "adj.",
            "松弛的，软弱无力的",
            "soft, loose, and lacking strength",
            "After months without exercise, his arm muscles felt flabby and tired quickly.",
        ),
    ],
    "fluff": [
        row(
            "n.",
            "绒毛，蓬松物",
            "soft light fibres or material",
            "She removed a piece of white fluff from the dark wool coat.",
        ),
        row(
            "v.",
            "弄错，搞砸",
            "make a mistake while saying or performing something",
            "The actor fluffed one line but recovered quickly and finished the scene.",
        ),
    ],
    "flyover": [
        row(
            "n.",
            "立交桥，高架道路",
            "a bridge that carries one road over another",
            "The new flyover carries motorway traffic above the busy junction and reduces delays below.",
        ),
        row(
            "n.",
            "低空飞行，飞越",
            "a ceremonial flight by aircraft over a place",
            "Military aircraft performed a flyover above the stadium during the national ceremony.",
        ),
    ],
    "forerunner": [
        row(
            "n.",
            "先驱，前身",
            "a person or thing that came before and influenced what followed",
            "The telegraph was an important forerunner of modern electronic communication.",
        ),
        row(
            "n.",
            "预兆，先兆",
            "a sign that something is going to happen",
            "A sudden drop in air pressure can be a forerunner of a severe storm.",
        ),
    ],
    "fruition": [
        row(
            "n.",
            "实现，完成",
            "the successful realization of a plan or project",
            "After ten years of research, the vaccine project finally came to fruition with regulatory approval.",
        ),
    ],
    "gist": [
        row(
            "n.",
            "要点，主旨",
            "the main meaning or most important point",
            "Although she missed several details, she understood the gist of the lecture about climate migration.",
        ),
    ],
    "goad": [
        row(
            "v.",
            "刺激，激励，驱使",
            "provoke or encourage someone to act",
            "Public criticism goaded the company into repairing the dangerous equipment.",
        ),
        row(
            "n.",
            "赶牲畜的尖棒",
            "a pointed stick used to make an animal move",
            "The farmer used a goad to guide the cattle through the narrow gate.",
        ),
    ],
    "havoc": [
        row(
            "n.",
            "严重破坏，混乱",
            "widespread damage or disorder",
            "The cyclone caused havoc by destroying power lines, flooding roads, and damaging hundreds of homes.",
        ),
    ],
    "hiring": [
        row(
            "n.",
            "雇用，招聘",
            "the act or process of employing someone",
            "The hospital increased its hiring of nurses after patient numbers rose sharply.",
        ),
    ],
    "horticulture": [
        row(
            "n.",
            "园艺，园艺学",
            "the science or practice of growing fruit, vegetables, and decorative plants",
            "Students of horticulture learned to graft fruit trees and control pests in greenhouse crops.",
        ),
    ],
    "inapt": [
        row(
            "adj.",
            "不恰当的，不合适的",
            "not suitable or appropriate in the circumstances",
            "His cheerful joke was inapt during a serious discussion of the fatal accident.",
        ),
    ],
    "influx": [
        row(
            "n.",
            "大量涌入，流入",
            "the arrival of a large number of people or things",
            "The coastal town built new housing after an influx of workers arrived for the construction project.",
        ),
    ],
    "loth": [
        row(
            "adj.",
            "不情愿的，勉强的",
            "unwilling to do something",
            "The committee was loth to cancel the programme because thousands of students depended on it.",
        ),
    ],
    "madden": [
        row(
            "v.",
            "使发狂，使极度恼怒",
            "make someone extremely angry or mentally distressed",
            "The constant drilling next door maddened residents who had been unable to sleep for several nights.",
        ),
    ],
    "maize": [
        row(
            "n.",
            "玉米",
            "a tall crop plant that produces large yellow grains on a cob",
            "Farmers planted maize after the spring rains and harvested the ripe cobs in early autumn.",
        ),
    ],
    "malleable": [
        row(
            "adj.",
            "可锻造的，易塑形的",
            "able to be shaped by pressure without breaking",
            "Gold is highly malleable, so craftsmen can hammer it into extremely thin sheets.",
        ),
        row(
            "adj.",
            "易受影响的，可改变的",
            "easily influenced or changed",
            "Young children's opinions can be malleable when trusted adults repeatedly present the same claim.",
        ),
    ],
    "mania": [
        row(
            "n.",
            "狂热，强烈爱好",
            "an excessive enthusiasm or desire for something",
            "The sudden mania for rare trainers pushed resale prices far above their original cost.",
        ),
        row(
            "n.",
            "躁狂症",
            "a mental condition involving extreme excitement and unusually high energy",
            "During an episode of mania, the patient slept very little and made several reckless financial decisions.",
        ),
    ],
    "manifold": [
        row(
            "adj.",
            "多种多样的，多方面的",
            "many and of several different kinds",
            "The policy had manifold effects on housing, employment, public health, and transport.",
        ),
        row(
            "n.",
            "歧管，多支管",
            "a pipe or chamber with several openings",
            "The exhaust manifold collects gases from each engine cylinder and directs them into one pipe.",
        ),
    ],
    "meteoric": [
        row(
            "adj.",
            "流星般迅速的，突然成功的",
            "developing or becoming successful very quickly",
            "The singer's meteoric rise took her from small local venues to an international tour within a year.",
        ),
        row(
            "adj.",
            "流星的",
            "relating to meteors",
            "Scientists analysed meteoric fragments that had survived their passage through Earth's atmosphere.",
        ),
    ],
    "monologue": [
        row(
            "n.",
            "独白，独角戏",
            "a long speech by one actor or speaker",
            "The actor delivered a ten-minute monologue alone on stage while the audience listened in silence.",
        ),
    ],
    "neurotic": [
        row(
            "adj.",
            "神经质的，焦虑不安的",
            "showing excessive anxiety or emotional instability",
            "His neurotic fear of contamination made him wash his hands dozens of times each day.",
        ),
        row(
            "n.",
            "神经症患者",
            "a person affected by a neurosis",
            "The outdated textbook described the patient as a neurotic rather than naming her specific anxiety disorder.",
        ),
    ],
    "nicety": [
        row(
            "n.",
            "细节，细微差别",
            "a small detail or fine distinction",
            "The interpreter explained the legal niceties that distinguished permission from formal authorization.",
        ),
        row(
            "n.",
            "礼节，得体",
            "a polite or socially appropriate detail of behaviour",
            "They ignored diplomatic niceties and began discussing the emergency immediately.",
        ),
    ],
    "observance": [
        row(
            "n.",
            "遵守，奉行",
            "the practice of obeying a law, rule, or custom",
            "Strict observance of laboratory safety rules prevented staff from being exposed to the chemical.",
        ),
        row(
            "n.",
            "纪念仪式，宗教仪式",
            "a ceremony or practice performed for religious or commemorative reasons",
            "The annual observance included a minute of silence for those who had died in the disaster.",
        ),
    ],
    "organizer": [
        row(
            "n.",
            "组织者",
            "a person who plans and arranges an event or activity",
            "The conference organizer booked the venue, invited speakers, and prepared the final schedule.",
        ),
        row(
            "n.",
            "记事本，电子日程工具",
            "a book or electronic tool used to arrange appointments and information",
            "She entered the meeting in her digital organizer and set a reminder for the previous day.",
        ),
    ],
    "ostentation": [
        row(
            "n.",
            "炫耀，卖弄",
            "an excessive display intended to impress other people",
            "The palace's gold-covered rooms reflected royal ostentation rather than practical comfort.",
        ),
    ],
    "outstrip": [
        row(
            "v.",
            "超过，胜过",
            "become greater or more successful than something else",
            "Demand for affordable housing continued to outstrip supply, causing rents to rise.",
        ),
    ],
    "periscope": [
        row(
            "n.",
            "潜望镜",
            "an optical instrument that allows someone to see from a hidden or lower position",
            "The submarine commander raised the periscope above the water to inspect nearby ships without surfacing.",
        ),
    ],
    "phone-in": [
        row(
            "n.",
            "听众电话参与的节目",
            "a radio or television programme in which the audience participates by telephone",
            "During the radio phone-in, listeners called to question the mayor about rising transport fares.",
        ),
    ],
    "photojournalism": [
        row(
            "n.",
            "新闻摄影，摄影报道",
            "the use of photographs to report news stories",
            "Her photojournalism documented the flood through images of rescue teams, damaged homes, and displaced families.",
        ),
    ],
    "piety": [
        row(
            "n.",
            "虔诚，敬神",
            "deep respect and devotion toward a religion or god",
            "Her religious piety was evident in daily prayer and years of service to the local temple.",
        ),
    ],
    "placard": [
        row(
            "n.",
            "标语牌，告示牌",
            "a large notice carried in public or displayed on a wall",
            "Protesters held a placard demanding clean water and stricter controls on industrial waste.",
        ),
        row(
            "v.",
            "张贴告示",
            "put notices on a building or in a public place",
            "Officials placarded the unsafe building with warnings that prohibited entry.",
        ),
    ],
    "platitude": [
        row(
            "n.",
            "陈词滥调，空话",
            "a remark that has been used too often to be interesting or useful",
            "Instead of offering a plan, the minister repeated the platitude that hard work solves every problem.",
        ),
    ],
    "pompous": [
        row(
            "adj.",
            "自负的，浮夸的",
            "too formal and self-important",
            "The manager's pompous speech praised his own leadership but ignored the team's actual work.",
        ),
    ],
    "prologue": [
        row(
            "n.",
            "序言，开场白",
            "an introductory part of a play, book, or event",
            "The novel's prologue describes the fire that shapes everything in the chapters that follow.",
        ),
    ],
    "recital": [
        row(
            "n.",
            "独奏会，朗诵会",
            "a public performance of music or poetry by one person or a small group",
            "At her piano recital, the student performed three sonatas before an audience of parents and teachers.",
        ),
        row(
            "n.",
            "详细叙述，列举",
            "a detailed account or list of facts",
            "The witness gave a careful recital of the events, including times, locations, and names.",
        ),
    ],
    "reflectance": [
        row(
            "n.",
            "反射率",
            "the proportion of light or radiation reflected by a surface",
            "Scientists measured the roof's reflectance to determine how much solar energy it sent back into the atmosphere.",
        ),
    ],
    "registrar": [
        row(
            "n.",
            "登记员，注册主任",
            "an official responsible for keeping records",
            "The university registrar updated the student's enrolment record and issued an official transcript.",
        ),
    ],
    "renewal": [
        row(
            "n.",
            "更新，续期",
            "the act of extending or making something valid again",
            "Passport renewal requires a recent photograph, the old document, and payment of the application fee.",
        ),
        row(
            "n.",
            "恢复，重建",
            "the process of making something active or strong again",
            "The riverfront renewal project replaced abandoned warehouses with parks, homes, and small businesses.",
        ),
    ],
    "repatriate": [
        row(
            "v.",
            "遣返回国，送回本国",
            "send someone back to their own country",
            "The embassy arranged flights to repatriate citizens who had been stranded abroad.",
        ),
        row(
            "n.",
            "被遣返回国者，归国者",
            "a person who has returned to their country of origin",
            "Each repatriate received temporary housing and help finding work after returning home.",
        ),
    ],
    "respondent": [
        row(
            "n.",
            "调查对象，回答者",
            "a person who answers questions in a survey or study",
            "Each survey respondent rated the service and explained the reason for the score.",
        ),
        row(
            "n.",
            "被告，被申请人",
            "the person against whom a legal petition or appeal is made",
            "The respondent filed evidence opposing the application before the court hearing.",
        ),
    ],
    "rig": [
        row(
            "v.",
            "装配，安装",
            "equip something with the parts needed for use",
            "Technicians rigged the stage with lights, speakers, and safety cables before the concert.",
        ),
        row(
            "v.",
            "操纵，暗中控制",
            "dishonestly arrange a result in advance",
            "Investigators found that officials had tried to rig the election by altering vote totals.",
        ),
        row(
            "n.",
            "钻井平台，成套设备",
            "a large structure or set of equipment used for a particular purpose",
            "The offshore oil rig drills through the seabed and pumps crude oil to the surface.",
        ),
    ],
    "rising": [
        row(
            "adj.",
            "上升的，增长的",
            "increasing in amount, level, or importance",
            "Rising sea levels are forcing coastal communities to strengthen flood defences.",
        ),
        row(
            "n.",
            "起义，反抗",
            "an organized rebellion against authority",
            "The government sent troops to suppress the armed rising in the northern provinces.",
        ),
    ],
    "sanity": [
        row(
            "n.",
            "神志正常，心智健全",
            "the condition of having a healthy and reasonable mind",
            "The psychiatrist assessed the defendant's sanity and concluded that he understood his actions.",
        ),
        row(
            "n.",
            "明智，合理",
            "reasonable and sensible thinking",
            "Restoring spending limits brought some sanity to a budget that had grown without control.",
        ),
    ],
    "secretion": [
        row(
            "n.",
            "分泌，分泌物",
            "a substance produced and released by a cell, gland, or organ",
            "Insulin is a secretion of the pancreas that helps regulate the level of sugar in the blood.",
        ),
    ],
    "seismic": [
        row(
            "adj.",
            "地震的，地震引起的",
            "relating to earthquakes or vibrations of the earth",
            "Seismic sensors recorded underground vibrations several seconds before the earthquake reached the city.",
        ),
        row(
            "adj.",
            "影响巨大的",
            "having a very large or important effect",
            "The invention of the internet produced a seismic change in communication, commerce, and access to information.",
        ),
    ],
    "septic": [
        row(
            "adj.",
            "受感染的，脓毒性的",
            "infected by harmful bacteria",
            "The untreated wound became septic, causing fever and requiring urgent antibiotics.",
        ),
        row(
            "adj.",
            "化粪池的",
            "relating to a tank in which household waste is broken down",
            "Rural homes without public sewers often store wastewater in a septic tank.",
        ),
    ],
    "sickness": [
        row(
            "n.",
            "疾病",
            "the condition of being ill",
            "The crew reported fever and stomach sickness after drinking contaminated water.",
        ),
        row(
            "n.",
            "恶心，呕吐感",
            "the feeling that one is going to vomit",
            "The rough sea caused motion sickness among several passengers.",
        ),
    ],
    "sparse": [
        row(
            "adj.",
            "稀疏的，稀少的",
            "small in number and spread far apart",
            "Vegetation becomes sparse at high altitude, where only a few tough plants survive.",
        ),
    ],
    "starting": [
        row(
            "adj.",
            "起始的，最初的",
            "existing or used at the beginning",
            "The starting salary rises after employees complete their first year of training.",
        ),
        row(
            "n.",
            "启动，开始",
            "the act of making a machine or process begin",
            "Starting the engine in freezing weather requires a fully charged battery.",
        ),
    ],
    "steering": [
        row(
            "n.",
            "驾驶，操纵",
            "the act or system of controlling the direction of a vehicle",
            "A fault in the car's steering made it difficult for the driver to turn safely.",
        ),
        row(
            "n.",
            "引导，指导",
            "the act of guiding a course of action",
            "The steering committee set priorities and guided the research project through each stage.",
        ),
    ],
    "succumb": [
        row(
            "v.",
            "屈服，屈从",
            "stop resisting pressure, temptation, or a stronger force",
            "After hours of questioning, the witness refused to succumb to threats and maintained her account.",
        ),
        row(
            "v.",
            "死于",
            "die from an illness or injury",
            "Several patients succumbed to the infection before an effective antibiotic became available.",
        ),
    ],
    "superintend": [
        row(
            "v.",
            "监督，管理",
            "be responsible for directing or managing work",
            "A senior engineer superintended the bridge repairs and inspected every completed section.",
        ),
    ],
    "superstructure": [
        row(
            "n.",
            "上层建筑，上部结构",
            "the part of a building or ship above its main supporting base",
            "Workers repaired the ship's superstructure above the main deck after it was damaged by waves.",
        ),
    ],
    "surname": [
        row(
            "n.",
            "姓，姓氏",
            "the family name shared by members of a family",
            "On the form, write your given name first and your surname in the final box.",
        ),
    ],
    "swerve": [
        row(
            "v.",
            "突然转向，急转弯",
            "change direction suddenly",
            "The driver swerved to avoid a cyclist who had fallen into the road.",
        ),
        row(
            "n.",
            "突然转向",
            "a sudden change of direction",
            "A sharp swerve carried the car across the centre line and into the opposite lane.",
        ),
    ],
    "telling": [
        row(
            "adj.",
            "有力的，能说明问题的",
            "having a strong or revealing effect",
            "The sharp fall in attendance was a telling sign that the public had lost confidence.",
        ),
        row(
            "n.",
            "讲述，叙述",
            "the act of relating a story or information",
            "Her telling of the rescue included details that had never appeared in the newspaper reports.",
        ),
    ],
    "tertiary": [
        row(
            "adj.",
            "第三的，第三级的",
            "third in order, rank, or stage",
            "After primary and secondary treatment, the wastewater receives tertiary treatment to remove remaining nutrients.",
        ),
        row(
            "adj.",
            "高等教育的",
            "relating to education at a college or university",
            "The scholarship helps rural students enter tertiary education after completing secondary school.",
        ),
    ],
    "timidity": [
        row(
            "n.",
            "胆怯，羞怯",
            "lack of courage or confidence",
            "Her initial timidity disappeared after several public-speaking classes gave her confidence.",
        ),
    ],
    "training": [
        row(
            "n.",
            "训练，培训",
            "the process of learning skills needed for a job or activity",
            "Emergency training taught staff how to use fire extinguishers and evacuate injured visitors.",
        ),
    ],
    "transfuse": [
        row(
            "v.",
            "给……输血",
            "transfer blood into a person's body",
            "Doctors had to transfuse two units of blood after the patient lost a dangerous amount during surgery.",
        ),
    ],
    "traveler": [
        row(
            "n.",
            "旅行者，旅客",
            "a person who is travelling",
            "Each traveler presented a passport and boarding pass before entering the departure area.",
        ),
    ],
    "tutorial": [
        row(
            "n.",
            "辅导课，教程",
            "a lesson or set of instructions given to a small group or individual",
            "During the mathematics tutorial, six students worked through difficult equations with their tutor.",
        ),
        row(
            "adj.",
            "辅导的，教学的",
            "relating to a tutor or instruction",
            "The website provides tutorial videos that demonstrate each stage of the laboratory procedure.",
        ),
    ],
    "underwrite": [
        row(
            "v.",
            "为……承保",
            "accept financial responsibility for an insurance risk",
            "The insurer agreed to underwrite the factory only after engineers improved its fire-safety system.",
        ),
        row(
            "v.",
            "资助，为……提供财务担保",
            "guarantee financial support for a project or activity",
            "A charitable foundation underwrote the cost of building the rural health clinic.",
        ),
    ],
    "unilateral": [
        row(
            "adj.",
            "单方面的，单边的",
            "done by or affecting only one side",
            "The employer made a unilateral change to working hours without consulting staff or their union.",
        ),
    ],
    "unrest": [
        row(
            "n.",
            "动荡，骚乱",
            "a state of public dissatisfaction and disturbance",
            "Rising food prices triggered widespread unrest, including strikes, demonstrations, and clashes with police.",
        ),
    ],
    "urchin": [
        row(
            "n.",
            "顽童，流浪儿童",
            "a poor and often mischievous child",
            "In the old novel, a street urchin earns coins by carrying luggage at the railway station.",
        ),
        row(
            "n.",
            "海胆",
            "a small round sea animal covered with sharp spines",
            "Divers found a sea urchin clinging to the rocks and feeding on algae.",
        ),
    ],
    "viable": [
        row(
            "adj.",
            "可行的，能成功的",
            "capable of working successfully",
            "Engineers concluded that solar power was a viable option because the region receives sunlight throughout the year.",
        ),
        row(
            "adj.",
            "能存活的，能生长发育的",
            "capable of living and developing normally",
            "Only viable seeds that germinated in the laboratory were planted in the restoration area.",
        ),
    ],
    "virtuous": [
        row(
            "adj.",
            "有道德的，品行端正的",
            "having high moral standards",
            "The judge praised the volunteer's virtuous conduct in returning the money and reporting the fraud.",
        ),
    ],
    "water-skiing": [
        row(
            "n.",
            "滑水运动",
            "the sport of being pulled over water on skis by a boat",
            "During the water-skiing lesson, the boat pulled each beginner across the lake while an instructor taught them to balance.",
        ),
    ],
    "westerner": [
        row(
            "n.",
            "西方人，欧美人",
            "a person from Europe, North America, or another western region",
            "As a westerner working in Japan, he studied local business customs before meeting clients.",
        ),
    ],
    "wreathe": [
        row(
            "v.",
            "环绕，笼罩",
            "surround or cover something in a twisting or circular form",
            "Morning mist wreathed the mountain peak and hid it from hikers in the valley.",
        ),
        row(
            "v.",
            "做成花环，用花环装饰",
            "form into a wreath or decorate with one",
            "Villagers wreathed the memorial in fresh flowers before the ceremony.",
        ),
    ],
    "zest": [
        row(
            "n.",
            "热情，兴致",
            "great enthusiasm and energy",
            "She approached field research with zest, working long hours and asking detailed questions.",
        ),
        row(
            "n.",
            "柑橘皮屑",
            "the coloured outer skin of a citrus fruit used as flavouring",
            "The cook added lemon zest to the cake mixture for a fresh citrus flavour.",
        ),
        row(
            "v.",
            "给……增添趣味或风味",
            "make something more lively or flavourful",
            "Fresh herbs zest up the simple soup without adding much salt.",
        ),
    ],
}


def normalize_example(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def make_sense(word, index, source):
    return {
        "id": f"sense-{index + 1}",
        "pos": source["pos"],
        "meaning": source["meaning"],
        "definition": source["definition"],
        "definitionSentence": source["definition"],
        "definitionSource": "manual-ielts-curation",
        "definitionZh": f"{source['meaning'].rstrip('。') }。",
        "definitionZhSource": "aligned-meaning",
        "example": source["example"],
        "exampleZh": "",
        "exampleSource": "manual-ielts-curation",
        "meaningSource": "manual-ielts-curation",
        "auditStatus": "manual-reviewed",
        "importance": max(1, 100 - index * 3),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Keep evidenced IELTS senses and add reviewed common-sense fallbacks."
    )
    parser.add_argument("--words-path", type=Path, default=DEFAULT_WORDS_PATH)
    parser.add_argument(
        "--semantic-report-path",
        type=Path,
        default=DEFAULT_SEMANTIC_REPORT_PATH,
    )
    parser.add_argument("--report-path", type=Path, default=DEFAULT_REPORT_PATH)
    args = parser.parse_args()

    words = json.loads(args.words_path.read_text(encoding="utf-8-sig"))
    semantic_report = json.loads(
        args.semantic_report_path.read_text(encoding="utf-8-sig")
    )
    exact_examples = {
        (entry["word"], entry["senseId"]): entry
        for entry in semantic_report.get("selectedRows", [])
        if entry.get("sameSynset")
    }
    best_semantic = {}
    for entry in semantic_report.get("selectedRows", []):
        key = entry["word"]
        if entry.get("sameSynset"):
            continue
        if key not in best_semantic or entry["score"] > best_semantic[key]["score"]:
            best_semantic[key] = entry

    replaced_words = []
    exact_examples_added = []
    corpus_fallbacks_added = []
    removed_senses = []
    unresolved_words = []

    for word_entry in words:
        word = word_entry["word"]
        if word in CURATED:
            word_entry["senses"] = [
                make_sense(word, index, source)
                for index, source in enumerate(CURATED[word])
            ]
            replaced_words.append(word)
            continue

        retained = []
        seen_examples = set()
        for sense in word_entry.get("senses", []):
            exact = exact_examples.get((word, sense.get("id")))
            if exact and not sense.get("example"):
                sense["example"] = exact["example"]
                sense["exampleZh"] = ""
                sense["exampleSource"] = "wordnet-example"
                sense["exampleQualityScore"] = round(exact["score"] * 100, 2)
                sense["exampleLicense"] = "WordNet 3.0 license"
                exact_examples_added.append(f"{word}::{sense.get('id')}")
            example_key = normalize_example(sense.get("example"))
            if example_key and example_key not in seen_examples:
                retained.append(sense)
                seen_examples.add(example_key)
            else:
                removed_senses.append(
                    {
                        "word": word,
                        "senseId": sense.get("id"),
                        "meaning": sense.get("meaning"),
                        "reason": "no-evidenced-example" if not example_key else "duplicate-example",
                    }
                )

        if not retained:
            fallback = best_semantic.get(word)
            if fallback:
                matching_sense = next(
                    (
                        sense
                        for sense in word_entry.get("senses", [])
                        if sense.get("id") == fallback["senseId"]
                    ),
                    None,
                )
                if matching_sense:
                    matching_sense["example"] = fallback["example"]
                    matching_sense["exampleZh"] = ""
                    matching_sense["exampleSource"] = fallback["source"]
                    matching_sense["exampleQualityScore"] = round(
                        fallback["score"] * 100,
                        2,
                    )
                    retained = [matching_sense]
                    corpus_fallbacks_added.append(word)
        if not retained:
            unresolved_words.append(word)
        word_entry["senses"] = retained
        for index, sense in enumerate(word_entry["senses"]):
            sense["id"] = f"sense-{index + 1}"
            sense["importance"] = max(1, 100 - index * 3)

    report = {
        "words": len(words),
        "senses": sum(len(entry.get("senses", [])) for entry in words),
        "replacedWords": replaced_words,
        "exactExamplesAdded": exact_examples_added,
        "corpusFallbacksAdded": corpus_fallbacks_added,
        "removedSenses": removed_senses,
        "unresolvedWords": unresolved_words,
    }
    args.words_path.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    args.report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "words": report["words"],
                "senses": report["senses"],
                "curatedWords": len(replaced_words),
                "exactExamplesAdded": len(exact_examples_added),
                "corpusFallbacksAdded": len(corpus_fallbacks_added),
                "removedSenses": len(removed_senses),
                "unresolvedWords": unresolved_words,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if unresolved_words:
        raise RuntimeError(f"IELTS curation left empty words: {unresolved_words}")


if __name__ == "__main__":
    main()
