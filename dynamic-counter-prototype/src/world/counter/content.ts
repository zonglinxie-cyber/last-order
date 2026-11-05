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


export const CUSTOMERS: Customer[] = [
  { id: "shen", name: "沈姐", role: "赶早班的护士长", portrait: "/assets/game/customer-shen-consultation.webp", primary: "wear", secondary: "light", budget: 280, opening: "交班前没空补妆，口罩也要一直戴。", story: "女儿今晚第一次上台，我下班就赶过去。不是怕老，是想在合照里精神一点。", returnLine: "上回赶上了女儿的演出。今天换个班次，再帮我看看。" },
  { id: "mei", name: "梅姨", role: "晨练队领队", portrait: "/assets/game/customer-mei-consultation.webp", primary: "calm", secondary: "repair", budget: 460, opening: "风一吹脸就泛红，今天不想再受刺激。", story: "队里人都跟着我买东西，我宁可慢点，也不想推荐错了让人难受。", returnLine: "上次你没催我，我记得。今天是给自己认真挑的。" },
  { id: "zhou", name: "周姐", role: "出差中的培训师", portrait: "/assets/game/customer-zhou-consultation.webp", primary: "wear", secondary: "repair", budget: 410, opening: "要连讲两场课，中间只有十分钟。", story: "我从后台转到台前才三个月。学生记住我的课就行，别记住我脸上的疲惫。", returnLine: "那场课顺利结束了，这次有新的出差安排。" },
  { id: "xiaoyu", name: "小雨", role: "实习生", portrait: "/assets/game/customer-xiaoyu-consultation.webp", primary: "light", secondary: "wear", budget: 250, opening: "第一次正式开会，想自然一点，别像戴着面具。", story: "第一份工资还没发，预算是算过的。让我买得明白，比夸我好看有用。", returnLine: "现在已经敢在会上发言了。今天想换个使用场景。" },
  { id: "anjie", name: "安姐", role: "社区书店主理人", portrait: "/assets/game/customer-anjie-consultation.webp", primary: "calm", secondary: "light", budget: 340, opening: "搬书落了一脸灰，现在有点刺，先求舒服。", story: "晚上办读书会，来的都是老街坊。我希望店开得久一点，不求热闹一阵。", returnLine: "读书会又多了两个人。你上次愿意听我说，我也愿意再来。" },
  { id: "duan", name: "段小姐", role: "夜班摄影师", portrait: "/assets/game/customer-duan-consultation.webp", primary: "repair", secondary: "wear", budget: 420, opening: "连熬三个夜，脸干得起皮，得先养回来。", story: "镜头总对着别人，轮到自己的工作照却拖了两年。这回终于轮到我了。", returnLine: "工作照拍了，这次不熬夜也想认真照顾自己。" },
  { id: "zhao", name: "赵老师", role: "户外研学老师", portrait: "/assets/game/customer-zhao-consultation.webp", primary: "wear", secondary: "calm", budget: 510, opening: "一整天带孩子在外面跑，得撑到放学。", story: "孩子会注意到老师每个变化。我想让他们知道，大人也可以照顾好自己。", returnLine: "孩子们说我有精神了。新一周天气变了，需求也变了。" },
  { id: "miduo", name: "米朵", role: "独立舞者", portrait: "/assets/game/people/miduo.webp", primary: "light", secondary: "repair", budget: 600, opening: "排练时不想有负担，脸上越轻越好。", story: "小剧场只卖出了半场票，但我还是想把这支舞跳好。钱要花在确实适合的地方。", returnLine: "那场演出有观众等到谢幕。今天不是上台，是给生活挑的。" },
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
