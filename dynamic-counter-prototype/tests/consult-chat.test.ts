import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMERS, fallbackReply, inferUseful, INITIAL, QUESTIONS, TRAIT_LABELS, askService, resolveAsk,
  observeService, startService, typedQuestionIndex,
  type CustomerId, type Trait,
} from "../src/campaign.ts";

test("need-focused questions count as useful", () => {
  assert.equal(inferUseful("shen", "你最怕镜头看到粉感吗"), true);
  assert.equal(inferUseful("anjie", "婚礼前这两天泛红怎么办"), true);
  assert.equal(inferUseful("shen", "要不要直接上看最贵的套组"), false);
});

test("fallback replies stay in character", () => {
  assert.match(fallbackReply("shen", "你最怕镜头看到什么？", 0, true), /粉感|没化妆/);
  // P43：她防备的是"推套装"这件事，那就答她自己那句，不再拿一句通用骂人话盖住所有人。
  assert.equal(fallbackReply("shen", "直接开套组吧", null, false), QUESTIONS.shen[2].response);
  assert.match(fallbackReply("shen", "随便看看就好", null, false), /走|任务/);
});

// 玩家打字问的是"她在意的那件事"，不是按钮上那几个字。旧口径探针量到 32 条真实话术只有 13 条
// （41%）落在她当时被问的那条诉求上，并且六个人各有一条诉求只有点预设按钮才问得到。
// 这里钉的是反过来那一条：她答得出的每个维度，都要有一句话术打得到。
const TYPED: Array<[CustomerId, string, Trait]> = [
  ["shen", "上镜会不会显得假？", "natural"],
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
    assert.equal(inferUseful(id, text), true, `${CUSTOMERS[id].name} 被问到自己在意的事，不该算白问`);
    assert.equal(fallbackReply(id, text, null, true), question.response,
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
test("她答不出的维度不冒充答案，价格与推销各回她自己那句", () => {
  assert.equal(typedQuestionIndex("shen", "会不会闷痘？"), null);
  assert.equal(typedQuestionIndex("anjie", "能立刻看得出效果吗"), null);
  assert.match(fallbackReply("shen", "会不会闷痘？", null, false), /走|任务/);
  assert.equal(typedQuestionIndex("mei", "预算能到两千吗？"), 1);
  assert.equal(inferUseful("mei", "预算能到两千吗？"), false);
  assert.equal(typedQuestionIndex("zhou", "要不要直接上套组？"), 1);
  assert.equal(fallbackReply("zhou", "要不要直接上套组？", null, false), QUESTIONS.zhou[1].response);
  assert.equal(typedQuestionIndex("shen", ""), null);
  assert.equal(inferUseful("shen", "   "), false);
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
