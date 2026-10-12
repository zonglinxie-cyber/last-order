// 旧五日版那 7 位客人的手写接待：脸上三处线索、她答得出的几句问话，以及那张 853×1844 的近景大图。
// 原文出自 campaign.ts 的 CUSTOMERS / QUESTIONS（旧版删除以后，这里是唯一出处）。
// 诉求表与人情场 people.ts 逐条相同（沈薇到段小姐七位，档位、权重、忌讳、预算、件数都一致），
// 所以每一处 reveals 都是她真有的那条 —— tests/world-consult.test.ts 逐条核。
//
// 没写进来的那几位（回头的沈薇、第 2 天回来的周姐、婚礼当天的安姐）是旧版按天排的变体，人情场里没有。
import type { Trait } from "../../campaign.ts";
import type { PersonId } from "../types.ts";

/** 近景大图上三处线索的落点（art/blender-export.md 锁定的面部坐标，单位是原图像素）。 */
export const PLATE_SIZE = { w: 853, h: 1844 } as const;
export const PLATE_POINTS = {
  eyes: { x: 278, y: 686 },
  nose: { x: 432, y: 815 },
  cheek: { x: 618, y: 834 },
} as const;
/** 柜台抽屉里那条脸部横幅从原图哪一段裁：眼下到下颌。 */
export const PLATE_CROP = { top: 560, bottom: 900 } as const;

export type HandSpot = { at: keyof typeof PLATE_POINTS; label: string; finding: string; reveals: Trait[] };
/** push = 推销味的那一问（开单时扣看法）；line = 一句普通的问话，她照手写那句答。 */
export type HandQuestion = { label: string; reply: string; reveals: Trait[]; push?: true };
export type HandConsult = { plate: string; spots: HandSpot[]; questions: HandQuestion[] };

const plate = (id: string) => `/assets/game/customer-${id}-consultation.webp`;

export const HAND_CONSULT: Partial<Record<PersonId, HandConsult>> = {
  shen: {
    plate: plate("shen"),
    spots: [
      { at: "eyes", label: "眼下", finding: "已有薄薄卡纹，继续叠高遮瑕会显疲态。", reveals: ["natural"] },
      { at: "cheek", label: "脸颊", finding: "妆面基本完整，她真正介意的是镜头里的粉感。", reveals: ["natural"] },
      { at: "nose", label: "鼻翼", finding: "局部微红出油，需要轻薄分区处理。", reveals: ["steady"] },
    ],
    questions: [
      { label: "你最怕镜头看到什么？", reply: "近看有粉感。不卡粉只是底线，我要像没化妆。", reveals: ["natural"] },
      { label: "预算大概多少？", reply: "预算不是问题，别拿价格替代判断。", reveals: [] },
      { label: "要不要直接看套装？", reply: "我刚说了不缺粉底。你也没听我说话？", reveals: [], push: true },
      { label: "带妆久了会不会闷痘？", reply: "T区到下午就闷，厚一点第二天准出事。", reveals: ["steady"] },
      // 「上镜要遮得住」是她留着没说的一条：话要接得住，但这一条不露（问偏照算）。
      { label: "遮瑕力够不够？", reply: "盖住不难，盖完还是我这张脸才难。", reveals: [] },
    ],
  },
  mei: {
    plate: plate("mei"),
    spots: [
      { at: "eyes", label: "眼下", finding: "干纹明显，厚粉底会让疲态更重。", reveals: ["soothe"] },
      { at: "cheek", label: "脸颊", finding: "缺水和光泽断层，修护打底比遮盖更重要。", reveals: ["soothe"] },
      { at: "nose", label: "鼻翼", finding: "没有明显出油，控油型产品会加重紧绷。", reveals: ["steady"] },
    ],
    questions: [
      { label: "明早最想改善哪里？", reply: "眼下干、脸没精神，但我不想遮成一张面具。", reveals: ["soothe"] },
      { label: "预算能到两千吗？", reply: "我只有十分钟，你先告诉我什么真的有用。", reveals: [], push: true },
      { label: "平时用高遮瑕吗？", reply: "几乎不用，越厚越显累。", reveals: ["steady"] },
      { label: "涂上去会不会太厚？", reply: "厚不怕，怕的是浮在脸上——十分钟就得服帖。", reveals: [] },
    ],
  },
  xiaoyu: {
    plate: plate("xiaoyu"),
    spots: [
      { at: "eyes", label: "眼下", finding: "睡眠不足带来暗沉，但不需要重度遮瑕。", reveals: ["natural"] },
      { at: "cheek", label: "脸颊", finding: "有活跃痘和轻微敏感，厚重持妆容易闷痘。", reveals: ["steady"] },
      { at: "nose", label: "鼻翼", finding: "T区出油、两颊不油，适合分区轻薄上妆。", reveals: ["steady"] },
    ],
    questions: [
      { label: "预算里最不能牺牲什么？", reply: "别闷痘。我宁愿少买，也不想面试前爆更多。", reveals: ["steady"] },
      { label: "要不要咬牙上套装？", reply: "我说了只有一千。高端柜也不听预算吗？", reveals: [], push: true },
      { label: "明天是什么场合？", reply: "第一次正式面试，想精神，但不想像换了张脸。", reveals: ["correct"] },
    ],
  },
  zhao: {
    plate: plate("zhao"),
    spots: [
      { at: "eyes", label: "神情", finding: "她一直看价签，不是不舍得，而是怕买错。", reveals: [] },
      { at: "cheek", label: "信息", finding: "观察她的皮肤不能代替询问女儿的使用史。", reveals: [] },
      { at: "nose", label: "细节", finding: "她手里有女儿发来的过敏成分截图。", reveals: ["steady"] },
    ],
    questions: [
      { label: "女儿用过什么会不舒服？", reply: "她发了过敏成分截图，我差点忘了给你看。", reveals: ["steady", "soothe"] },
      { label: "您自己喜欢哪一款？", reply: "不是我用。看我的脸没有用。", reveals: [] },
      { label: "礼物一定要显得贵吗？", reply: "我怕的是送错，不是看着不够贵。", reveals: ["soothe"] },
    ],
  },
  anjie: {
    plate: plate("anjie"),
    spots: [
      { at: "eyes", label: "眼下", finding: "焦虑和睡眠不足明显，当前状态不适合叠加新品。", reveals: ["soothe"] },
      { at: "cheek", label: "脸颊", finding: "双颊正在泛红，强持妆套组存在刺激风险。", reveals: ["soothe"] },
      { at: "nose", label: "表达", finding: "她强调“绝对不出错”，安全感比客单更重要。", reveals: ["steady"] },
    ],
    questions: [
      { label: "婚礼前皮肤最近稳定吗？", reply: "这两天突然泛红。越临近越不敢出错。", reveals: ["soothe"] },
      { label: "预算上限是多少？", reply: "预算不是问题，出问题才是。", reveals: [] },
      { label: "要不要新品整套？", reply: "苏蔓说你会判断，不是只会推套装。", reveals: [], push: true },
      { label: "婚礼当天最怕出什么状况？", reply: "就怕泛红压不住，闪光灯一亮两颊全红。", reveals: ["steady"] },
      // 「立刻见效」是她留着没说的那条：接得住这句问法，但不在问题里露出来。
      { label: "能不能立刻见效？", reply: "见效快的都猛，这几天我赌不起刺激。", reveals: [] },
    ],
  },
  zhou: {
    plate: plate("zhou"),
    spots: [
      { at: "eyes", label: "眼下", finding: "细纹不多，真正的风险是下午两颊发干。", reveals: ["natural"] },
      { at: "cheek", label: "脸颊", finding: "底妆到下午就开始斑驳，可她一厚就显得假。", reveals: ["steady", "wear"] },
      { at: "nose", label: "鼻翼", finding: "T区微油，不适合整脸厚持妆。", reveals: ["steady"] },
    ],
    questions: [
      { label: "对面说的持妆你信吗？", reply: "我怕下午暗沉斑驳。开会要拍照片，但不能看起来像换了一层皮。", reveals: ["natural", "wear"] },
      { label: "要不要直接上套组？", reply: "我是来对比的，不是来被完成任务的。", reveals: [], push: true },
      { label: "皮肤最近是不是发干？", reply: "下午T区还出油，两颊已经紧了。你们怎么没人先问这个。", reveals: ["steady"] },
    ],
  },
  duan: {
    plate: plate("duan"),
    spots: [
      { at: "eyes", label: "眼神", finding: "她在看你，也在看有没有人准备强推。", reveals: [] },
      { at: "cheek", label: "皮肤", finding: "她自己并不敏感，但选品不能按她的脸来。", reveals: ["natural"] },
      { at: "nose", label: "手机", finding: "相册里是室友的过敏记录，不是她的自拍。", reveals: ["steady"] },
    ],
    questions: [
      { label: "真的只是看看吗？", reply: "室友过生日。我想买对，但我不想被说成好骗。", reveals: ["natural"] },
      { label: "要不要先领小样？", reply: "中庭已经发过了。我缺的是判断，不是袋子。", reveals: [], push: true },
      { label: "她皮肤和你像吗？", reply: "她比我还容易闷痘。别推荐我自己都不敢用的。", reveals: ["steady"] },
    ],
  },
};
