import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMERS, fallbackReply, INITIAL, QUESTIONS, TRAIT_LABELS, askService, resolveAsk,
  observeService, startService, typedQuestionIndex,
  type CustomerId, type Trait,
} from "../src/campaign.ts";

// P45：认不出她在说哪件事时那句"白问"台词，以前十个人共用系统的一句话。P44 补上落点之后这条更扎眼 ——
// 探针里 36 条真实话术有 6 条（17%）走到这里，全柜念的是同一句。这里把十句原话写死，
// 好让「两个人的台词互换」「退回共用那句」这两种改动能红（读同一个生成器是自证的）。
const DEFLECTION_TRUTH: Record<CustomerId, string> = {
  shen: "这句不在我要问的里面。你要是只会念话术，我去对面。",
  mei: "我表上只剩几分钟了，这句先跳过。",
  xiaoyu: "我没说过要这个。我今天的钱不往这儿花。",
  zhao: "这话你该去问我女儿，我说不来这些。",
  anjie: "今天这事不能靠猜。你先把我的话听完。",
  returning: "团队在等我有凭据的答复，这句不算。",
  zhou: "我是对比来的，这句回答不了我。",
  duan: "我就是来看看，你别绕我。",
  zhou2: "这回不是我自用，你别按我这张脸说。",
  anjie2: "今晚这张脸不能试错。这话我不接。",
};

// 十个人都认不出的一句玩家话 —— 用来反复量"白问那句到底是谁说的"。
const WHITE = "外面在下雨";

// P44：「问到她在意的事」只剩一个来源 —— 她预设里真有一条对得上的问题。
// 以前这里另有一套 NEED_HINTS 宽松判定，认不出落点也照样算"问对了"。
test("need-focused questions count as useful", () => {
  assert.equal(resolveAsk("shen", "你最怕镜头看到粉感吗").useful, true);
  assert.equal(resolveAsk("anjie", "婚礼前这两天泛红怎么办").useful, true);
  assert.equal(resolveAsk("shen", "要不要直接上看最贵的套组").useful, false);
});

test("fallback replies stay in character", () => {
  assert.match(fallbackReply("shen", "你最怕镜头看到什么？", 0), /粉感|没化妆/);
  // P43：她防备的是"推套装"这件事，那就答她自己那句，不再拿一句通用骂人话盖住所有人。
  assert.equal(fallbackReply("shen", "直接开套组吧", null), QUESTIONS.shen[2].response);
  // P45：她防备的是"念话术"这件事，白问那句也是她自己那句，不再是全柜共用的一句。
  assert.equal(fallbackReply("shen", "随便看看就好", null), DEFLECTION_TRUTH.shen);
});

// 玩家打字问的是"她在意的那件事"，不是按钮上那几个字。旧口径探针量到 32 条真实话术只有 13 条
// （41%）落在她当时被问的那条诉求上，并且六个人各有一条诉求只有点预设按钮才问得到。
// 这里钉的是反过来那一条：她答得出的每个维度，都要有一句话术打得到。
const TYPED: Array<[CustomerId, string, Trait]> = [
  ["shen", "上镜会不会显得假？", "natural"],
  // P52：鼻翼线索已经露「出油/闷」，这句话原来落空白格；现在有一条真问题接得住。
  ["shen", "会不会闷痘，我怕爆痘", "steady"],
  // P52：婚礼那天「会不会出错」就是她那处线索念的安全感。
  ["anjie", "婚礼当天会不会出错", "steady"],
  // P52：她说过「我要能稳定复现」，原样问回来要落在一条真问题上，不算白问。
  ["returning", "能不能照昨天一模一样复现", "wear"],
  ["mei", "我这种一到下午脸就绷，能用吗？", "soothe"],
  ["mei", "脸上有痘，用这个会不会闷出来更多？", "steady"],
  ["xiaoyu", "能不能遮一下痘印", "correct"],
  ["xiaoyu", "会不会闷痘，我最近爆痘", "steady"],
  ["zhao", "她皮肤容易泛红，这个能缓吗？", "soothe"],
  ["anjie", "这两天脸发红，先养还是先化？", "soothe"],
  ["returning", "直播近看会不会浮粉？", "natural"],
  ["zhou", "能撑一整天不花吗？", "wear"],
  ["zhou", "两颊会紧，T区又出油，怎么办", "steady"],
  ["duan", "我室友容易闷痘，她能用吗", "steady"],
  ["duan", "送人的话她会不会嫌假", "natural"],
  ["zhou2", "她皮肤一用就红，这个稳吗", "steady"],
  ["zhou2", "她想问这个能不能修护", "soothe"],
  ["anjie2", "从早撑到敬酒会不会花？", "wear"],
  ["anjie2", "闪光灯底下看得出来吗", "correct"],
];

test("打字问到哪一条诉求，就答那一条、露出那一条", () => {
  for (const [id, text, trait] of TYPED) {
    const index = typedQuestionIndex(id, text);
    assert.notEqual(index, null, `${CUSTOMERS[id].name} 的「${text}」应该认得出在问哪件事`);
    const question = QUESTIONS[id][index!];
    assert.ok(question.reveals.includes(trait),
      `${CUSTOMERS[id].name} 「${text}」问到的是${TRAIT_LABELS[trait]}，落点却是「${question.label}」`);
    assert.equal(resolveAsk(id, text).useful, true, `${CUSTOMERS[id].name} 被问到自己在意的事，不该算白问`);
    assert.equal(fallbackReply(id, text, null), question.response,
      `${CUSTOMERS[id].name} 「${text}」的回答要和落点那条问题是同一句`);
  }
});

test("十个人身上，她答得出的维度没有一条是只能点按钮才问得到的", () => {
  for (const id of Object.keys(QUESTIONS) as CustomerId[]) {
    const answerable = new Set(QUESTIONS[id].flatMap(question => question.reveals));
    const typed = new Set(TYPED.filter(entry => entry[0] === id).flatMap(([, text]) => {
      const index = typedQuestionIndex(id, text);
      return index === null ? [] : QUESTIONS[id][index].reveals;
    }));
    for (const trait of answerable) {
      assert.ok(typed.has(trait), `${CUSTOMERS[id].name} 的「${TRAIT_LABELS[trait]}」打字问不到，只能按按钮`);
    }
  }
});

// 她没准备过的那件事不能被"认出来"：宁可她说没接上话，也不能拿另一条不相干的答案冒充她答了。
// P52 之后「会不会闷痘」「能立刻见效」都落到一条准备好的问题：沈薇的闷痘问得到（鼻翼那处线索本来就露它）；
// 「立刻见效」「遮瑕力」落在一条什么都不露的拒答上 —— 话接得住，但留着没说的那条诉求不在问题里给出去。
test("她答不出的维度不冒充答案，价格与推销各回她自己那句", () => {
  assert.equal(typedQuestionIndex("shen", "会不会闷痘？"), 3);
  assert.equal(resolveAsk("shen", "会不会闷痘？").useful, true);
  assert.deepEqual(QUESTIONS.shen[3].reveals, ["steady"]);
  assert.equal(typedQuestionIndex("shen", "能遮住痘印吗"), 4);
  assert.equal(resolveAsk("shen", "能遮住痘印吗").useful, false, "接得住不等于问对：那条诉求她留着没说");
  assert.equal(QUESTIONS.shen[4].reveals.length, 0);
  assert.equal(fallbackReply("shen", "能遮住痘印吗", null), QUESTIONS.shen[4].response);
  assert.equal(typedQuestionIndex("anjie", "能立刻看得出效果吗"), 4);
  assert.equal(resolveAsk("anjie", "能立刻看得出效果吗").useful, false);
  assert.equal(QUESTIONS.anjie[4].reveals.length, 0);
  // 梅女士没有「自然」那条诉求：「厚不厚」落在她自己那句拒答上，不凭空多露一条。
  assert.equal(typedQuestionIndex("mei", "涂上去会不会太厚"), 3);
  assert.equal(resolveAsk("mei", "涂上去会不会太厚").useful, false);
  assert.equal(QUESTIONS.mei[3].reveals.length, 0);
  assert.equal(fallbackReply("mei", "厚不厚", null), QUESTIONS.mei[3].response);
  // 她还是有一句"没接住"的话：真认不出来的仍然落空白格、念她自己的挡回。
  assert.equal(typedQuestionIndex("shen", "今天商场人真多"), null);
  assert.equal(fallbackReply("shen", "外面在下雨", null), DEFLECTION_TRUTH.shen);
  assert.equal(typedQuestionIndex("mei", "预算能到两千吗？"), 1);
  assert.equal(resolveAsk("mei", "预算能到两千吗？").useful, false);
  assert.equal(typedQuestionIndex("zhou", "要不要直接上套组？"), 1);
  assert.equal(fallbackReply("zhou", "要不要直接上套组？", null), QUESTIONS.zhou[1].response);
  assert.equal(typedQuestionIndex("shen", ""), null);
  assert.equal(resolveAsk("shen", "   ").useful, false);
  // 她没准备过的那件事不露新诉求，但话要接得住：她那句「我今天不是来养皮肤的」就是为这句话准备的。
  const refusal = resolveAsk("anjie2", "今天要先养皮肤吗");
  assert.equal(typedQuestionIndex("anjie2", "今天要先养皮肤吗"), 2);
  assert.equal(QUESTIONS.anjie2[refusal.index].reveals.length, 0, "接得住不等于多给信息");
  assert.equal(refusal.useful, false);
  assert.equal(refusal.reply, QUESTIONS.anjie2[2].response);
});

// 手机版曾在组件里自己排过一次「有用那条排第 0 格」，于是「用自己的话问出第二条诉求」只在沙盘成立。
// 落点、露出、她答哪一句必须由 resolveAsk 一处给出：按按钮和把按钮那句原样打进来要落在同一条。
test("点按钮与打字走同一个落点，两个 UI 才有同一个答案", () => {
  for (const id of Object.keys(QUESTIONS) as CustomerId[]) {
    QUESTIONS[id].forEach((question, index) => {
      const chip = resolveAsk(id, "随便说点什么不相干的话", index);
      assert.deepEqual([chip.index, chip.useful, chip.reply], [index, question.useful, question.response],
        `${CUSTOMERS[id].name} 按第 ${index + 1} 个按钮应该拿她自己那句`);
      const typed = resolveAsk(id, question.label);
      assert.deepEqual([typed.index, typed.useful, typed.reply], [index, question.useful, question.response],
        `${CUSTOMERS[id].name} 把第 ${index + 1} 条问题原样打进来，落点不能跑到别处`);
    });
  }
});

// askService 里那一步要真的把打字问到的那条露出来，而不是只换一句台词。
test("打字问到的那条诉求会进 revealed，按按钮也一样", () => {
  const started = askService(observeService(observeService(startService(INITIAL, "mei"), "cheek"), "eyes"), "先寒暄两句", 0);
  const base = started.activeSession!.revealed;
  const typed = askService(started, "脸上有痘，用这个会不会闷出来更多");
  assert.ok(typed.activeSession!.revealed.includes("steady"), "打字问到闷痘，应该露出低风险这一条");
  const chip = askService(started, QUESTIONS.mei[2].label, 2);
  assert.deepEqual(typed.activeSession!.revealed, chip.activeSession!.revealed, "同一件事，两种问法露出的应该一样");
  assert.equal(typed.activeSession!.chat.at(-1)?.text, chip.activeSession!.chat.at(-1)?.text, "两种问法她答的也是同一句");
  assert.ok(base.length < typed.activeSession!.revealed.length);
});

// P44：她自己说出口的那些字就是她的词表。探针把 67 条"她答出来的短语"原样问回去，改之前只有 19 条落回那一格，
// 8 条落点算错却拿到了最重那条答案，31 条撞上十个人共用的一句。这里钉两条：认得出来必须落回说这句话的那一条，
// 认不出来一条诉求都不许露。
const clausesOf = (text: string) => text.split(/[，。？！、；：]/).map(part => part.trim()).filter(part => part.length >= 4 && part.length <= 14);

test("她答出来的短语问回来，认得出来就落回说这句话的那一格", () => {
  let recognised = 0;
  for (const id of Object.keys(QUESTIONS) as CustomerId[]) {
    QUESTIONS[id].forEach((question, source) => {
      for (const clause of clausesOf(question.response)) {
        const index = typedQuestionIndex(id, `${clause}吗？`);
        if (index === null) continue;
        recognised += 1;
        assert.equal(index, source,
          `${CUSTOMERS[id].name} 的「${clause}」出自第${source + 1}格，问回来却落在第${index + 1}格「${QUESTIONS[id][index].label}」`);
      }
    });
  }
  assert.ok(recognised >= 60, `她自己说出口的话应该几乎全都问得回来，本轮只认出 ${recognised} 条`);
});

// 这些词都出现在她自己的台词里，改之前没有一个问得回去（周姐的「暗沉」在 P43 记待办里就是"只能按按钮"那一条）。
const HER_OWN_WORDS: Array<[CustomerId, string, number]> = [
  ["shen", "会不会像没化妆", 0],
  ["mei", "脸没精神要紧吗", 0],
  ["mei", "会不会越厚越显累", 2],
  ["xiaoyu", "也不想面试前爆更多", 0],
  ["xiaoyu", "不想像换了张脸", 2],
  ["zhou", "下午暗沉斑驳怎么办", 0],
  ["zhou2", "我自己还想确认会不会暗沉", 0],
  ["returning", "今天能不能稳定复现", 0],
  ["duan", "别推荐我都不敢用的", 2],
  ["anjie2", "敬完酒之前脸要完整", 0],
];

test("她自己用过的那些词，问回去认得出来且落在同一格", () => {
  for (const [id, text, source] of HER_OWN_WORDS) {
    const index = typedQuestionIndex(id, text);
    assert.equal(index, source, `${CUSTOMERS[id].name} 「${text}」要落回第${source + 1}格「${QUESTIONS[id][source].label}」`);
    assert.equal(resolveAsk(id, text).reply, QUESTIONS[id][source].response, "落点和她答的那句必须是同一格");
  }
});

// 白问的代价按问偏算：以前这里有一条"认不出落点也算问到她在意的事"的宽松判定，
// 于是「团队那边还在等我」「我就是随便看看」这种话能白拿到她最重那条答案，还算问对了 +2 信任。
const WHITE_ASK: Array<[CustomerId, number, string]> = [
  ["returning", 5, "团队那边还在等我"],
  ["duan", 3, "我就是随便看看"],
  ["anjie", 4, "婚礼还有一周而已"],
  ["shen", 1, "今天商场人真多"],
];

test("认不出她在说哪件事，就不许拿她最重那条答案换信任", () => {
  for (const [id, day, text] of WHITE_ASK) {
    assert.equal(typedQuestionIndex(id, text), null, `${CUSTOMERS[id].name} 「${text}」不该被认成某一条诉求`);
    const ask = resolveAsk(id, text);
    assert.equal(ask.useful, false, `${CUSTOMERS[id].name} 被白问了一句，不能算"问对了"`);
    assert.equal(QUESTIONS[id][ask.index].reveals.length, 0, `${CUSTOMERS[id].name} 的白问不许露出任何一条诉求`);
    for (const question of QUESTIONS[id].filter(entry => entry.reveals.length)) {
      assert.notEqual(ask.reply, question.response, `${CUSTOMERS[id].name} 白问那句不许冒充她答过的答案`);
    }
    const started = observeService(observeService(startService({ ...INITIAL, day }, id), "eyes"), "cheek");
    const asked = askService(started, text);
    assert.deepEqual(asked.activeSession!.revealed, started.activeSession!.revealed, "白问之后「她在意」一条都不许多");
    assert.ok(asked.trust < started.trust, `白问那句要按问偏算代价，${started.trust} → ${asked.trust}`);
  }
});

// 兜底落点必须挑一条本来什么都不露的问题：白问也不能顺手把某一条诉求记上。
test("每个人身上都有一条不露任何诉求的问题给白问落", () => {
  for (const id of Object.keys(QUESTIONS) as CustomerId[]) {
    assert.ok(QUESTIONS[id].some(question => !question.reveals.length && !question.useful),
      `${CUSTOMERS[id].name} 没有可以落白问的那一格`);
    for (const question of QUESTIONS[id]) {
      if (question.reveals.length) assert.equal(question.useful, true, `${CUSTOMERS[id].name} 露诉求的那一格不该是"没用了的问题"`);
    }
  }
});

// 认出来的那条线是"连着四个字"，不是"撞上她的字"。探针把她每句答话里的三字片段拼成问话，463 条：
// 当前阈值认 57 条（其中 2 条被她自己的措辞带到他格，见 DESIGN），阈值放宽到两个字则 463 条全认，
// 多出来的 406 条里有 260 条算"问到正解"、25 条把她领到露诉求的那一格（全在周姐2身上，「我自己」「今天」这种巧合）。
// 下面这几条今天都不认，所以它们钉的是这条线本身，不是某个落点。
const COINCIDENCE_ASK: Array<[CustomerId, string]> = [
  ["mei", "眼下那点先不管"],
  ["xiaoyu", "我不想买太多支"],
  ["duan", "室友那边我自己挑"],
  ["zhou2", "今天我自己先用"],
  ["anjie", "越临近我越不敢试"],
];

test("只撞上她句子里两三个字，不算把她那句话问回来", () => {
  for (const [id, text] of COINCIDENCE_ASK) {
    assert.equal(typedQuestionIndex(id, text), null,
      `${CUSTOMERS[id].name} 「${text}」只撞上一两个字，不该被认成她答过的某一句`);
    const ask = resolveAsk(id, text);
    assert.equal(ask.useful, false, `${CUSTOMERS[id].name} 被偶然重叠问了一句，不能算"问对了"`);
    assert.equal(QUESTIONS[id][ask.index].reveals.length, 0, `${CUSTOMERS[id].name} 偶然重叠那句不许露出任何一条诉求`);
  }
});

// P45：白问那一格十句各是各的。钉四条 —— 是她的原话（写死的，不是读同一个生成器）、不冒充她或别人准备过的
// 任何一句、念不出诉求板上的词、也不会被她自己的词表认回去（否则她挡回来那句反倒算"问对了"）。
test("认不出她在说哪件事，她挡回来那句是她自己的话", () => {
  const ids = Object.keys(QUESTIONS) as CustomerId[];
  assert.equal(ids.length, Object.keys(DEFLECTION_TRUTH).length, "新增顾客要连她那句白问台词一起补");
  assert.equal(new Set(ids.map(id => DEFLECTION_TRUTH[id])).size, ids.length, "十个人不能共用一句");
  const prepared = new Set(ids.flatMap(id => QUESTIONS[id].map(question => question.response)));
  // 她挡你这句话不能顺手把诉求说出来：这些是诉求板上那几个维度自己的用词。
  const demandWords = ["粉感", "遮瑕", "泛红", "闷痘", "持妆", "轻薄", "刺激", "斑驳"];
  for (const id of ids) {
    const customer = CUSTOMERS[id];
    const speech = DEFLECTION_TRUTH[id];
    assert.equal(fallbackReply(id, WHITE, null), speech, `${customer.name} 白问那句要念她自己那一句`);
    assert.equal(resolveAsk(id, WHITE).reply, speech, `${customer.name} 界面读 resolveAsk 也要拿到她自己那一句`);
    for (const other of ids) {
      if (other === id) continue;
      assert.notEqual(speech, DEFLECTION_TRUTH[other], `${customer.name} 那句和 ${CUSTOMERS[other].name} 那句撞了`);
    }
    assert.equal(prepared.has(speech), false, `${customer.name} 的白问句是某个人准备过的答案`);
    assert.notEqual(speech, customer.opening, `${customer.name} 白问句和开场白一模一样`);
    assert.notEqual(speech, customer.lostLine, `${customer.name} 白问句和"她走掉"那句一模一样`);
    for (const word of demandWords) {
      assert.equal(speech.includes(word), false, `${customer.name} 挡回来那句念出了诉求词「${word}」`);
    }
    for (const label of Object.values(TRAIT_LABELS)) {
      assert.equal(speech.includes(label), false, `${customer.name} 挡回来那句念出了诉求板上整句「${label}」`);
    }
    assert.equal(typedQuestionIndex(id, speech), null,
      `${customer.name} 自己的白问句被她自己的词表认回去了，那句会被算成"问对了"`);
    assert.equal(resolveAsk(id, WHITE).useful, false, `${customer.name} 白问那句不能算问对了`);
  }
});

