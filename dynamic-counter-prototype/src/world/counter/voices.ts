import type { Trait } from "./types.ts";

type TrialResult = "missing" | "weak" | "enough";
type VoiceStyle = {
  need: Record<Trait, readonly [primary: string, secondary: string]>;
  trial: Record<TrialResult, string>;
  lost: { budget: string; fit: string; proof: string; undecided: string };
};

// 只存说话口气，不存顾客需求、场景或预算。每句需求只谈调用方揭示的那一项。
const STYLES = {
  direct: {
    need: {
      light: ["先看轻薄的，脸上别有负担。", "另外，轻薄些更好。"],
      wear: ["持妆最要紧，我不想总补。", "能兼顾持妆就更省事。"],
      calm: ["先选舒缓的，用着舒服最要紧。", "舒缓也帮我顾一下。"],
      repair: ["先看修护，这个排前面。", "再兼顾一下修护吧。"],
    },
    trial: { missing: "这支还是不行，我最在意的地方没顾上。", weak: "这一点有点意思了，还差一点。", enough: "嗯，这一点我觉得可以。" },
    lost: { budget: "超出预算了，这单先不买。", fit: "这支不合适，先不买了。", proof: "至少九折，或者试过这支再定；现在先不买。", undecided: "这次先不买了，我再想想。" },
  },
  warm: {
    need: {
      light: ["我就想要轻薄的，涂着没负担多好。", "要是还能轻薄点，就更好了。"],
      wear: ["持妆得好些，省得老拿镜子出来。", "也帮我看看持妆，省点事。"],
      calm: ["我先挑舒缓的，自己用着得舒服呀。", "舒缓也想顾着，你帮我看看。"],
      repair: ["这回先挑修护的，慢慢养护嘛。", "顺便也顾顾修护，好不好？"],
    },
    trial: { missing: "这支不成呀，我最要紧的那点没顾上。", weak: "这点有是有，还差点意思呢。", enough: "嗯，这点够用了，这样就好。" },
    lost: { budget: "这价超过预算啦，今天先不拿。", fit: "这支不合适我，咱们就别勉强了。", proof: "打到九折，或者让我试过这支再说吧；眼下先不拿。", undecided: "我还没定主意，今天先不拿啦。" },
  },
  tentative: {
    need: {
      light: ["我最想要轻薄的，涂着自然一点。", "还有，能轻薄一点就更好了。"],
      wear: ["我主要想要持妆，不用总补的那种。", "如果还能兼顾持妆，也挺好的。"],
      calm: ["我想先看舒缓的，用着舒服一点。", "另外也想兼顾舒缓，可以吗？"],
      repair: ["我现在主要想找修护的。", "修护也想要，不过先顾刚才那项。"],
    },
    trial: { missing: "这支还是不太行，我最想要的那点没有。", weak: "有一点我想要的意思了，不过还差些。", enough: "嗯，刚才说的这点，我觉得够了。" },
    lost: { budget: "这个价超预算了，我还是先不买。", fit: "这支不太合适我，我再看看吧。", proof: "至少九折，或者让我试过这支，我才好决定；现在先不买。", undecided: "我想再考虑一下，先不买了。" },
  },
  relaxed: {
    need: {
      light: ["轻薄最要紧，别让我老惦记脸上涂了东西。", "再轻薄些就好了，涂着自在。"],
      wear: ["先挑持妆的吧，我懒得反复补。", "持妆也顾上就更省心了。"],
      calm: ["先看舒缓吧，用着舒服点。", "舒缓也想兼顾一下，不急，你帮我看看。"],
      repair: ["想先挑支修护的，慢慢养护。", "要是还能兼顾修护，也不错。"],
    },
    trial: { missing: "这支还是算了，最在意的地方没顾上。", weak: "有点那个意思了，还差那么一点。", enough: "行，这一点可以，我没意见。" },
    lost: { budget: "超过预算了，先放回去吧。", fit: "这支不合适，就先算啦。", proof: "九折或者试过这支，我才好定；这次先放放吧。", undecided: "还没想定，今天先逛到这儿吧。" },
  },
  precise: {
    need: {
      light: ["先看轻薄，肤感别厚重。", "其次也要轻薄，别忽略了。"],
      wear: ["重点是持妆，别需要反复补。", "再看一下持妆，能兼顾更好。"],
      calm: ["舒缓优先，我先看这一项。", "舒缓也要考虑，不过排在后面。"],
      repair: ["修护优先，先按这个挑。", "其次看修护，能兼顾最好。"],
    },
    trial: { missing: "这支不行，最要紧的地方没做到。", weak: "这点有了，但还不够。", enough: "这一点行，够了。" },
    lost: { budget: "价格超过预算，不拿了。", fit: "这支不符合我的要求，不拿了。", proof: "九折或试用这支，至少得有一项；这次先不买。", undecided: "还没决定，这次不拿。" },
  },
  lively: {
    need: {
      light: ["我要轻薄的！涂着没负担才好。", "对了，轻薄也想要，能兼顾吗？"],
      wear: ["持妆排第一，我可不想一直补。", "再带点持妆就更省心啦。"],
      calm: ["先看舒缓的吧，用着舒服最重要。", "舒缓也加上考虑呗，能兼顾更好。"],
      repair: ["先挑修护的，这次就认准这个了。", "修护也想兼顾，帮我看看呗。"],
    },
    trial: { missing: "啊，我最想要的那点，这支没有呀。", weak: "有点那个意思了！不过这点还差些。", enough: "嗯，这点可以！就是这个意思。" },
    lost: { budget: "超预算啦，我先忍住，不买了。", fit: "这支没选对，不太适合我，先不拿啦。", proof: "给到九折，或者让我试过这支再说呗；现在先不买。", undecided: "我还想再逛逛，这次先不拿啦。" },
  },
  gentle: {
    need: {
      light: ["嗯……我最在意轻薄，想涂得自然些。", "还有一点，轻薄也想顾到。"],
      wear: ["我最想要的是持妆，不用总去补。", "另外，持妆也帮我看看吧。"],
      calm: ["先看舒缓的吧，我最在意用着舒服。", "舒缓也想要……能兼顾就好了。"],
      repair: ["修护吧，我想先顾好这一项。", "再考虑一下修护，可以吗？"],
    },
    trial: { missing: "嗯……我最在意的那点，这支还是顾不上。", weak: "这一点有些接近了……还是差一点。", enough: "嗯……这一点，我觉得可以了。" },
    lost: { budget: "这个价超过预算了……我先不买吧。", fit: "这支还是不太合适，我先不拿了。", proof: "能九折，或者试过这支，我才好决定……这次先不买。", undecided: "让我再想想吧，这次先不买。" },
  },
  measured: {
    need: {
      light: ["轻薄放第一，别涂得厚重。", "再一项是轻薄，能顾到更好。"],
      wear: ["先看持妆，少补几次就省事。", "也想兼顾持妆，排在后面看。"],
      calm: ["舒缓先顾好，用着舒服要紧。", "舒缓也记上一项，能兼顾就好。"],
      repair: ["修护放在前头，我先挑这个。", "修护也得看看，不过先顾前一项。"],
    },
    trial: { missing: "最要紧的那点没顾上，这支不行。", weak: "这点有是有，还欠一点。", enough: "这点够了，我看可以。" },
    lost: { budget: "超了预算，就不买了，按算好的来。", fit: "这支不合适，不能勉强，就不拿了。", proof: "至少九折，或者试过这支再考虑；眼下不买。", undecided: "还得想想，这回先不买。" },
  },
} satisfies Record<string, VoiceStyle>;

type CustomerVoice = {
  style: keyof typeof STYLES;
  budget: (amount: number) => string;
  sold: (product: string) => string;
  leave: string;
};

const VOICES: Record<string, CustomerVoice> = {
  shen: {
    style: "direct", budget: (n) => `我先按${n}元挑，你帮我看看。`,
    sold: (p) => `行，就${p}，帮我装好吧。`, leave: "行，那我先走，你忙。",
  },
  mei: {
    style: "warm", budget: (n) => `我想着花${n}元，先照这个数看看吧。`,
    sold: (p) => `好，${p}拿一支，我选好了。`, leave: "没事，我再转转，你招呼别人吧。",
  },
  zhou: {
    style: "direct", budget: (n) => `这次预算先按${n}元，看看能选到什么。`,
    sold: (p) => `定了，${p}，结账吧。`, leave: "好，今天先到这儿，谢谢。",
  },
  xiaoyu: {
    style: "tentative", budget: (n) => `我算了一下，这次打算花${n}元。`,
    sold: (p) => `那我要${p}，选好了就不纠结啦。`, leave: "好，那我先看看，谢谢你呀。",
  },
  anjie: {
    style: "relaxed", budget: (n) => `${n}元吧，先慢慢看看。`,
    sold: (p) => `嗯，${p}就好，麻烦帮我拿一支。`, leave: "好，慢慢挑也没关系，我先走啦。",
  },
  duan: {
    style: "precise", budget: (n) => `这支我先留了${n}元，按这个挑吧。`,
    sold: (p) => `${p}，就它了，不来回看了。`, leave: "行，这次先不挑了。",
  },
  zhao: {
    style: "warm", budget: (n) => `我准备花${n}元，先看看合适的。`,
    sold: (p) => `好呀，就拿${p}，谢谢。`, leave: "好，那今天先这样，你忙吧。",
  },
  miduo: {
    style: "lively", budget: (n) => `我想先花${n}元，挑个合适的。`,
    sold: (p) => `选定了，${p}！在哪儿结账？`, leave: "好呀，那我再去转转。",
  },
  tangtang: {
    style: "lively", budget: (n) => `我先拿${n}元来挑，可别让我看花眼了。`,
    sold: (p) => `好，就${p}了，我不翻来翻去选了。`, leave: "行，那先不挑啦，拜拜。",
  },
  liangxia: {
    style: "relaxed", budget: (n) => `先照${n}元挑吧，我不想来回算了。`,
    sold: (p) => `行，${p}，总算选完一件了。`, leave: "好，先逛到这儿，我撤啦。",
  },
  baijie: {
    style: "precise", budget: (n) => `先看${n}元这个价位的，挑起来快些。`,
    sold: (p) => `拿${p}吧，就这一支。`, leave: "好，今天先不拿，你接着忙。",
  },
  heqing: {
    style: "lively", budget: (n) => `我盘算的是${n}元，来，先照这个挑。`,
    sold: (p) => `好嘞，${p}定了，结账！`, leave: "行，那我接着逛啦。",
  },
  ruanxiaoman: {
    style: "gentle", budget: (n) => `我写的是${n}元……先按这个看看吧。`,
    sold: (p) => `嗯，我选${p}，帮我包起来吧。`, leave: "嗯，那我先走了，谢谢。",
  },
  caiaiyi: {
    style: "warm", budget: (n) => `我先想着${n}元，你给参谋参谋。`,
    sold: (p) => `成，${p}给我拿上，我定了。`, leave: "成，那我走啦，不用送。",
  },
  wulaoshi: {
    style: "measured", budget: (n) => `本子上记了${n}元，咱们先照这个看。`,
    sold: (p) => `好，我选${p}，就按这个结吧。`, leave: "好的，今天先看到这里，谢谢。",
  },
  guyan: {
    style: "tentative", budget: (n) => `我手机里算的是${n}元，先这么挑吧。`,
    sold: (p) => `那就${p}吧，我这就付款。`, leave: "好，那我先走了，不打扰啦。",
  },
  jiangning: {
    style: "lively", budget: (n) => `${n}元吧，我这次先这么打算。`,
    sold: (p) => `就${p}吧，这下不用挑花眼了。`, leave: "好，今天先看到这儿啦。",
  },
  suxiao: {
    style: "measured", budget: (n) => `我算过了，先按${n}元来挑。`,
    sold: (p) => `${p}就好，这次不再来回比了。`, leave: "好，我先不买了，回去再算算。",
  },
  hanlei: {
    style: "precise", budget: (n) => `清单上暂定${n}元，先按这个找。`,
    sold: (p) => `好，${p}，这一项可以打勾了。`, leave: "好，这一项先放放，麻烦了。",
  },
  chendao: {
    style: "direct", budget: (n) => `先按${n}元找，帮我挑快一点。`,
    sold: (p) => `行，${p}给我包上，结账吧。`, leave: "行，那我先走一步。",
  },
  lina: {
    style: "tentative", budget: (n) => `这次我打算花${n}元，先看看吧。`,
    sold: (p) => `选${p}吧，嗯，就定这个了。`, leave: "好，那今天先不买了，谢谢。",
  },
  gaoyuan: {
    style: "gentle", budget: (n) => `嗯……我先按${n}元挑，可以吗？`,
    sold: (p) => `那我就要${p}了，在哪里付钱？`, leave: "嗯，好，那我先走了。",
  },
  ligui: {
    style: "warm", budget: (n) => `我给这支留了${n}元，先挑挑看。`,
    sold: (p) => `成，${p}我拿了，谢谢你啊。`, leave: "好，没事，那我先走。",
  },
  laokang: {
    style: "measured", budget: (n) => `先照${n}元挑，找个实在的。`,
    sold: (p) => `行，就${p}了，给我装上。`, leave: "成，先不挑了，你忙你的。",
  },
};

const FALLBACK: CustomerVoice = {
  style: "direct", budget: (n) => `预算先按${n}元，看看合适的吧。`,
  sold: (p) => `就选${p}吧，谢谢。`, leave: "好，那今天先不买了，谢谢。",
};
const voiceOf = (customerId: string): CustomerVoice => Object.hasOwn(VOICES, customerId) ? VOICES[customerId]! : FALLBACK;

export function needReply(customerId: string, trait: Trait, secondary: boolean): string {
  return STYLES[voiceOf(customerId).style].need[trait][secondary ? 1 : 0];
}

export function budgetReply(customerId: string, budget: number): string {
  return voiceOf(customerId).budget(budget);
}

export function trialReply(customerId: string, result: "missing" | "weak" | "enough"): string {
  return STYLES[voiceOf(customerId).style].trial[result];
}

export function receiptReply(input: {
  customerId: string;
  outcome: "sold" | "lost" | "leave";
  productName: string | null;
  discount: number;
  returning: boolean;
  fitOK: boolean;
  budgetOK: boolean;
  proofOK: boolean;
}): string {
  const voice = voiceOf(input.customerId);
  // 回访不等于买过，折扣不等于试过；不据此补写购买、试用或关系回忆。
  if (input.outcome === "leave") return voice.leave;
  if (input.outcome === "sold") return voice.sold(input.productName ?? "这支");
  const lost = STYLES[voice.style].lost;
  if (!input.budgetOK) return lost.budget;
  if (!input.fitOK) return lost.fit;
  if (!input.proofOK) return lost.proof;
  return lost.undecided;
}
