# 《最后一单》多章节化技术评估

评估人：devin（只读评估，未改动任何代码）。代码基线：工作区当前 HEAD（最近提交 `d762f0a`）。

**一句话结论**：现在的内容架构是「单一章节把类型、常量、文案、事件、存档全部写在一个文件里」——`dynamic-counter-prototype/src/campaign.ts`（1945 行）既是规则引擎又是第一章的内容表。多章节化不需要重写规则层：项目里已经有一个被验证过的先例——`Campaign.week`/`target` 覆盖字段 + `weekOf()`/`targetOf()` 访问器（`campaign.ts:460-461`），七日周目（?mode=run）就是靠它换掉了整周排程。把同一招用到「章节」上是风险最低的路径。

---

## 1. 现状盘点：内容是怎么写死的

### 1.1 类型层（`dynamic-counter-prototype/src/campaign.ts`，除非注明下同）

| 符号 | 行号 | 内容 |
|---|---|---|
| `ProductId` | L2 | `"soft" \| "glow" \| "repair"`，全柜三支产品写死在类型上 |
| `CueId` | L3 | `"eyes" \| "cheek" \| "nose"`，三个观察点；CSS 定位也只有这三处 |
| `Trait` | L4 | `natural / correct / soothe / steady / wear` 五档诉求 |
| `BundleId` | L5 | `single / pair / set / bulk` 四档连带 |
| `CustomerId` | L6 | **10 个 id 的字面量联合**：`shen, mei, xiaoyu, zhao, anjie, returning, zhou, duan, zhou2, anjie2` |
| `StaffKey` | L8 | `player, luyao, roman, suman, tangke, fangmin` 六位员工 |
| `Customer` | L36-54 | 顾客形体：portrait/opening/need/demands/veto/budget/maxUnits/`mapVariant`（只有 `"young"\|"mature"`）/patience/lostLine/deflection/rival/cues |
| `Campaign` | L56-87 | 存档形体；`week?: DayStory[]`、`target?: number`、`runSeed?: string` 是 L81-86 的周目覆盖字段——**这是现有扩展点先例** |
| `EventChoice` | L89-96 | `visible?(s)`/`apply(s)` 是函数，不是纯数据 |
| `DayStory` | L107-114 | 一天的排程单元（day/title/subtitle/brief/threat/customers） |

`CustomerId` 是编译期联合类型，这意味着「新顾客」不是往表里加一行，而是**改类型**——所有 `Record<CustomerId, …>` 都会强制要求新 id 的条目（CUSTOMERS/QUESTIONS 的完整性由 tsc 保证），所有 `CUSTOMERS[id]` 索引都假设命中。这个性质是把双刃剑：扩章节时它帮你在编译期兜住缺漏，但也决定了 `CustomerId` 必须保持为字面量联合（改成 `string` 会让 `CUSTOMERS[id]` 全部类型失守，包括 `src/sim/` 旧参考代码）。

### 1.2 常量层

| 符号 | 行号 | 内容 |
|---|---|---|
| `SAVE_KEY` / `SAVE_VERSION` | L119 / L123 | `"last-order-campaign-v1"` / **7** |
| `TARGET` | L124 | ¥21,000 |
| `RIVAL_IDS` | L126 | `["shen","returning","zhou"]` —— 三位会触发陆遥插话的顾客 |
| `DAY_TARGETS` | L134 | `[2800, 3200, 3600, 4400, 7000]`，逐日累计线，晨会进度念的就是它 |
| `WEEK_ALLOCATION` | L143 | `{ soft: 10, glow: 4, repair: 7 }` 整周硬上限 |
| `DELIVERIES` | L149-155 | **5 批 × 3 支**的到货矩阵，每批是 `Record<ProductId, number>`（类型强制每个键都要写） |
| `FIRST_DAY_STOCK` | L156 | = 第一批 |
| `deliveryWord` | L159-167 | 读全局 `DELIVERIES` |
| `INITIAL` | L188-195 | 初始存档；**`waitMeters: { shen: 8, mei: 8 }` 把第 1 天阵容烙进了初始状态** |
| `PRODUCT_TRAITS` | L197-201 | 3 产品 × 5 诉求矩阵 |
| `PRODUCTS` | L203-207 | 三品名/短名/价格/note |
| `ADVANCE_PRODUCT="soft"` 等 | L212-219 | 垫货机制绑死柔焦 |
| `CLAIM_PRODUCT="repair"` 等 | L224-235 | 「把话说满」绑死修护+淡斑文案 |
| `TRAIT_LABELS` | L244-250 | 五档中文名 |
| `BUNDLES` | L252-257 | 连带档 |
| `EXPIRED_SAMPLING` | L643 | `fromDay: 3` 等过期小样参数 |

### 1.3 内容表

| 表 | 行号 | 规模 |
|---|---|---|
| `QUESTIONS` | L334-357 | 10 位顾客 × 3-5 条 `{label, response, useful, reveals}` |
| `REACTIONS` | L359-363 | 3 产品 × positive/mixed/negative 文案 |
| `CUSTOMERS` | L365-448 | 10 条完整定义（约 84 行）；`returning`/`zhou2`/`anjie2` 的 `portrait` 直接复用本尊图片（L407、L431、L441） |
| `DAYS` | L450-456 | 5 个 `DayStory`；每天 `customers` 1-2 人 |
| `RIVAL_INTERRUPTIONS` | L463-467 | `Record<"shen"\|"zhou"\|"returning", …>` 写死子集类型 |
| `DEMAND_HINTS` | L475-483 | `Record<Trait, RegExp>` 打字提问识别正则 |
| `RISKY_RETURNS` | L606-615 | 8 条退货/客诉条目，各带 `fromDay` |
| `SAMPLE_RETURNS` | L617-626 | 8 条小样回柜条目，各带 `fromDay` |

### 1.4 排程与回头客链

- `weekOf`/`targetOf` L460-461：`s.week ?? DAYS`——**已经存在的章节式抽象**，run 模式生成的 `DayStory[]` 走的就是这条缝。
- `floorCustomers` L686-695：canonical 章节（`s.week === undefined`）里做两条链式补位——day 4 且 `served:zhou:*` 追加 `zhou2`；`anjieComesBack`（L683-684，`s.day === 5 && served:anjie:good`）把 `anjie2` 插到队首。生成周不走链，由排程显式含这些顾客。
- `availableCustomers` L1477 / `startService` L1728 都经由这条链。

### 1.5 晚间事件 `dayEvent`（L1144-1297）

整段是按 `s.day` 字面量分发的大 if 链：

- L1147-1155：`s.week !== undefined` → 通用收摊卡（run 模式专用逃生口，**同样证明分发先例已存在**）
- L1156：day 1 苏蔓赠品缺口（写死 `refused-suman`/`covered-suman`/`public-sample-record` 旗、苏蔓/唐可人情数）
- L1165-1185：day 2 按 `hasPurchase(s,"xiaoyu")` 分两条线（追小雨 / 唐可争单，`split-with-tang`/`tang-owes-order` 等旗）
- L1186-1208：day 3 按 `hasPurchase(s,"zhao")` 分两条线（数据造假 / 赵女士过敏记录）+ `priceCards`（比价卡，`PRICE_GAP=280`）
- L1231-1249：day 4 按 `hasPurchase(s,"anjie")` 分两条线 + `advanceCard` 垫货卡（L1213-1230）
- L1250-1297：其余（即 day 5）三分支：`gap`→方敏缺口审问 / `atRisk`（`standing < STANDING_RISK`）→罗曼柜位评估 / 兜底→储备人选；含 `rosterCard` 私域名单卡

事件里说话人直接写中文名 + `speakerStaff`/`speakerCustomer` 指向第一章角色；`EventChoice.apply` 内嵌数值与 flag 名——全部是代码不是数据。

### 1.6 晨会与跨日后果 `applyDawn`（L913-994）/ `dawnNotices`（L1015+）

`applyDawn` 里的日次耦合：

- L916-923：`DELIVERIES[s.day-1]` 到货，`delivered:<day>` 幂等旗
- L927-937：`sample-expired:<id>:<day>` → 次日 `expired-raised` 追问（通用机制，旗带日次）
- L940-949：`claim:<id>:<day>` → 次日 `claim-raised` 备案追问（通用机制，但 `CLAIM_PRODUCT`/`claimQuestion` 文案是第一章的）
- L950：`s.day === 4 && tang-owes-order` → 唐可伴娘单 ¥2,080 到账
- L955-966：`s.day === 5` 赵女士三连（女儿复购 ¥1,680 / 客诉 / 按承诺退货）
- L968：`anjieComesBack` → `anjie-came-back` 账本去重
- L974-986：`s.day === 5 && advance-order` → 垫货出清/压箱
- L987-989：遍历 `RISKY_RETURNS`/`SAMPLE_RETURNS`/`applyMemberRepeat`
- L991-992：`morningReview`（L833，罗曼念昨日线，较通用但人名写死）+ `counterCheck`（L846-857，**day===4 数名单 / day===5 盘小样，完全是第一章节点**）

`dawnNotices` L1015 起同样按 `s.day === 4/5` 散落第一章专属告示（L1024-1032 唐可/赵女士/安姐微信）。

其他日次字面量：`touchThreads` L772 `s.day >= 5`（最后晚没早晨）；`applyMemberRepeat` L897 `s.day < 5`；`startNextDay` L1717 `s.day >= 5` → 直接结局；`STRUCTURE_FROM_DAY = 4` L864；`progressTarget` L819 对 `DAY_TARGETS` 截断到 5。注意 **`canClaim` L316 已经是 `s.day < weekOf(s).length` 的正确写法**——改造时照这个抄。

### 1.7 flags 命名空间（散落在 `flag(s, "...")` / `hasFlag`）

无集中清单，约定俗成的前缀：`served:<id>:good|risky|refused|out-of-stock`、`lost:<id>`、`sample:<id>`、`sample-expired:<id>:<day>`、`expired-raised:<id>:<day>`、`claim:<id>:<day>`、`claim-raised:<id>:<day>`、`touched:<id>:<day>`（L745-749，整周一次+按日配额）、`pulled:<id>`、`member-repeat:<id>`、`transfer:<product>`、`delivered:<day>`、`checked:<day>`、run 的 `perk:*`/`perk-pending`、match 的 `rival:<id>`、以及约 30 个第一章剧情旗（`covered-suman`、`tang-owes-order`、`zhao-complaint`、`counter-argued-records`……见 1.5/1.6）。

**关键隐患**：`touched:`/`delivered:`/`sample-expired:`/`claim:` 都以 `:<day>` 结尾且按 `s.day` 比较。如果跨章节让 `flags` 原样带进下一章且 `day` 重置为 1，第一章留下的 `touched:x:1` 会在第二章第 1 晚被误认为「今晚刚跟过」。**flags 必须按章节命名空间隔离，或章节间只迁移白名单字段**（见 2.6）。

### 1.8 存档校验 `parseCampaign`（L1313-1382）与 `asHistory`（L1299-1311）

写死点：

- L1318：`day` 必须是 1-5 整数
- L1324-1327：`stock` 遍历 `Object.keys(PRODUCTS)`，每支 `0 .. WEEK_ALLOCATION[product]+TRANSFER_UNITS`——**新增产品后老的 3 键存档必然校验失败**
- L1331-1340：`activeSession` 校验引用合法性（CUSTOMERS/QUESTIONS/BUNDLES/TRAIT_LABELS 键全集）
- L1343-1351：`week` 数组长度 ≤5，每 `story.day` ≤5，customers ⊆ CUSTOMERS
- L1353-1354：`target` ≤200,000；`runSeed` 须匹配 `^week-\d+:\d+$`
- L1365：`eventDoneDays` 每项 ≤5
- L1307（asHistory）：`day` 超界钳到 1
- 副产品：`dayServed/members/lost/waitMeters/orders` 都过滤到 CUSTOMERS/PRODUCTS 已知键（L1362-1369）——合并式全局注册表会自动兼容新 id
- L1378：末尾用 `floorCustomers` 重算 waitMeters——章节化后这里要认得「当前章节的排程」

老存档兼容现状：v2 存档有加法式迁移痕迹（`paybackCharge` L718-720 读 `tang-owes-order`/`split-with-tang` 旧旗）；`faceTrialled`/`visitMinutes` 等字段按缺省值容忍（L1337-1340、L1374-1375）。项目约定是「不兼容整份丢弃」（AGENTS.md），但**v7→v8 是纯加字段，可以零成本保留第一章存档**（见 2.3）。

### 1.9 UI 层的写死点

根沙盘 `src/CounterGame.tsx`（444 行）：

- L3-11：直接 import `CUSTOMERS, DAYS, dayEvent, RIVAL_IDS, RIVAL_INTERRUPTIONS, TARGET` 等
- L21 `STAFF`、L31 `CUES=["eyes","cheek","nose"]`、L35 `ART_ALIAS={returning:"shen",zhou2:"zhou",anjie2:"anjie"}`、L36 `customerArt` → `assets/chibi/{id}.png`
- L97-98：`DAYS[game.day-1]` 直读（不走 `weekOf`——**沙盘只支持 canonical**）
- L100-101：竞品插话判断 `RIVAL_IDS.includes` + 断言 `keyof RIVAL_INTERRUPTIONS`
- L310：`第 {game.day} / 5 天` 字面量；L346：开场图章 `05 DAYS ¥21,000`；L436：`game.day === 5` 换结局按钮
- L262 附近 `VOICE_LINE` 梅女士专属台词、L278/285-287 员工与顾客名牌表
- `src/Experience.tsx`：L6-13 `CHAPTER_HOOKS` 五条逐日钩子；L15 `ChapterTrack` 渲染 `DAYS`；L52-55 `questionChoices` 用 `Object.keys(CUSTOMERS).indexOf(id)` 做轮转偏移（**新 id 追加在末尾可保住现有偏移**）；`ShiftHandbook` 里写死 ¥21,000 与四位员工
- `src/experience-art.ts`：`customerPortrait(id)` 从 `CUSTOMERS[id].portrait` 文件名推导 `assets/optimized/*.webp` 与 `-thumb`——**新顾客只要 PNG 名字守规矩就自动有图**
- `src/floor-stage.ts`：`BROWSE_BEATS` L53-56 只有 2 个站位、`EXIT_SPOTS` 2 个、`BAG_SPOTS` 2 个——**沙盘在场顾客上界是 2**（注释明写「一天最多两位顾客在场」）
- `src/rescue.css` L162-163：`product-soft/glow/repair` 三个雪碧图位移；L138-141 三个 cue 点 CSS 位置
- `src/rush-rules.ts`：L9-12 `STATIONS` 三工位绑死三产品、L14 `CAST` 七人、L16 `PRODUCT_IDS`——rush 是独立小模式
- `src/sim/`（engine.ts L333/415、cast.ts L182）：旧参考代码也读 `DAYS`，主入口不加载但 tsc 仍会编译它

手机版 `dynamic-counter-prototype/src/Prototype.tsx`（643 行）：

- L28-36：`STAFF` 表挂 `staff-portraits/*.png`
- L40-52：`ClassicMeta`——**现成注入点**（saveKey/fresh/nextDay/onFinale/lastDayLabel/weekLabel/targetLabel），run 模式已经用它接管出入口
- L127-133：`weekOf`/`targetOf` 已泛化；L411 `DAY {day} / {week.length}` 已经按周长渲染；L387 `lastDay = day >= week.length`
- 残留第一章文案：L403-404 开场「五日章节/五日销售目标/开始新品活动周」、L500-501 结局屏点名沈薇/苏蔓/唐可与「五日因果账本」、L580「五日目标」fallback
- L143：`customerId === "shen" || "zhou" || "returning"` 字面量三重判断——**`RIVAL_IDS` 的重复实现**，改竞品集合时会漏（现有异味）
- L545：`staffOnFloor = ["luyao","roman"]`；`floorLife.ts` `customerHome` L25-29：index 0→tester，其余全挤 `open`——**手机版在场位实际上也只区分第一位/其他人**
- L462：产品选择 `Object.keys(PRODUCTS)` + `product-art-${id}` 类名；`prototype.css` L287-289 三档雪碧位移；L247-249 三 cue 点定位
- L445：cue 按钮 `["eyes","cheek","nose"]` 写死

### 1.10 四个模式（dynamic-counter-prototype/src/）

| 模式 | 文件 | 与内容的耦合 |
|---|---|---|
| duel | `duel.ts`(327) + `DuelGame.tsx`(501) | `duelDeck` L102 按 `QUESTIONS[id]` 造牌；L142-144、L283-284 `RIVAL_INTERRUPTIONS[id as "shen"\|"zhou"\|"returning"]` 强转；`DUEL_BUNDLE_AT` 兴趣阈值表；`DuelGame` L23 `PRODUCT_IDS` 三品、L97 `DAYS[campaign.day-1]`（**duel 局内仍是 canonical 五天**）、L30-36 脸区坐标与 853×1844 对齐 |
| run | `run.ts`(110) + `RunGame.tsx` | `RUN_POOL = Object.keys(CUSTOMERS)` L16（**池子随全局顾客表自动膨胀**）；`runWeek` L20-45 固定 5 天、7-10 人、≤3/天；`runTarget` L48-55 预算×0.65-0.75 取整百；`RUN_PERKS` 七条局间增幅；`nextRunSeed` 周目顺延 |
| match | `match.ts`(322) + `MatchGame.tsx` | 单日 6-8 人种子队列（L25-26）；`rivalPick` 遍历 `Object.keys(PRODUCTS)`（自动认新货）；**L112 估值用 `stock:{soft:99,glow:99,repair:99}` 字面量**；MatchGame L28 又有 `PRODUCT_IDS` 三品 |
| blitz | `blitz.ts`(272) + `BlitzGame.tsx` | `BLITZ_DAY=6` L29（钉在不存在的那天防 `floorCustomers` 干扰）；`BLITZ_POOL` L52-53 过滤 `!rival`（自动膨胀）；L143 `stock:{...WEEK_ALLOCATION}`；BlitzGame L17 又有 `PRODUCT_IDS` 三品 |

四个模式共用一套 `localStorage` 键（`last-order-duel-v1`、`last-order-run-v1`、`last-order-match-v1/-best`、`last-order-blitz-v1/-best`），互不影响第一章存档槽 `last-order-campaign-v1`。

---

## 2. 多章节架构建议

### 2.1 总体形状：`ChapterPack` + 注册表

核心判断：**这个项目已经两次实现了「换一章内容」——`week`/`target` 字段（run）和 `s.week !== undefined` 的通用闭店卡**。章节化只是把这套零散先例收拢成一个显式接口。

建议新增目录 `dynamic-counter-prototype/src/content/`（沙盘通过相对路径复用，与 `experience-art.ts` 现在的引用方式一致）：

```ts
// content/types.ts —— 只依赖 campaign.ts 的公开类型
export type ChapterPack = {
  id: string;                      // "ch1" | "ch2" | …
  order: number;                   // 章节顺序（解锁/选关用）
  title: string;                   // "新品活动周" …
  days: DayStory[];                // 本章排程（3-5 天）
  target: number;                  // 章目标
  dayTargets: number[];            // 逐日累计线（长度 = days.length）
  products: ProductId[];           // 本章货架
  allocation: Partial<Record<ProductId, number>>;
  deliveries: Array<Partial<Record<ProductId, number>>>; // 长度 = days.length
  firstDayStock: Partial<Record<ProductId, number>>;
  // —— 下面是「钩子」，缺省=没有这类内容 ——
  rivalIds?: CustomerId[];
  interruptions?: Partial<Record<CustomerId, { headline: string; quote: string }>>;
  paybacks?: Payback[];            // 原 RISKY_RETURNS
  sampleReturns?: SampleReturn[];  // 原 SAMPLE_RETURNS
  extraFloorCustomers?: (s: Campaign, base: CustomerId[]) => CustomerId[]; // 回头客链
  dayEvent?: (s: Campaign) => DayEvent | null;   // null → 走通用收摊卡
  dawn?: (s: Campaign) => Campaign;              // 挂在 applyDawn 的通用机制之后
  dawnNotices?: (s: Campaign) => DawnNotice[];
  counterChecks?: (s: Campaign) => CounterReading[]; // 原 counterCheck 的名单/小样两档
  finale?: { title(s: Campaign): string; verdict(s: Campaign): { label: string; body: string } };
  hooks?: Array<{ speaker: string; line: string; question: string }>; // 原 CHAPTER_HOOKS
  copy?: { intro?: string; targetLabel?: string; ledgerTitle?: string };
};
```

第一章不动数据结构地表达为：`ch1 = { id:"ch1", days: DAYS, target: TARGET, dayTargets: DAY_TARGETS, products:["soft","glow","repair"], allocation: WEEK_ALLOCATION, deliveries: DELIVERIES, firstDayStock: FIRST_DAY_STOCK, rivalIds: RIVAL_IDS, interruptions: RIVAL_INTERRUPTIONS, paybacks: RISKY_RETURNS, sampleReturns: SAMPLE_RETURNS, extraFloorCustomers: <现 floorCustomers 的 zhou2/anjie2 补丁>, dayEvent: <现 dayEvent 的 canonical 分支>, … }`。

**不要**把事件改成 JSON——`EventChoice.visible/apply` 是函数（L94-95），硬编码 `compliance −18`、`relations.suman +8` 这类结算没法有意义地数据化，强行做成 effect DSL 只会再造一个引擎。正确边界是：**内容表（顾客/问题/排程/配货/顾客专属文案）数据化，事件留在每章一个 `chN.ts` 的代码里**，和今天 `dayEvent` 的写法一脉相承。

### 2.2 注册表与类型拼装

```ts
// content/ch1.ts / ch2.ts / … 各自 export const pack: ChapterPack
// content/index.ts
import { pack as ch1 } from "./ch1"; /* … */
export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5] as const;
export type ChapterId = (typeof CHAPTERS)[number]["id"];
```

`CustomerId` 保持字面量联合：各章文件里先 `export type Ch1CustomerId = "shen"|…| "anjie2"`，`CustomerId = Ch1CustomerId | Ch2CustomerId | …`。`CUSTOMERS` 由注册表合并 `{...ch1.customers, ...ch2.customers}`——**必须保证第一章的 10 个键排在最前**（`questionChoices` 的轮转偏移、`touchThreads` 遍历顺序、各模式洗牌池都依赖 `Object.keys` 顺序）。加一条注册表级测试钉住键序。

### 2.3 Campaign 与存档（SAVE_VERSION 7→8）

- `Campaign` 加 `chapter?: ChapterId`；canonical 第一章可以缺省=`"ch1"`，访问器 `chapterOf(s)` 与 `weekOf`/`targetOf` 同构。
- `INITIAL` 保留为第一章初始（所有测试直接用它），新增 `initialFor(chapterId)` 工厂；`waitMeters` 从 `pack.days[0].customers` 填，不再手写 `{shen:8, mei:8}`。
- `parseCampaign`（L1313-1382）改造点：L1318 `day ≤ pack.days.length`；L1324-1327 stock 校验对 `pack.allocation` 而非全局 `WEEK_ALLOCATION`；L1344/1346 `week`/`story.day` 上限改为 `pack.days.length`；L1365 `eventDoneDays` 同上；**顺带补一个缺口：当前不校验 `stock` 里的未知键**，多产品后应拒收 pack 货架以外的支数。
- v7→v8 是纯加字段迁移（`chapter: "ch1"`，其余字段语义不变），可以保留玩家进度；若按项目惯例整份丢弃也可接受，代价是老玩家重打第一章。建议做加法迁移——成本是 `parseCampaign` 里 `version===7` 的分支读默认 `chapter`。
- `startNextDay` L1717 `s.day >= 5` → `s.day >= weekOf(s).length`；`touchThreads` L772、`applyMemberRepeat` L897、`progressTarget` L819 同法改读 `pack.dayTargets`/`weekOf`——**这几处是第一章「5」扩散进规则层的全部位置**，已在 1.6 列全。

### 2.4 产品表 3→N

- `PRODUCTS`/`PRODUCT_TRAITS`/`REACTIONS` 升为全局目录，`ProductId` 加 `lipstick|perfume|sunscreen|…`。
- `Campaign.stock` 改 `Partial<Record<ProductId, number>>` + `stockOf(s,p)` 读数助手（`?? 0`）。约 20 处 `s.stock[x]` 读点机械修改（`canTransfer` L1875、`rivalPick`、`resolveSale`、`orderQuote`、两个 UI 的连带格、`parseCampaign`、各测试构造器）。这是为多产品付的一次性成本；不换的话 `DELIVERIES` 每批都要为不在架产品写 0，噪音大且误导。
- `deliveryWord` L159 读全局 `DELIVERIES` → 改读 `pack.deliveries`；`applyDawn` L917 同。
- 产品图：现网是三图一条 `product-trio.png`（1402×1122）+ 两端 CSS 位移类（`rescue.css` L162-163、`prototype.css` L287-289、`rush.css` L18）。**N 支后建议改每支独立文件 `product-{id}.png`**，让 `productArtworkOf(id)` 元数据驱动，摆脱「加货=重排雪碧+改三处 CSS」。
- Trait 轴：口红/香水/防晒大概率需要新诉求档（色泽、留香、防晒值）。加 `Trait` 成员是便宜的一步（`TRAIT_LABELS`/`PRODUCT_TRAITS` 行、`DEMAND_HINTS` 正则各加一条），但要注意 `campaign-rules.test.ts` 的「每人只有一款 positive」不变量会立刻对新组合生效——**新章顾客的正解必须分散到新旧产品上，否则「只推修护」变成通用启发式**，这正是 AGENTS.md 明令防的退化。

### 2.5 回头客链泛化

`floorCustomers` L691-693 的两条补丁移进 ch1 pack 的 `extraFloorCustomers`；`anjieComesBack` 的 `s.day===5` 改成读 pack 里声明的链（例如 `comeback: { id:"anjie2", day:5, flag:"served:anjie:good", prepend:true }` 小数据 + 通用判定函数）。`servedZhou`/`anjie-came-back` 的账本去重行随 pack 的 `dawn` 钩子走。

### 2.6 章节间状态

推荐**每章独立 `Campaign` 开局**（`initialFor(chN)`），跨章只迁白名单字段：

- 迁：`members`（私域名单是长期资产）、`relations` 快照（同事还在）、若干叙事旗以 `ch1:` 前缀显式迁移。
- 不迁：`stock`（每章货架不同）、`orders`/`history`/`dayServed`/`lost`/`waitMeters`/`eventDoneDays`（全部日次敏感）、裸 `flags`（日戳旗跨章会误伤，见 1.7）。
- 另开一个小存档键（如 `last-order-progress-v1`）记录章节解锁/最佳成绩，不动 `SAVE_KEY` 的语义。

这样 `day` 永远是「章内第几天」，所有 `fromDay`/`delivered:`/`dayEvent(s.day)` 语义原样成立，第一章逐字照搬不需要改一个条件。

### 2.7 flags 命名空间

即使每章独立开局，也建议给剧情旗加章节前缀约定（`ch2:promised-mirror`），结构性旗（`served:`/`lost:`/`touched:` 等通用机制）保持无前缀——它们是引擎词汇不是章节内容。`dayEvent` 里第一章那批旗收进 ch1 文件即可。

### 2.8 楼层容量

沙盘 `BROWSE_BEATS`/`EXIT_SPOTS`/`BAG_SPOTS` 各 2 格（floor-stage.ts），手机版 `customerHome` 有效区分前两位。每章「3-5 天 × 5-8 位」摊下来 1-3 人/天，**只要排程保持 ≤3 人/天就不必动地板**（run 模式已经这么跑）；如果哪天要 4+ 同时在场，需要给两端各加站位——把「每章单日 ≤3 人」写成内容 lint 规则最省事。

### 2.9 结局与文案

`endingTitle` L1440 本身是通用的（salesWin/safe/trusted 三轴），但 `counterVerdict` L1432 与结局屏正文（Prototype.tsx L500）是第一章叙事。收进 pack.finale；`CHAPTER_HOOKS`/`intro`/`ledgerTitle` 走 `pack.copy`/`pack.hooks`。

---

## 3. 测试矩阵：谁钉住了什么

### 3.1 钉数字与不变量的单测（`node --experimental-strip-types --test`）

| 文件 | 钉的内容 |
|---|---|
| `tests/campaign-rules.test.ts`（959 行） | L20-35 清洁路线 `TARGET=21000`、`dayTotals[3]=14,770`、`sales=22,930`、`evidence=12`、结局标题原文；L38-48 单件路线 <21,000、硬开 bulk 路线 <21,000 且 ≥3 人走掉；L50-61 **遍历 CUSTOMERS 全员**：每人恰一款 positive、veto/主诉求可问出；L64-81 「持妆正解只有 anjie2」+ day4/5 链式阵容断言；L84-106 `complianceWord`/`consultsLeft`/`evidenceWord` 文案表；以及垫货、调货、断言 `DELIVERIES` 合计=`WEEK_ALLOCATION` 等约 45 条 |
| `tests/rescue-rules.test.ts` | 耐心/时钟持久化、小样不洗白适配、整周全上脸路线 ¥21,250、调货救援路线 ¥25,590（官方）/¥24,610（唐可）、断货不扣信任台账、v2 迁移 |
| `tests/counter-standing.test.ts` | `DAY_TARGETS` 合计=TARGET、晨会三档、`counterCheck` day4/5、名单门槛、清洁路线柜位安全 |
| `tests/consult-chat.test.ts` | L10-22 **`DEFLECTION_TRUTH` 按 10 个 id 逐字钉 deflection**；L50+ `TYPED` 表钉打字提问落点；L86+ 遍历 `Object.keys(QUESTIONS)` 全员校验「每条可回答诉求都有一句真问题」「每人都有一条白问格」——**新顾客不加内容就过不了这组** |
| `tests/duel-rules.test.ts` | 牌堆由 `QUESTIONS` 生成、兴趣阈值、竞品插话时机 |
| `tests/run-rules.test.ts` | L15 `ALL_IDS=Object.keys(CUSTOMERS)`、L18-26 同种子同周、L42-44 目标公式、L52-55 runSeed 随档、L173-174 周目顺延 |
| `tests/match-rules.test.ts` | L79-81 队列 6-8 人去重且 ∈CUSTOMERS；结构性断言为主 |
| `tests/blitz-rules.test.ts` | L55-58 同种子同队、队列无竞品顾客；L236 纪录槽 `version:9` |
| `tests/clean-route.ts` | 路线模拟器本体（`runRoute`/`bestFit`/`herCap`） |
| `tests/duel-sim.ts` | 牌局四路线模拟（skilled/naive/grey/novice） |

**注意**：`package.json` 的 `test:rules` 只跑 `campaign-rules / consult-chat / rescue-rules / counter-standing / duel-rules` 五个文件——`run-rules`/`match-rules`/`blitz-rules` **不在默认脚本里**，目前只是存在（`npm test` = `test:rules && build && test:runtime && test:release && test:sites`）。

### 3.2 手机版 e2e（`playwright.config.ts` → `tests/*.spec.ts`，约 30 个）

- `campaign.spec.ts`：完整走 5 天清洁路线，断言 `¥22,930` 与 `ledgerYuan` 账本加总一致
- `consequences.spec.ts` / `endings.spec.ts` / `counter-roster.spec.ts` / `week-structure.spec.ts`：旗→后果链、结局、私域、结构行
- `run-flow.spec.ts`：**L16-24 钉死种子 `week-1:10` 的第 1 天只有安姐、目标 `¥15,400`**；L43 注释明写「生成周没有文案那五晚：通用闭店格」；L54 `runSeed` 落档
- `blitz-flow.spec.ts`：**L4-5 钉死 `seed=s1` 的队列顺序（段小姐→赵女士→周姐→梅女士→安姐→小雨）与开场手牌**
- `match-flow.spec.ts`：固定种子 `flow-a/flow-b`
- `duel-flow.spec.ts`：钉第 1 天沈薇+梅女士阵容与 `1:shen` 手牌序
- 其余约 20 个 spec 钉文案与布局：`floor-speech/voice/crowding`（现场台词与拥挤）、`typed-demand`、`overclaim`、`price-compare`（¥280 差价）、`tang-payback`（¥2,080）、`stock-transfer`、`trial-gate`、`visit-minutes`、`expiry-check`、`advance-order`（垫货 ¥686）、`dawn-order`、`bundle-ask`、`closing-foot`、`consultation-layout/gameplay`（46%/48% 抽屉、脚部固定层）、`status-clearance`、`one-sentence`、`finale-foot`、`brief-fold/foot`、`mobile-release`

### 3.3 沙盘 e2e（`playwright.floor.config.ts` → `rescue-e2e/*.spec.ts`，20 个；webServer 起的是根 dev server）

`counter.spec.ts` 是主金档：L33-41 按人名钉提问文案表、L55-61 钉逐日「人/产品/连带」表、L63-66 钉两条断货句原文、L120 `¥14,770`、L126 `¥22,930`、L129 `ledgerYuan=22,930`、L133 `五日 ¥21,000 已经做到`、L136 `evidence=12`、中途 reload 不丢档。其余 19 个 spec 钉竞品回响、半脸锚点、牌面引文、柜台话术、脚部布局等。

### 3.4 根 `tests/`

`floor-stage.test.ts` 钉沙盘几何（clearLine/站位）；`rush-rules.test.ts` 钉 rush 模式状态机——与章节无关，**但 `rush-rules.ts` L14 `CAST`/L16 `PRODUCT_IDS` 引用了 CustomerId/ProductId 联合，类型扩展时它必须跟着改**（改 id 为全局联合不影响它，因它自带白名单）。

### 3.5 多章节改造会碰到什么 & 怎么防误伤

会动的测试面，按冲击排序：

1. **`Object.keys(CUSTOMERS)` 的迭代面**（campaign-rules L38/51/65、consult-chat 各全员循环、floor-speech L8、run/blitz/match 池）：新顾客自动被 lint 覆盖——这是好事，等于免费的内容校验；但它也意味着**新章顾客一旦进联合类型就必须内容齐备**（问题表、deflection、唯一正解、预算上限）。
2. **种子派生面**：`week-1:10`、`seed=s1`、`flow-a/b` 的队列/目标全部随 `CUSTOMERS` 键集变化。**对策：给模式池加显式白名单**（`pack.modes?.pool` 或 `Customer.playableIn`），第一章期冻结为现有 10 id，e2e 种子断言原样存活；后续要扩池是显式 PR+同步断言（run-flow L4 的注释本来就要求这么干）。
3. **`PRODUCT_IDS` 字面量面**：DuelGame L23、MatchGame L28、BlitzGame L17、rush-rules L16 四处三品列表；`match.ts` L112 stock 字面量。统一改成 `Object.keys(PRODUCTS)` 或货架访问器。
4. **存档面**：`stock` 校验改 pack 化时，blitz `stock:{...WEEK_ALLOCATION}`（blitz.ts L143）与测试里手搭的 `{stock:{soft:…,glow:…,repair:…}}`（如 campaign-rules L117）都要走 `stockOf`/`Partial` 新形态——tsc 会兜住 src 里的，**测试文件跑 strip-types 不做类型检查**，漏改会以「校验拒收」的形式爆在测试运行时，得靠跑测发现。
5. **文案钉字面量**：结局标题、晨会句式、`complianceWord` 四档、`SPLIT_WORD` 等都被逐字断言；章节化只做「挪位置」不该动任何字符串，第一章 pack 的文案应保持逐字节一致。
6. **`DAYS` 直读面**：`CounterGame.tsx` L97-98、`DuelGame.tsx` L97 改走 `weekOf`/`pack.days`；`src/sim/` 旧代码也读 `DAYS`（保留参考不加载，但若 `CustomerId`/`DayStory` 变形它要跟着编译——顺手改或钉死它 import 的仍是旧导出别名）。
7. **日次字面量面**：1.6 已列全（`>=5`/`===4`/`===5`/`fromDay`/`STRUCTURE_FROM_DAY`/`progressTarget` 截断 5）。

防误伤的三道闸，建议作为章节化的前置：

- **键序钉**：新增一条「`Object.keys(CUSTOMERS)` 前 10 个 === 现有 id 数组」的测试（类似 DEFLECTION_TRUTH 的写法），锁住轮转偏移与洗牌池输入。
- **第一章黄金fixture**：`clean-route.ts` 的路线断言已钉全部关键数；把它改造成可对任意 pack 跑（`runRoute(pack)`），第一章断言字面量一个不动。
- **第一章 pack 化 = 零行为变更 PR**：`campaign.ts` 顶部导出保持原签名（`CUSTOMERS`/`DAYS`/`TARGET`…全部 re-export 自 ch1 pack），外部 import 一处不改——所有测试应当**不改一行就绿**，这是最硬的等价性检查。

---

## 4. 两个 UI 与四个模式要跟着改什么

### 4.1 根沙盘 `src/CounterGame.tsx`

- `DAYS[game.day-1]`（L97-98）→ `weekOf(game)` / `pack.days`；`第 {day} / 5 天`（L310）→ `week.length`；`05 DAYS ¥21,000`（L346）→ `pack` 的章节铭牌数据；`game.day === 5`（L436）→ `day >= week.length`。
- `ART_ALIAS`（L35）→ 挪进 `Customer` 定义（如 `artAlias?: CustomerId`），`customerArt` 自动认新章别名；第一章行为不变。
- `CHAPTER_HOOKS`（Experience.tsx L6-13）→ `pack.hooks`；`questionChoices` 保留，靠键序钉防回归。
- `STAFF` 表（L21）暂全局共用同一店同事；若后续章节换店，再加 `pack.staff`。
- 竞品打断 L100-101：`RIVAL_INTERRUPTIONS` 类型从三键 Record 改 `Partial<Record<CustomerId,…>>`，`RIVAL_IDS` 由 `pack.rivalIds` 供。
- 产品选择器（L409 区域）已遍历 `Object.keys(PRODUCTS)` → 改遍历 `pack.products`（本章货架），免得第五章把口红摆上第一章柜台。雪碧 CSS 同步改按 id 单图（见 2.4）。
- 沙盘地板 2 站位约束 → 内容 lint 兜住（2.8）。
- 保持红线：不从 `src/App.tsx`/`src/sim/` 旧栈接任何逻辑（AGENTS.md 明令）。

### 4.2 手机版 `src/Prototype.tsx`

改造空间比沙盘小——它已经走 `weekOf`/`targetOf`/`week.length`，且 `ClassicMeta`（L40-52）就是章节化的现成插口：选章开局 = 注入 `meta.fresh = () => initialFor(chN)`、`meta.weekLabel/targetLabel` 来自 `pack.copy`。**推荐做法：经典屏按「当前章节存档」读 pack，入口加一个章节选择薄层（或 `?chapter=ch2`），meta 语义原样。**

待改残留：

- L143 的 `shen||zhou||returning` 字面量改为 `RIVAL_INTERRUPTIONS[customerId]` 存在性判断（顺手消掉一个现存异味）。
- 开场 L403-404「五日章节/五日销售目标/开始新品活动周」、结局 L500-501 人名与「五日因果账本」、L580「五日目标」fallback → `pack.copy`。
- 产品格 L462 遍历 `pack.products`；`product-art-${id}` CSS 改按 id 图。
- `staffOnFloor` L545 → `pack.floorStaff ?? ["luyao","roman"]`。
- `customerHome`（floorLife.ts L25-29）保持两位有效区分；配合 2.8 的 lint 约束即可。
- cue 固定三处（L445）——若新章要第四个观察点，需要 `CueId` 扩值 + 两端 CSS 定位 + 美术模板加锚点；建议 25 位新顾客仍只用三点位（spec 允许线索不长在脸上，如赵女士/段小姐）。
- 保护边界：`src/App.tsx`/`main.tsx`/`mobile/*`/`vite.config.ts`/worker 等 28 个文件在 `mobile-runtime.lock.json` 里钉 hash，**章节化不需要碰它们任何一个**；`npm run check:runtime` 必须保持绿。

### 4.3 duel

- `DuelGame.tsx` L97 `DAYS[day-1]` → `weekOf`；L23 `PRODUCT_IDS` → 货架。
- `duel.ts` L142/284 的 `as "shen"|"zhou"|"returning"` 强转消失（interruptions 改 Partial 后正常索引）。
- `duelDeck` 对任何有 `QUESTIONS` 的顾客自动工作；新章顾客直接可打。
- `DUEL_SAVE_KEY` 建议存档里带 `chapter` 字段（Campaign 本来就有），牌局开局 `initialFor(chapter)`；duel-sim 四条平衡路线继续钉第一章。
- 风险点：duel 的「五日」局内循环（开局→第 5 天结局）要接受 `pack.days.length`。

### 4.4 run

- `RUN_POOL`（run.ts L16）改白名单（3.5-2），否则 `week-1:10` 种子断言和 `runTarget` 公式输入都会变。
- `runWeek` 固定 5 天（L28-40 `sizes=[1,1,1,1,1]`、cap 3）——模式即「一周」，不必跟章节天数走；`parseCampaign` 的 `week.length≤5` 改为 ≤章节上限后不变。
- `nextRunSeed`/`perkChoices` 与章节无关。
- 设计问题待答：第二章顾客进不进周目池？建议进池做成显式开关（`Customer.playableInRun` 或 pack 的 `runPool`），默认冻结现状。

### 4.5 match

- `startMatch` 队列池与 `rivalPick` 已遍历全 PRODUCTS/CUSTOMERS——新内容自动生效，**但 L112 的 `stock:{soft:99,glow:99,repair:99}` 字面量在 ProductId 扩展时编译即红**（Record 全键）或运行时静默缺货（Partial 化后），统一走 `stockOf`。
- `week:[{day:1,…}]` 单日塞 6-8 人写法兼容章节，只需决定用哪章货架（建议 `match` 参数化 pack，默认 ch1）。
- `MATCH_SAVE_KEY` 内嵌整份 Campaign → chapter 字段随档即可。
- `RIVAL_FLAG="rival:"` 与 `rivalIds` 集合解耦即可（对抗局里陆遥是玩家对手，不是某顾客的插话事件）。

### 4.6 blitz

- `BLITZ_POOL` 过滤 `!rival` 自动纳入新章非竞品顾客 → `seed=s1` 队列断言会红；同样先冻结池。
- `BLITZ_DAY=6` 的「钉在不存在的日次」技巧在章节制下仍成立（任何章的 `day` 都 ≤5）。
- `stock:{...WEEK_ALLOCATION}`（L143）→ `pack.allocation`。
- `BLITZ_BEST_KEY` 纪录槽带 `version:9` 自有协议，无需动。

### 4.7 rush（根 `?mode=rush`）

独立 90 秒小游戏，`CAST`/`STATIONS`/`PRODUCT_IDS` 全自有白名单——可以永远只玩第一章阵容，不阻塞主线。要扩时再说，优先级最低。

---

## 5. 美术素材盘点与新增 25 位顾客的工作量

### 5.1 现网资产地图

| 层 | 路径 | 规格（实测 sips） | 每顾客需要 |
|---|---|---|---|
| 咨询近景（手机版用） | `dynamic-counter-prototype/public/assets/game/customer-{id}-consultation.png` | **853×1844**，7 张在网 | 每**形象** 1 张 |
| 咨询近景（沙盘用） | `public/assets/aurora/customer-{id}-consultation.png` → `public/assets/optimized/{name}.webp` + `-thumb.webp` | 853×1844 源 + webp + 148px 缩略 | 同上图的另一条管线（`scripts/optimize-art.mjs`，需本地 cwebp） |
| 沙盘地板小人 | `public/assets/chibi/{id}.png` | **256×384**，13 张（7 顾客+6 员工） | 每形象 1 张，或 `ART_ALIAS` 复用 |
| 手机版地板 | `toy-customers-walk.png` 1536×1024（4 帧×2 体型）+ `<img>` 徽章用咨询图 | 共享年轻/熟龄两体型 | **0 张新走路图**——只需 `mapVariant` + 徽章 |
| 员工 | `staff-portraits/{name}.png` + `aurora/{name}.png` + `chibi/{id}.png` | 384×512 半身 | 新同事才需要 |
| 产品 | `product-trio.png` 1402×1122（两端+沙盘 webp） | 三件横排条带 | 新产品 1 张或扩条带 |
| 场景 | `counter-stage-toy.png`/`counter-stage.png` | 853×1844 | 换店才需要 |

变体复用现状：`returning`/`zhou2`/`anjie2` 咨询图与沙盘 chibi 全部复用本尊——**10 个 CustomerId 只对应 7 套顾客资产**，这条先例说明「新顾客 id ≠ 新图」。

### 5.2 出图模板与管线

- **有模板**：`dynamic-counter-prototype/art/templates/` 三张对板（`walk-cell-384x512.png`、`consultation-853x1844.png`、`stage-waypoints-853x1844.png`），配套完整规范 `art/blender-export.md`（226 行）：脸必须落在高度 22%-52%，三个线索锚点 (278,686)/(432,815)/(618,834) ±20px，表情后缀约定（`-focus`/`-ask`/`-trial-pos`/`-trial-neg`/`-close`/`-leave`，**目前未实现，靠 CSS 滤镜模拟**），Blender 正交 384×512 走路格、3.0-3.5 头身比例、绮光米金/维珞深紫制服规范。
- **有脚本**：`scripts/optimize-art.mjs`（根）把 aurora/ 的 customer-*-consultation.png 转 `optimized/` webp + 148px 缩略并写 manifest.json；需要 `cwebp`。
- **没有的东西**：没有 .blend 源文件入库（模板只是 PNG 对板），没有批量生成脚本，表情变体全靠 CSS。_git log 里「Blender 美术模板」指的即 art/templates+规范文档_。

### 5.3 新增 25 位顾客的工作量估算

单位成本按「一个有名字的顾客形象」：

| 项 | 单价估计 | 备注 |
|---|---|---|
| 咨询近景 853×1844 | 1 张/人，重头 | 脸上三区（眼下/鼻翼/脸颊）要画得出问题所在（干纹/泛红/油光），锚点 ±20px 验收；无论 AI 出图还是 Blender 渲染都要按模板对板 QA |
| 沙盘 chibi 256×384 | 1 张/人（可复用体型换发型/服装） | 比近景便宜一档；回访变体 `artAlias` 复用可省 20-30% |
| 手机版地板 | 0 | 走 2 体型共享表 + 咨询图徽章 |
| 表情差分 | 0（暂不做） | 继续 CSS 滤镜；要做则 +2 张/人（trial-pos/neg 底线） |
| 内容数据 | ~70 行/人 | Customer 定义 + QUESTIONS 3-5 条 + cues 3 组 + deflection + （可选）payback/sampleReturn/插话文案 |
| 测试表项 | ~15 行/人 | DEFLECTION_TRUTH、TYPED/WHITE_ASK 增补 |
| 管线杂活 | 自动化 | 双端拷贝 + optimize-art 跑一遍 + manifest 更新 |

25 位总账：**25 张咨询近景（重资产）+ ~18-25 张 chibi + ~1,800-2,200 行内容数据 + ~400 行测试表项**。若 4-5 章、每章 5-8 人的计划成立，这就是上限 40 人左右规模里先做的 25 人；建议第一章之外每章也留 1-2 个「同人多版本」位（复用图），既省美术也符合现有「回来的人换了需求」的叙事手法。新产品每支再加 1 张产品图 + 三处展示点改造（一次性，见 2.4）。

---

## 6. 分阶段实施计划

每阶段独立合并、测试全绿；按依赖顺序排。改动量为粗估（行/文件数），不含美术。

### 阶段 0 · 黄金钉板（无行为变更）

- 新增 `tests/chapter-content.test.ts`（暂名）：钉 `Object.keys(CUSTOMERS)` 键序前 10 项、CUSTOMERS↔QUESTIONS↔deflection 全覆盖、`DELIVERIES` 合计=`WEEK_ALLOCATION`（已有则复用）。
- `clean-route.ts` 保持不动（它就是第一章金档）。
- 改动：+1 测试文件 ~80 行。**风险：无。**
- 验证：`cd dynamic-counter-prototype && npm run test:rules`。

### 阶段 1 · 注册表骨架 + 第一章 pack（等价重构）

- 新增 `src/content/types.ts`（ChapterPack）、`src/content/ch1.ts`（引用 campaign.ts 现有常量拼成 pack，**不挪数据**）、`src/content/index.ts`（`CHAPTERS`/`chapterOf`/`packOf`）。
- `campaign.ts` 增量：`Campaign.chapter?: string`、`chapterOf`/`packOf` 访问器；`floorCustomers`/`dayEvent`/`applyDawn`/`dawnNotices`/`counterCheck`/`applyMemberRepeat`/`applyFinale`/`progressTarget` 内部改为「`pack` 钩子优先、缺省落第一章逻辑」——**注意第一版可以更简单：canonical（无 week 无 chapter）完全走老路，pack 钩子只在 `s.chapter` 非 ch1 时生效**，等价性最稳。
- `INITIAL` 不动；新增 `initialFor(id)`（`INITIAL` + `chapter` + `waitMeters` 从 pack 首日排程填）。
- 改动：campaign.ts ±120 行（包成小改），content/ +3 文件 ~150 行。**风险：中——顺序/引用环**。注意 ch1.ts import campaign.ts 会成环：解法是让 pack 只存**引用与函数指针**，规则函数仍在 campaign.ts（`dayEvent` 本体留原文件，ch1 pack 的 `dayEvent` 字段指向它）。E2E 全绿即等价。
- 验证：`npm run test:rules && npm run build` + 全量 playwright。

### 阶段 2 · 存档与「5」泛化（仍是单章可见行为不变）

- `SAVE_VERSION` 7→8；`Campaign.chapter` 入档；`parseCampaign` 全部界值改 `packOf(s).days.length`/`pack.allocation`；v7 加法迁移为 `chapter:"ch1"`。
- `startNextDay`/`touchThreads`/`applyMemberRepeat`/`progressTarget`/`STRUCTURE_FROM_DAY` 等 1.6 列出的字面量改读 `weekOf(s).length`/`pack.dayTargets`。
- `RIVAL_INTERRUPTIONS` 类型放宽为 `Partial<Record<CustomerId,…>>`，消掉 `duel.ts` L284 与 `Prototype.tsx` L143 两处强转/字面量。
- 改动：campaign.ts ~60 行、duel/Prototype 各几行、测试加 v7→v8 迁移用例 ~40 行。**风险：中——存档兼容**；用现有 v2 迁移用例同款手法测 v7。
- 验证：test:rules + 两个 spec 套件里的存档断言（campaign.spec/counter.spec 的 reload 段）。

### 阶段 3 · 产品目录化（N 支的地基，仍只卖 3 支）

- `stock` → `Partial<Record<ProductId,number>>` + `stockOf`；`DELIVERIES`/`WEEK_ALLOCATION`/`FIRST_DAY_STOCK` 收进 pack（re-export 老名）；`deliveryWord`/`applyDawn`/两处 UI 产品遍历改 `pack.products`。
- match.ts L112、blitz.ts L143、DuelGame/MatchGame/BlitzGame 的 `PRODUCT_IDS`、rush 的 `PRODUCT_IDS` 全部收口到货架访问器。
- 产品图改 `product-{id}.png` 单文件 + `productArtworkOf(id)`；三处 CSS 位移类删除（素材同时加三张单图，旧条带退役）。
- 改动：campaign.ts ~50 行、四模式 ~30 行、两端 CSS 各 ~15 行、美术 3 张新单图。**风险：中——stock 语义从全键变稀疏**，`parseCampaign` 与报价单 `game.stock[picked]` 读法要全查一遍（tsc 可兜 src，测试靠跑）。
- 验证：全量测试 + `stock-transfer.spec`/`bundle-ask.spec` 重点盯。

### 阶段 4 · UI 文案与楼层元数据化

- CounterGame：`/ 5 天`→`week.length`、开场铭牌/`CHAPTER_HOOKS`/`ART_ALIAS`→`pack`/`Customer.artAlias`。
- Prototype：残留「五日」文案 → `pack.copy`；`staffOnFloor`→`pack.floorStaff`；选章入口（`?chapter=` 或入口薄层）。
- 手机版座位数约束写成内容 lint：`pack.days[*].customers.length + 链式补位 ≤ 3`。
- 改动：CounterGame ~40 行、Prototype ~50 行、Experience ~20 行、lint ~40 行。**风险：低——主要是 e2e 文案断言，只挪不改字。**
- 验证：全量 + `rescue-e2e/counter.spec.ts` 金档。

### 阶段 5 · 第二章实装（第一个真章节）

- `content/ch2.ts`：3-5 天 DayStory、5-8 新顾客（新 id）、章目标/逐日线、配货表、可能 1 支新产品（如口红→新 Trait 档需配 `TRAIT_LABELS`+`DEMAND_HINTS`+lint 断言「可问出」）、晚间 `dayEvent` 代码、`paybacks`/`sampleReturns`/（可选）`interruptions`、结局文案。
- `clean-route.ts` 泛化为 `runRoute(pack)`，第二章写自己的清洁路线金档（先把「打得通且刚压线」的路线跑出来再写断言，照 AGENTS.md 的做法）。
- 美术：5-8 张咨询近景 + chibi（含复用变体）。
- 改动：ch2.ts ~400-700 行、测试 +150 行、美术 6-10 张。**风险：内容平衡**——目标价要按第二章客流预算标定（参考 run.ts 0.65-0.75 档与第一章 0.92 清洁线的差距），建议给每章配一个跑分模拟器脚本再写死数字。
- 验证：全量 + 新章 e2e 金档。

### 阶段 6 · 第三至五章 + 模式池决策

- 复制阶段 5 的模式；每章独立 PR。
- 再决定 run/match/blitz 池是否解锁新章顾客（改池=同步三个种子断言，明确写在 PR 里）。
- duel 若要「按章开局」，加 `?mode=duel&chapter=chN` 参数即可（`startDuel` 已全通用）。

### 阶段 7 · 美术管线补齐

- 表情差分（trial-pos/neg）如需真图：先在一位新顾客上试装，再铺开。
- `optimize-art.mjs` 已自动认新 `customer-*-consultation.png`；chibi 与手机版 `game/` 目录拷贝步骤可以写个小脚本收口（现在手工）。

---

## 7. 附：验证命令速查

```bash
# 规则单测（根或 proto 目录均可）
cd dynamic-counter-prototype && npm run test:rules
# 手机版 e2e（含金档 campaign.spec.ts）
cd dynamic-counter-prototype && npm run test:runtime
# 沙盘 e2e（rescue-e2e，起根 dev server）
cd dynamic-counter-prototype && npm run test:floor
# 根侧 rush/几何
npm run test:rush
# 运行时保护文件完整性（改完必须绿）
cd dynamic-counter-prototype && npm run check:runtime
# 构建（tsc 兜底 src 内类型；注意测试文件不在 tsc 范围）
cd dynamic-counter-prototype && npm run build
```

**给实施者的三条备忘**：
1. 第一章的每个数字（21,000 / DAY_TARGETS / 22,930 / 14,770 / 25,590 / 2,080 / 620 / 686 …）都有测试或 e2e 钉着，**重构阶段不改字面值是唯一安全做法**。
2. `CustomerId` 保持字面量联合 + 注册表合并 + 键序钉测试，是「让编译器替你审内容完整性」的免费方案；改成 `string` 会同时失去这层保护和 `src/sim/` 旧代码的编译。
3. 最容易漏的不是大表，是散落的日次字面量（1.6）与三处 `PRODUCT_IDS`/`stock` 字面量（3.5-3）；第二章第一天红的不数字，多半是这两类。
