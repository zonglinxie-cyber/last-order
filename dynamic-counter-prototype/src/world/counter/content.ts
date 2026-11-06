import type { Customer, League, Perk, Product, Style, Trait } from "./types.ts";

export const TRAIT_LABELS: Record<Trait, string> = {
  light: "轻薄", wear: "持妆", calm: "舒缓", repair: "修护",
};

export const PRODUCTS: Product[] = [
  { id: "breeze", name: "风感轻乳", kind: "日常底妆", price: 238, cost: 108, traits: { light: 3, wear: 2, calm: 0, repair: 0 }, color: "#b8d8cb", note: "轻薄满分，通勤持妆；低门槛，不包办敏感修护。" },
  { id: "dew", name: "露水舒缓乳", kind: "舒缓底妆", price: 328, cost: 142, traits: { light: 3, wear: 0, calm: 3, repair: 0 }, color: "#a7d8dc", note: "轻薄与舒缓兼顾，不适合全天不补妆。" },
  { id: "anchor", name: "定格修护霜", kind: "长效底妆", price: 398, cost: 174, traits: { light: 0, wear: 3, calm: 0, repair: 3 }, color: "#d6bca8", note: "长效持妆兼顾修护，肤感偏厚。" },
  { id: "nest", name: "安心屏障霜", kind: "屏障护理", price: 458, cost: 198, traits: { light: 0, wear: 0, calm: 3, repair: 3 }, color: "#c7b8de", note: "舒缓与修护双强，不能拿它证明持妆。" },
  { id: "guard", name: "守场柔雾霜", kind: "专业底妆", price: 498, cost: 218, traits: { light: 0, wear: 3, calm: 3, repair: 1 }, color: "#e1b2bd", note: "为长班和易泛红的皮肤准备。" },
  { id: "feather", name: "羽光修护乳", kind: "轻盈精华", price: 598, cost: 268, traits: { light: 3, wear: 1, calm: 0, repair: 3 }, color: "#e3cf96", note: "轻薄修护不将就，但高售价需要真实预算支撑。" },
];


// 基础字段是 daily 来意；额外场景独立成单，不预设此前是否成交。
export const CUSTOMERS: Customer[] = [
  {
    id: "shen", name: "沈姐", role: "赶早班的护士长", portrait: "/assets/game/customer-shen-consultation.webp",
    primary: "wear", secondary: "light", budget: 280,
    opening: "交班前没空补妆，口罩一戴就是半天。",
    story: "女儿今晚第一次上台，我下班直接赶过去，妆得留到合照。口罩底下别太厚就好。",
    returnLine: "又碰上你了，帮我看看这回怎么选。",
    scenes: [
      { id: "shen-rest", label: "轮休陪读", primary: "calm", secondary: "light", budget: 340, opening: "口罩摘下来两颊发红，休息日先想舒服些。", story: "陪女儿去图书馆，她挑书，我找个座位歇歇。脸上用着舒服，薄一点就行。" },
      { id: "shen-picnic", label: "公园野餐", primary: "light", secondary: "wear", budget: 260, opening: "难得出去野餐，薄薄涂一层就行。", story: "饭盒装好了，下午还要陪女儿放风筝。选支轻薄、能留到下午的，别总让我翻包补妆。" },
    ],
  },
  {
    id: "mei", name: "梅姨", role: "晨练队领队", portrait: "/assets/game/customer-mei-consultation.webp",
    primary: "calm", secondary: "repair", budget: 460,
    opening: "风一吹脸就泛红，今天不想再受刺激。",
    story: "队里人爱问我用什么，我得先挑舒服的。脸上还干巴巴的，修护也帮我看看。",
    returnLine: "我又来转转，有合适的就看看。",
    scenes: [
      { id: "mei-market", label: "菜场晨逛", primary: "light", secondary: "wear", budget: 280, opening: "晨练完去买菜，别给我糊厚了，轻轻爽爽的就成。", story: "孙子点名要吃韭菜饺子，晨练完我就去买菜，可没手一路掏镜子补妆。" },
      { id: "mei-show", label: "舞队汇演", primary: "wear", secondary: "calm", budget: 500, opening: "从彩排等到晚上才上台，这回要能撑得住。", story: "站位表揣兜里了，得从彩排忙到晚场，忙热了脸又容易红。" },
    ],
  },
  {
    id: "zhou", name: "周姐", role: "出差中的培训师", portrait: "/assets/game/customer-zhou-consultation.webp",
    primary: "wear", secondary: "repair", budget: 410,
    opening: "要连讲两场课，中间只有十分钟。",
    story: "转到台前才三个月，课间十分钟还得答疑，补妆顾不上。脸也干，能兼顾修护更好。",
    returnLine: "你好，又来挑东西了，我说一下这次的要求。",
    scenes: [
      { id: "zhou-family", label: "返乡合照", primary: "light", secondary: "calm", budget: 360, opening: "回家拍全家福，想轻薄自然些，不要讲课时那种妆感。", story: "爸妈连合照站哪儿都安排好了，我坐车坐得脸有点红，想用着舒服些。" },
      { id: "zhou-hotel", label: "酒店暖房", primary: "repair", secondary: "wear", budget: 410, opening: "酒店暖气开了一夜，脸颊干得起屑，先看看修护的。", story: "课件备完了，明天又是一天课。先顾干燥，上课时妆能稳住就更省事。" },
    ],
  },
  {
    id: "xiaoyu", name: "小雨", role: "实习生", portrait: "/assets/game/customer-xiaoyu-consultation.webp",
    primary: "light", secondary: "wear", budget: 250,
    opening: "第一次正式开会，想自然一点，别像戴着面具。",
    story: "第一份工资还没发，我算好钱才来的。开会想看着自然点，最好开到一半也不用补。",
    returnLine: "嗨，我又来看看，这次也帮我参谋一下吧。",
    scenes: [
      { id: "xiaoyu-campus", label: "换季返校", primary: "calm", secondary: "light", budget: 280, opening: "这两天脸颊老泛红，回学校前想先找个用着舒服的。", story: "学妹约我聊实习，我还得先想想能讲什么。别太厚就好，车费和生活费还得留着。" },
      { id: "xiaoyu-expo", label: "展会值岗", primary: "wear", secondary: "light", budget: 270, opening: "明天守一天展台，洗手间都得轮着去，没空补妆。", story: "胸牌领好了，我负责登记，得守到收摊。妆撑得久一点，别太厚，价格也别把补贴花光了。" },
    ],
  },
  {
    id: "anjie", name: "安姐", role: "社区书店主理人", portrait: "/assets/game/customer-anjie-consultation.webp",
    primary: "calm", secondary: "light", budget: 340,
    opening: "搬书落了一脸灰，现在有点刺，先求舒服。",
    story: "晚上街坊来读书会，椅子还没摆完呢。先找个舒缓的，脸上轻一点，搬东西也自在。",
    returnLine: "路过就进来了，看看有没有合适的。",
    scenes: [
      { id: "anjie-books", label: "周末淘书", primary: "light", secondary: "wear", budget: 290, opening: "去旧书集只想涂得轻薄些，别让我一路惦记脸上的东西。", story: "摊主给我留了批旧童书，估计得翻半天，妆留得住就行，多留点钱买书。" },
      { id: "anjie-stockroom", label: "库房整理", primary: "repair", secondary: "calm", budget: 470, opening: "连着整理几天库房，脸干得起皮，想好好修护一下。", story: "书总算归好架了，今晚能早关门。脸上干得起皮还有点红，想找支能慢慢养护的。" },
    ],
  },
  {
    id: "duan", name: "段小姐", role: "夜班摄影师", portrait: "/assets/game/customer-duan-consultation.webp",
    primary: "repair", secondary: "wear", budget: 420,
    opening: "连熬三个夜，脸干得起皮，先看看修护的吧。",
    story: "自己的工作照拖了两年，总算约上了。先顾好起皮，拍照那天也想少补几次妆。",
    returnLine: "又来了，我先看看，再跟你说要哪种。",
    scenes: [
      { id: "duan-wedding", label: "婚礼跟拍", primary: "wear", secondary: "calm", budget: 510, opening: "从接亲拍到晚宴，中间顾不上自己，妆得撑完这一程。", story: "从接亲拍到晚宴，相机放下才想起来没吃饭，跑热了脸还容易红。" },
      { id: "duan-seaside", label: "休假看海", primary: "light", secondary: "repair", budget: 560, opening: "这次休假想把脸上的负担也减下来，越轻越好。", story: "这次去海边只带书，相机留家里。脸颊还有点干，轻薄又能修护的话，贵一点我也看看。" },
    ],
  },
  {
    id: "zhao", name: "赵老师", role: "户外研学老师", portrait: "/assets/game/customer-zhao-consultation.webp",
    primary: "wear", secondary: "calm", budget: 510,
    opening: "一整天带孩子在外面跑，得撑到放学。",
    story: "带孩子出去观察植物，我得蹲下去陪他们找叶子，补妆是顾不上了。在外面跑久了脸会红，也想用得舒服些。",
    returnLine: "你好呀，我又来看看，这回的要求重新跟你说。",
    scenes: [
      { id: "zhao-prep", label: "室内备课", primary: "calm", secondary: "light", budget: 340, opening: "野外课回来脸颊红红的，明天留校备课，先求舒服。", story: "标本摆了一桌，孩子们的问题比叶子还多，明天坐着备课，脸上轻一点就好。" },
      { id: "zhao-gallery", label: "学生画展", primary: "light", secondary: "wear", budget: 280, opening: "孩子请我看画展，薄薄一层就好，别不像平时的老师。", story: "有个孩子画我们看蜗牛，还把我的眼镜画歪了。看完展一起吃饭，最好不需要再补妆。" },
    ],
  },
  {
    id: "miduo", name: "米朵", role: "独立舞者", portrait: "/assets/game/people/miduo.webp",
    primary: "light", secondary: "repair", budget: 600,
    opening: "排练时不想有负担，脸上越轻越好。",
    story: "小剧场的票卖了一半，排练还得照常来。脸上想轻一点，最近有点干，也想兼顾修护。",
    returnLine: "我又来了，先让我看看柜上这几支。",
    scenes: [
      { id: "miduo-outdoor", label: "户外赶场", primary: "wear", secondary: "calm", budget: 520, opening: "下午跳完还有晚场，路上没地方补妆，今天得撑住。", story: "两个场地隔着半座城，换鞋都得在车上。路上热起来脸容易红，舒缓也帮我顾顾。" },
      { id: "miduo-break", label: "排练休整", primary: "repair", secondary: "calm", budget: 460, opening: "连着卸妆，脸颊干得起屑，休排这几天想好好修护。", story: "音乐放着，不过今天只负责收拾房间，顺便挑点护理的，顾顾脸上干和红的地方。" },
    ],
  },
  {
    id: "tangtang", name: "唐糖", role: "刚入行的短视频助理", portrait: "/assets/game/people/tangtang.webp",
    primary: "calm", secondary: "wear", budget: 500,
    opening: "照着参考图一层层涂，两颊都红了，先挑个舒服的吧。",
    story: "参考图我存了一相册，越看越拿不准。还要跟几个小时直播，先顾泛红，妆也别中途掉了。",
    returnLine: "又见面啦，我先翻翻手机里的备忘录。",
    scenes: [
      { id: "tangtang-transit", label: "地铁跟拍", primary: "light", secondary: "wear", budget: 270, opening: "今天我跟着拿设备，脸上想像没涂一样轻，别糊着。", story: "背包里全是电池，还得换几趟地铁拍街景，妆能跟完半天就行，交通费可得留着。" },
      { id: "tangtang-wrap", label: "收工休整", primary: "repair", secondary: "calm", budget: 460, opening: "这几天卸妆太勤，脸干得起皮，想找支修护的。", story: "明天不用交妆面作业，参考图终于可以关了。先管管起皮，再兼顾一下泛红。" },
    ],
  },
  {
    id: "liangxia", name: "梁夏", role: "总被拉去当伴娘的上班族", portrait: "/assets/game/people/liangxia.webp",
    primary: "light", secondary: "wear", budget: 280,
    opening: "平时上班想涂薄点，伴娘那套妆就算了。",
    story: "伴娘群又在选口红了，我上班可懒得这么折腾。薄一点，午休不用重补，省下时间眯一会儿。",
    returnLine: "又转到你这儿了，我先看看哈。",
    scenes: [
      { id: "liangxia-banquet", label: "婚宴帮忙", primary: "wear", secondary: "calm", budget: 500, opening: "从迎宾忙到送客，今天顾不上补妆，得一直稳住。", story: "两边亲戚都得认，座位表得攥在手里。忙起来脸容易热红，也帮我挑个用着舒服的。" },
      { id: "liangxia-pottery", label: "晚间陶艺", primary: "calm", secondary: "light", budget: 330, opening: "陶艺课回来两颊有点红，想先用得舒服，别再厚厚盖着。", story: "杯子又捏歪了，倒是挺像有个把手的小碗。脸有点红，想用得舒服，薄一点就行。" },
    ],
  },
  {
    id: "baijie", name: "白姐", role: "婚礼跟妆师", portrait: "/assets/game/people/baijie.webp",
    primary: "light", secondary: "wear", budget: 300,
    opening: "工具包先搁这儿，我想看看轻薄的底妆。",
    story: "给新娘做妆已经够费工夫了，我自己薄薄一层，忙半天不用补就行。",
    returnLine: "来，再让我看看这几支，今天重新挑。",
    scenes: [
      { id: "baijie-recovery", label: "连场收工", primary: "repair", secondary: "wear", budget: 410, opening: "连续几场早起，自己的脸干得起皮，先挑能修护的。", story: "连着早起赶场，照镜子才发现自己起皮了。修护先顾上，明天开工也想少补妆。" },
      { id: "baijie-museum", label: "母女逛馆", primary: "calm", secondary: "light", budget: 350, opening: "今天陪妈妈逛馆，两颊正泛红，舒服比上镜要紧。", story: "妈妈要慢慢看瓷器，我今天陪逛，不背工具包。两颊泛红先顾好，再挑个轻薄的。" },
    ],
  },
  {
    id: "heqing", name: "何清", role: "爱张罗聚会的年轻白领", portrait: "/assets/game/people/heqing.webp",
    primary: "wear", secondary: "calm", budget: 520,
    opening: "我把大家一天的行程都排满了，妆得从午饭撑到夜景。",
    story: "小满说我比导游还忙，餐厅和路线全归我管。妆得留到拍夜景，跑热了会脸红，也想舒服点。",
    returnLine: "又见面啦，这回让我好好挑挑。",
    scenes: [
      { id: "heqing-market", label: "早市探店", primary: "light", secondary: "wear", budget: 280, opening: "大清早逛摊子，脸上轻轻一层就行，别像去晚宴。", story: "朋友们还没起，我先去抢刚出炉的烧饼。涂得轻薄些，逛到中午妆还在就行。" },
      { id: "heqing-home", label: "周末宅家", primary: "repair", secondary: "calm", budget: 470, opening: "暖气房待久了脸干得起屑，周末不约人，先修护。", story: "这周末不组局了，窝着整理照片，脸上起皮和泛红的地方也该慢慢顾顾了。" },
    ],
  },
  {
    id: "ruanxiaoman", name: "阮小满", role: "说话轻声的手账爱好者", portrait: "/assets/game/people/ruanxiaoman.webp",
    primary: "repair", secondary: "calm", budget: 470,
    opening: "嘴角这里干得起皮……我想先看看修护的。",
    story: "我记在手账里了，等我翻一下……嘴角干，两颊也红。先挑修护的吧，舒缓也想兼顾。",
    returnLine: "你好，我又来了……想问的写在这里了。",
    scenes: [
      { id: "ruanxiaoman-gallery", label: "双人逛展", primary: "light", secondary: "calm", budget: 340, opening: "和何清去看展，我想像平时一样，脸上薄薄的就好。", story: "何清负责拍照，我想慢慢看画旁边的小字。薄薄涂一层就好，脸颊容易红，也想兼顾舒缓。" },
      { id: "ruanxiaoman-reading", label: "读书分享", primary: "wear", secondary: "repair", budget: 410, opening: "轮到我主持一下午的分享，中间不想离席补妆。", story: "发言顺序抄好了，我怕主持时顾不上补妆，嘴角还干，也想兼顾修护。" },
    ],
  },
  {
    id: "caiaiyi", name: "蔡阿姨", role: "舞队里热心张罗的阿姨", portrait: "/assets/game/people/caiaiyi.webp",
    primary: "wear", secondary: "light", budget: 300,
    opening: "排练完还要录一遍动作，别跳到一半妆就散了。",
    story: "群里催着录动作呢，跳完还得看回放。妆别跳一半就散，也别糊太厚。",
    returnLine: "哎，又是你在，我进来瞧瞧。",
    scenes: [
      { id: "caiaiyi-rest", label: "换季休舞", primary: "calm", secondary: "repair", budget: 460, opening: "换季一吹风脸就红，这两天歇舞，先让我舒服些。", story: "歇两天舞，节拍还是我在群里发。风一吹脸就红，还干，先舒服些，也兼顾修护。" },
      { id: "caiaiyi-grandchild", label: "外孙来玩", primary: "light", secondary: "wear", budget: 260, opening: "今天陪外孙玩，脸上越轻越好，不用上台那套。", story: "外孙说教我骑滑板车，我先看看能不能站上去。院里玩半天，涂得轻些、不用老补就成。" },
    ],
  },
  {
    id: "wulaoshi", name: "吴老师", role: "爱记笔记的退休教师", portrait: "/assets/game/people/wulaoshi.webp",
    primary: "calm", secondary: "repair", budget: 480,
    opening: "脸颊最近老泛红，我先看用着舒不舒服，别急着谈妆效。",
    story: "我带了小本子，听明白了就记上。先看舒缓，脸上还有些干，也想顾到修护。",
    returnLine: "又来请教了，等我把本子拿出来。",
    scenes: [
      { id: "wulaoshi-reunion", label: "校友茶会", primary: "wear", secondary: "light", budget: 280, opening: "学生约了午茶又约晚饭，这半天想省下反复补妆的事。", story: "学生们带孩子来见我，午茶还约了晚饭，恐怕有得聊。想自然一点，别弄得太隆重。" },
      { id: "wulaoshi-copybook", label: "冬日抄书", primary: "repair", secondary: "light", budget: 540, opening: "暖气旁抄书，脸干得起皮，想修护，但不想厚厚糊一层。", story: "抄喜欢的散文，一坐就忘了时间，暖气旁边实在干。修护上愿意花点钱，不过还是想涂得轻些。" },
    ],
  },
  {
    id: "guyan", name: "顾言", role: "常替室友跑腿的大学生", portrait: "/assets/game/people/guyan.webp",
    primary: "light", secondary: "wear", budget: 260,
    opening: "我没怎么化过妆，想薄一点，别太明显。",
    story: "上完课要拍社团照，我在备忘录里写好了。自然一点，能撑半天就行，生活费得算着花。",
    returnLine: "又来了，等我解个锁，我记手机里了。",
    scenes: [
      { id: "guyan-cycling", label: "骑车归来", primary: "calm", secondary: "light", budget: 290, opening: "骑车回来两颊泛红，想先舒服一点，轻一些最好。", story: "借室友的车绕了一大圈，脸吹红了。涂着轻一点就行，还得留钱给车换刹车皮。" },
      { id: "guyan-project", label: "通宵赶稿", primary: "repair", secondary: "wear", budget: 330, opening: "在机房赶了几个晚上，脸干得起皮，想先修护修护。", story: "海报终于能送印了，明天还得守答辩展板。先顾起皮，妆能留久点更好。" },
    ],
  },
  {
    id: "jiangning", name: "江宁", role: "准备试镜的大二学生", portrait: "/assets/game/people/jiangning.webp",
    primary: "calm", secondary: "light", budget: 340,
    opening: "晚上试镜，可脸正红着，先挑个舒缓的吧。",
    story: "台词夹在课本里，等会儿路上还能背背。先用得舒服，上镜也想轻薄自然些，饭钱得留着。",
    returnLine: "嗨，又来看看，书包放旁边不挡路吧？",
    scenes: [
      { id: "jiangning-welcome", label: "社团迎新", primary: "wear", secondary: "light", budget: 280, opening: "迎新摊位要守一天，想撑到收摊，不用总跑去补妆。", story: "我负责讲报名流程，怕是比排戏的话还多，妆自然一点就行，别超生活费。" },
      { id: "jiangning-selftape", label: "练习自录", primary: "light", secondary: "calm", budget: 330, opening: "手机贴得近录台词，想看着像自己，越轻薄越好。", story: "宿舍贴块白布就开拍了，手机离得近，想涂薄点。灯开久了脸会红，舒缓也想兼顾。" },
    ],
  },
  {
    id: "suxiao", name: "苏晓", role: "精打细算的考研生", portrait: "/assets/game/people/suxiao.webp",
    primary: "repair", secondary: "wear", budget: 400,
    opening: "购物车挑了半天持妆的，结果脸干得起屑，还是先看修护吧。",
    story: "复习到很晚，睡前还忍不住刷促销。先买需要的修护，能兼顾一天自习的持妆更好，不凑单了。",
    returnLine: "我又来比比看，这回先不翻购物车。",
    scenes: [
      { id: "suxiao-library", label: "图书馆自习", primary: "light", secondary: "wear", budget: 250, opening: "就去图书馆，想像没涂一样轻，别让我总惦记着脸。", story: "约到了靠窗的座位，中午不回来了，妆能撑一阵就行，每周花销我都列着呢。" },
      { id: "suxiao-mock", label: "模考回程", primary: "calm", secondary: "light", budget: 300, opening: "模考教室空调吹得脸泛红，今天先找舒服的，别再刺激。", story: "卷子对完，脑子已经转不动了。先找支预算内能舒缓的，薄薄一层就好，挑完回去睡觉。" },
    ],
  },
  {
    id: "hanlei", name: "韩磊", role: "习惯列清单的公司行政", portrait: "/assets/game/people/hanlei.webp",
    primary: "light", secondary: "calm", budget: 360,
    opening: "想试试轻薄的，看起来别太明显，我不太会挑。",
    story: "平时买东西都列清单，这次就写了轻薄两个字。办公室坐久了脸会红，舒缓也帮我看看。",
    returnLine: "又来了，清单带着，咱们照这个看。",
    scenes: [
      { id: "hanlei-gala", label: "年会控场", primary: "wear", secondary: "calm", budget: 510, opening: "从签到忙到撤场，没空照镜子，这次得撑完整场。", story: "座位图、对讲机、备用电池，都装好了。就怕忙热了脸又红，舒缓也帮我看看。" },
      { id: "hanlei-flight", label: "出差返程", primary: "repair", secondary: "wear", budget: 400, opening: "飞机和酒店都干，脸颊起皮了，先挑能修护的。", story: "报销单还堆在包里，脸已经干得起皮了。先挑修护的，接下来整天接待培训，也得兼顾持妆。" },
    ],
  },
  {
    id: "chendao", name: "陈导", role: "总在看表的带团导游", portrait: "/assets/game/people/chendao.webp",
    primary: "wear", secondary: "calm", budget: 500,
    opening: "团在中庭等我，后面还有半天行程，妆得一直撑着。",
    story: "举着旗子得前后照应几十个人，没空停下来补妆。来回跑容易脸红，也想用得舒服点。",
    returnLine: "又见面了，我先说要什么，咱们挑快一点。",
    scenes: [
      { id: "chendao-mountain", label: "山风归来", primary: "calm", secondary: "light", budget: 330, opening: "山里风吹得脸发红，明天不带团，先让我舒服点。", story: "客人都送上车了，明天不用喊集合，脸上也想涂得轻一点。" },
      { id: "chendao-family", label: "家庭短游", primary: "light", secondary: "wear", budget: 260, opening: "今天不举旗，只陪家里人走走，想涂得轻薄自然些。", story: "孩子非说这次他讲解，行，我跟着走。逛半天，涂得轻薄、妆能留住就成，钱还要留着吃饭。" },
    ],
  },
  {
    id: "lina", name: "李娜", role: "正在求职的年轻人", portrait: "/assets/game/people/lina.webp",
    primary: "light", secondary: "wear", budget: 250,
    opening: "明天面试，想薄一点自然一点，看起来还是我自己。",
    story: "我妈就在这层做保洁，等会儿去找她。面试想涂得自然、妆留久一点，衣服和车费也得留钱。",
    returnLine: "你好，我又过来看看，想再挑一挑。",
    scenes: [
      { id: "lina-jobfair", label: "招聘会走场", primary: "wear", secondary: "light", budget: 280, opening: "招聘会要排好几轮队，想从开馆撑到下午，不用重补。", story: "简历印好了，两个场馆的路线也画好了，涂得轻一点就好，别把路费搭进去。" },
      { id: "lina-shopping", label: "陪妈妈逛街", primary: "calm", secondary: "light", budget: 330, opening: "一路风吹得两颊发红，今天陪妈妈慢慢逛，先求舒服。", story: "妈妈天天在商场干活，倒没怎么逛过橱窗，今天陪她慢慢看。脸吹红了想找个舒服的，也别涂太厚。" },
    ],
  },
  {
    id: "gaoyuan", name: "高远", role: "镜头前有点拘谨的青年", portrait: "/assets/game/people/gaoyuan.webp",
    primary: "light", secondary: "calm", budget: 350,
    opening: "我额头容易出油，不想再糊一层，轻薄自然最要紧。",
    story: "女朋友帮我录求职视频，我对着镜头有点不自在。妆想薄一些，脸也容易红，舒缓的也看看。",
    returnLine: "你好，又来问问，我选这个还是有点拿不准。",
    scenes: [
      { id: "gaoyuan-wedding", label: "朋友婚宴", primary: "wear", secondary: "calm", budget: 500, opening: "替朋友迎宾到晚宴，今天更在意撑得久，别中途掉妆。", story: "朋友让我看签到桌，一来人就得站起来招呼。忙热了脸会红，也得挑个用着舒服的。" },
      { id: "gaoyuan-season", label: "换季干燥", primary: "repair", secondary: "light", budget: 550, opening: "鼻翼这几天干得起皮，想认真修护，但肤感还是要轻。", story: "以前光看额头出油，这回才注意到鼻翼起皮。想认真挑支修护的，贵点可以，但涂着还是要轻。" },
    ],
  },
  {
    id: "ligui", name: "李桂", role: "早班商场保洁", portrait: "/assets/game/people/ligui.webp",
    primary: "repair", secondary: "calm", budget: 380,
    opening: "洗完脸紧得很，脸颊还有点起皮，想挑支认真养护的。",
    story: "早班一赶就忘了抹，女儿总提醒我。家用留好了，想挑支修护的，泛红也顾一顾。",
    returnLine: "又过来了，趁这会儿慢慢挑挑。",
    scenes: [
      { id: "ligui-hometown", label: "返乡赶车", primary: "light", secondary: "wear", budget: 250, opening: "赶早车回老家，脸上轻薄一点就好，不想一路糊着。", story: "点心都装好了，回老家得坐半天车。选支轻薄、能留一阵的，钱还得留着走亲戚。" },
      { id: "ligui-choir", label: "社区合唱", primary: "calm", secondary: "light", budget: 330, opening: "排练屋里一热脸就红，先让我舒服些，妆不用厚。", story: "我站女低音那排，熟悉的歌一响就想跟着唱，脸上薄薄涂一点就好。" },
    ],
  },
  {
    id: "laokang", name: "老康", role: "商场门口的保安", portrait: "/assets/game/people/laokang.webp",
    primary: "repair", secondary: "wear", budget: 400,
    opening: "门口风吹得脸起皮，想先把干燥养好，不能老搁着。",
    story: "对讲机换电池记得牢，擦脸这事老忘。先找支修护的，站一天岗也想让妆留得住。",
    returnLine: "又来看看，还是得麻烦你帮着挑。",
    scenes: [
      { id: "laokang-badge", label: "工牌换照", primary: "light", secondary: "wear", budget: 260, opening: "要换工牌照片，想自然点，薄薄一层，别不像本人。", story: "领口熨好了，这张工牌照可得挂挺久，拍完回岗也不想再补妆。" },
      { id: "laokang-fishing", label: "休班钓鱼", primary: "calm", secondary: "repair", budget: 460, opening: "休班去钓鱼，风吹回来两颊红红的，先找舒服的。", story: "坐了一早上，鱼没几条，风倒吹够了。脸红着先顾舒缓，还有点干，也想兼顾修护。" },
    ],
  },
];

export const PERKS: Perk[] = [
  { id: "patient", name: "慢慢说", category: "洞察", icon: "◷", description: "每单最大耐心 +1，下次接待起生效。" },
  { id: "double-question", name: "问到点上", category: "洞察", icon: "◎", description: "一次问需求揭示两条未知需求，仍只消耗 1 耐心。" },
  { id: "sample-kit", name: "随身样包", category: "洞察", icon: "◇", description: "获得时小样 +2；此后每日补给额外 +2（持有上限 12）。" },
  { id: "trial-expert", name: "试得明白", category: "洞察", icon: "◈", description: "报价产品已经试用时，匹配说服分额外 +1（基础试用 +1）。" },
  { id: "warm-return", name: "记得你", category: "客情", icon: "↩", description: "本局真实熟客回访成交，净收益奖金 +40。" },
  { id: "deep-listen", name: "听懂弦外音", category: "客情", icon: "♡", description: "倾听后的匹配说服分额外 +1（基础倾听 +1），仍不能越过预算。" },
  { id: "care-bonus", name: "用心服务", category: "客情", icon: "✦", description: "倾听后成交，获得服务奖金 +25 净收益。" },
  { id: "good-name", name: "有口皆碑", category: "客情", icon: "☆", description: "每次成交额外恢复 1 信誉，上限 7。" },
  { id: "full-price", name: "价值成交", category: "成交", icon: "¥", description: "不打折成交，获得原价奖金 +30 净收益。" },
  { id: "perfect-fit", name: "天作之合", category: "成交", icon: "✓", description: "产品原始匹配分达到 8/9 时成交，净收益奖金 +35。" },
  { id: "budget-room", name: "说清价值", category: "成交", icon: "＋", description: "先问明预算，顾客才愿意在真实预算上最多加 30；不改变公开预算区间。" },
  { id: "second-wind", name: "重整样箱", category: "成交", icon: "↗", description: "失败或主动送客时补回 3 小样（通常为 1），上限 12；信誉仍扣 1。" },
];

export const STYLES: Style[] = [
  { id: "reader", name: "观察派", description: "少问一句，留一步验证。起始能力：问到点上。", perk: "double-question", icon: "◎" },
  { id: "friend", name: "熟客派", description: "第一单种关系，下一次赚回头。起始能力：记得你。", perk: "warm-return", icon: "♡" },
  { id: "closer", name: "成交派", description: "证明值这个价，不靠乱打折。起始能力：价值成交。", perk: "full-price", icon: "¥" },
];

export const LEAGUES: League[] = [
  { id: 0, name: "街角新柜", rival: "隔壁小柜", subtitle: "学会挑人，也学会放手", rule: "标准 3 耐心。所有联赛产品的首要需求能力须至少为 1，试用和倾听不能替代完全缺失的商品能力。匹配说服分须达需求强度×2+2；预算不过线。对手自有客源每天基础净收益=220+天数×20+级别×15，未选与失败机会另计。7 天净收益严格超过对手且信誉大于 0 才赢。", color: "#b6d6bd" },
  { id: 1, name: "折扣街区", rival: "折扣王阿梁", subtitle: "价格战里证明你的价值", rule: "除标准规则外，须打折至少 10%，或让顾客试用最终报价的产品，证明它的价值。", color: "#dbc188" },
  { id: 2, name: "挑剔商圈", rival: "选品师林姐", subtitle: "合适不能只是差不多", rule: "匹配说服分门槛比标准高 1；耐心仍为 3。不强制折扣。", color: "#bdb2d8" },
  { id: 3, name: "快节奏旗舰", rival: "快手陈店", subtitle: "两句话里做出判断", rule: "每单基础耐心从 3 降为 2；匹配按标准，不强制折扣。", color: "#e3ae9e" },
  { id: 4, name: "最后一单", rival: "全能店长", subtitle: "懂人、懂货、还得赚得到", rule: "基础耐心 2、匹配门槛 +1，并须至少九折或试用最终报价产品。对手基础净收益随联赛与天数提高。", color: "#d9b67d" },
];
