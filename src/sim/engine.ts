import { closingFor, CUSTOMERS, dayCustomers, DAYS, fitFor, makeCustomer, makeReturnee, makeStaff, pendingReturn, PRODUCTS, REACTIONS, TARGET } from "./cast";
import type { Actor, ActorId, CloseChoice, CloseEvent, CustomerId, HistoryEntry, ProductId, SimLog, Snapshot, Speed, StaffAct, TomorrowPlan } from "./types";
import { nearestNode, pathTo, roomAt, standPoint, type NodeId } from "./world";

const START = 19 * 60;
const RUSH = 4 * 60;
const CLOSE_AT = 50;
const SPAWN_GAP = 8;

function clockOf(minutes: number) {
  const wrapped = ((Math.floor(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export class CounterSim {
  day = 1;
  minutes = START;
  speed: Speed = 1;
  sales = 0;
  daySales = 0;
  selectedId: ActorId = "xuyuan";
  servingId: CustomerId | null = null;
  servingProduct: ProductId | null = null;
  servingLeft = 0;
  orderId: ActorId | null = null;
  huntId: CustomerId | null = null;
  poachId: CustomerId | null = null;
  probeLeft = 0;
  luyaoCool = 0;
  huddleLeft = 0;
  huddleAt: number | null = null;
  huddleDone = false;
  gifts = 1;
  tonight = 0;
  plan: TomorrowPlan = {};
  helper: TomorrowPlan["helper"] = null;
  luyaoDelay = 6;
  helped = false;
  claimId: CustomerId | null = null;
  claimLeft = 0;
  spawnQueue: Array<{ at: number; id: CustomerId }> = [];
  flags: string[] = [];
  history: HistoryEntry[] = [];
  logs: SimLog[] = [];
  actors: Actor[] = [];
  close: CloseEvent | null = null;
  closePicked: CloseChoice | null = null;
  finale = false;
  idSeq = 1;
  private listeners = new Set<() => void>();

  constructor() {
    this.bootDay(1);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
    this.emit();
  }

  select(id: ActorId) {
    this.selectedId = id;
    this.emit();
  }

  command(id: ActorId) {
    const you = this.actor("xuyuan");
    const target = this.actors.find(item => item.id === id);
    if (!you || !target) return;
    if (this.huddleLeft > 0) {
      this.say(you, "先从会场走开。");
      this.emit();
      return;
    }
    this.selectedId = id;
    if (target.kind !== "customer") {
      this.emit();
      return;
    }
    if (target.status === "sold" || target.status === "lost") {
      this.emit();
      return;
    }
    if (this.servingId && this.servingId !== target.id) this.abortServe();
    this.probeLeft = 0;
    this.orderId = target.id;
    this.send(you, target.home, `走向${target.name}`);
    this.say(you, "我先过去。");
    if (this.claimId === target.id) this.cancelClaim("许愿回来了");
    this.emit();
  }

  cancel() {
    const you = this.actor("xuyuan");
    if (!you) return;
    if (this.huddleLeft > 0) {
      this.leaveHuddle();
      return;
    }
    if (this.servingId) this.abortServe();
    this.probeLeft = 0;
    this.orderId = null;
    this.send(you, "xuyuan", "等你下令");
    this.emit();
  }

  probe() {
    const you = this.actor("xuyuan");
    const customer = this.actors.find(item => item.id === this.selectedId && item.kind === "customer");
    if (!you || !customer || this.huddleLeft > 0) return;
    if (customer.status === "sold" || customer.status === "lost") return;
    if (customer.clues.length >= customer.cluePool.length) return;
    if (!this.near(you, customer, 10)) {
      this.command(customer.id);
      this.emit();
      return;
    }
    this.probeLeft = 4;
    this.orderId = customer.id;
    you.label = `在看${customer.name}`;
    this.say(you, "先看她在干什么。");
    this.emit();
  }

  sell(product: ProductId) {
    const customer = this.actors.find(item => item.id === this.selectedId && item.kind === "customer");
    const you = this.actor("xuyuan");
    if (!customer || !you || customer.status === "sold" || customer.status === "lost" || customer.status === "refund") return;
    if (this.huddleLeft > 0) {
      this.say(you, "罗曼把人叫走了，现在走不开。");
      this.emit();
      return;
    }
    if (!this.near(you, customer, 10)) {
      this.command(customer.id);
      this.emit();
      return;
    }
    if (customer.tried.includes(product)) {
      this.say(you, "这支她刚试过。");
      this.emit();
      return;
    }
    if (this.servingId === customer.id && this.servingProduct && this.servingLeft > 1.2) {
      this.servingProduct = product;
      you.label = `为${customer.name}试${PRODUCTS.find(item => item.id === product)?.short}`;
      this.emit();
      return;
    }
    this.probeLeft = 0;
    this.servingId = customer.id as CustomerId;
    this.servingProduct = product;
    this.servingLeft = 3.2;
    this.orderId = customer.id;
    customer.status = "serving";
    customer.label = "试妆中";
    this.send(you, customer.home, `为${customer.name}试${PRODUCTS.find(item => item.id === product)?.short}`);
    this.send(customer, customer.home, "在试妆");
    this.emit();
  }

  gift() {
    const customer = this.actors.find(item => item.id === this.selectedId && item.kind === "customer");
    const you = this.actor("xuyuan");
    const luyao = this.actor("luyao");
    if (!customer || !you || this.gifts <= 0 || this.huddleLeft > 0) return;
    if (customer.status === "sold" || customer.status === "lost" || customer.status === "refund") return;
    this.gifts -= 1;
    customer.gifted = true;
    customer.patience = Math.min(customer.maxPatience, customer.patience + 2);
    if (luyao && (this.huntId === customer.id || this.poachId === customer.id || customer.threatLeft > 0)) {
      this.interruptHunt(customer, luyao);
    }
    this.say(you, "最后一套给你。");
    this.pushLog(`赠品给了${customer.name}`, "柜子空了。");
    this.emit();
  }

  act(id: string) {
    const you = this.actor("xuyuan");
    if (!you || this.close) return;
    if (id === "back") {
      this.cancel();
      return;
    }
    if (id === "contest") {
      const target = this.claimId ?? this.huntId;
      if (target) this.command(target);
      return;
    }
    if (id === "let-luyao") {
      if (this.orderId && this.orderId === this.huntId) this.cancel();
      this.emit();
      return;
    }
    if (id === "yield-claim" && this.claimId) {
      const guest = this.actor(this.claimId);
      if (guest) this.tangkeTake(guest);
      this.emit();
      return;
    }
    if (id === "ask-suman") {
      const suman = this.actor("suman");
      const idle = this.liveCustomers().find(item => item.status === "waiting" && item.held <= 0 && item.refund <= 0 && item.id !== this.servingId);
      if (!suman || !idle) {
        this.emit();
        return;
      }
      if (this.helper === "suman" || this.flags.includes("cover-suman")) {
        this.helped = true;
        this.send(suman, idle.home, `替你拖着${idle.name}`);
        idle.held = 12;
        idle.label = "被苏蔓拖住";
        this.say(suman, "先去忙你的。");
        this.pushLog("苏蔓帮你拖客", `${idle.name}暂时不会走。`);
      } else {
        this.say(suman, "先把你手头的单做完。");
      }
      this.emit();
      return;
    }
    if (id === "to-checkout") {
      this.orderId = null;
      this.send(you, "checkout", "去收银");
      this.emit();
    }
  }

  leaveHuddle() {
    if (this.huddleLeft <= 0) return;
    this.huddleLeft = 0;
    this.flags.push("left-huddle");
    const you = this.actor("xuyuan");
    const roman = this.actor("roman");
    if (you) {
      this.send(you, "xuyuan", "提前离会");
      this.say(you, "我先回去。");
    }
    if (roman) {
      this.send(roman, "roman", "柜长");
      this.say(roman, "你自己看着办。");
    }
    this.pushLog("许愿提前离会", "罗曼记下了。过道上的人还在。");
    this.emit();
  }

  pickClose(id: string) {
    if (!this.close) return;
    const choice = this.close.choices.find(item => item.id === id);
    if (!choice) return;
    this.closePicked = choice;
    this.flags.push(choice.id);
    this.plan = { ...choice.tomorrow };
    this.history.push({ day: this.day, text: `${choice.result} ${choice.detail}` });
    this.pushLog(choice.label, choice.detail);
    if (choice.id === "yield-tang") {
      this.sales = Math.max(0, this.sales - 490);
      this.daySales = Math.max(0, this.daySales - 490);
    }
    this.emit();
  }

  nextDay() {
    if (this.day >= 5) {
      this.finale = true;
      this.pushLog("五日结束", this.sales >= TARGET ? "数字够了。账本也留下了。" : "数字没够。有些人不会再来。");
      this.emit();
      return;
    }
    this.day += 1;
    this.daySales = 0;
    this.close = null;
    this.closePicked = null;
    this.servingId = null;
    this.bootDay(this.day);
    this.emit();
  }

  restart() {
    this.day = 1;
    this.sales = 0;
    this.daySales = 0;
    this.flags = [];
    this.history = [];
    this.logs = [];
    this.finale = false;
    this.close = null;
    this.closePicked = null;
    this.gifts = 1;
    this.plan = {};
    this.bootDay(1);
    this.emit();
  }

  tick(dtMs: number) {
    if (this.speed === 0 || this.finale) return;
    const dt = (dtMs / 1000) * this.speed;
    if (!this.close) this.minutes += dt;
    for (const actor of this.actors) this.move(actor, dt);
    this.separate();
    if (this.close) {
      this.emit();
      return;
    }
    this.spawnTick();
    this.drain(dt);
    if (this.luyaoCool > 0) this.luyaoCool = Math.max(0, this.luyaoCool - dt);
    this.chase(dt);
    this.claimTick(dt);
    this.probeTick(dt);
    this.serveTick(dt);
    this.refundTick(dt);
    if (this.huddleAt !== null && !this.huddleDone && this.minutes >= this.huddleAt) this.beginHuddle();
    if (this.huddleLeft > 0) {
      this.huddleLeft = Math.max(0, this.huddleLeft - dt);
      if (this.huddleLeft <= 0) this.endHuddle();
    }
    this.staffIdle();
    if (this.rushOver() && !this.close) this.beginClose();
    this.emit();
  }

  snapshot(): Snapshot {
    const story = DAYS[this.day - 1];
    return {
      day: this.day,
      title: story?.title ?? "",
      clock: clockOf(this.minutes),
      phase: this.finale ? "最终档案" : this.close ? "闭店" : this.huddleLeft > 0 ? "柜长开会" : "晚高峰",
      speed: this.speed,
      sales: this.sales,
      daySales: this.daySales,
      target: TARGET,
      selectedId: this.selectedId,
      servingId: this.servingId,
      orderId: this.orderId,
      huntId: this.huntId,
      probeLeft: this.probeLeft,
      gifts: this.gifts,
      tonight: this.tonight,
      kept: this.actors.filter(item => item.kind === "customer" && item.status === "sold").length,
      queued: this.spawnQueue.length,
      huddleLeft: this.huddleLeft,
      claimId: this.claimId,
      acts: this.staffActs(),
      rushOver: this.rushOver(),
      close: this.close,
      closePicked: this.closePicked,
      finale: this.finale,
      logs: this.logs.slice(0, 8),
      history: this.history,
      actors: this.actors,
    };
  }

  private bootDay(day: number) {
    this.minutes = START;
    this.huddleLeft = 0;
    this.servingId = null;
    this.servingProduct = null;
    this.orderId = null;
    this.huntId = null;
    this.poachId = null;
    this.probeLeft = 0;
    this.luyaoCool = 0;
    this.huddleDone = false;
    this.gifts = Math.max(0, this.gifts + (this.plan.giftsDelta ?? 0));
    this.helper = this.plan.helper ?? null;
    this.luyaoDelay = this.plan.luyaoDelay ?? 6;
    this.helped = false;
    this.claimId = null;
    this.claimLeft = 0;
    this.spawnQueue = [];
    const extra = this.plan.extra;
    this.plan = {};
    const staff = makeStaff().filter(item => item.id !== "fangmin" || day === 5);
    staff.forEach(item => {
      const stand = standPoint(item.home, item.id);
      item.x = stand.x;
      item.y = stand.y;
      item.destX = stand.x;
      item.destY = stand.y;
      item.goal = item.home;
      item.path = [];
      item.label = item.id === "xuyuan" ? "等你下令" : item.role;
    });
    const refund = pendingReturn(this.flags);
    const ids = dayCustomers(day, this.flags);
    if (extra && !ids.includes(extra)) ids.push(extra);
    const opening: Actor[] = [];
    if (refund && !ids.includes(refund.id)) {
      const back = makeReturnee(refund.id, refund.amount);
      this.send(back, "checkout", "退货");
      opening.push(back);
    }
    if (ids[0]) {
      const first = makeCustomer(ids[0], opening.length);
      this.send(first, first.home, "进店");
      opening.push(first);
    }
    this.spawnQueue = ids.slice(1).map((id, index) => ({ at: START + SPAWN_GAP * (index + 1), id }));
    this.tonight = ids.length + (refund && !ids.includes(refund.id) ? 1 : 0);
    this.huddleAt = day === 3 ? START + 25 : day < 5 && day !== 1 && Math.random() < 0.35 ? START + 18 : null;
    this.actors = [...staff, ...opening];
    this.selectedId = "xuyuan";
    this.pushLog(`第 ${day} 天 · ${DAYS[day - 1].title}`, opening.filter(item => item.kind === "customer").map(item => item.name).join("、") + "先到了中庭。");
  }

  private actor(id: ActorId) {
    return this.actors.find(item => item.id === id);
  }

  private liveCustomers() {
    return this.actors.filter(item => item.kind === "customer" && item.status !== "sold" && item.status !== "lost");
  }

  private rushOver() {
    const guests = this.actors.filter(item => item.kind === "customer");
    if (!guests.length) return false;
    const done = this.spawnQueue.length === 0 && guests.every(item => item.status === "sold" || item.status === "lost");
    const floorClear = done && this.minutes >= START + CLOSE_AT;
    const timedOut = this.minutes >= START + RUSH && !this.servingId && !guests.some(item => item.refund > 0 && item.status !== "lost");
    return floorClear || timedOut;
  }

  private drain(dt: number) {
    for (const guest of this.liveCustomers()) {
      if (guest.status === "entering" && this.arrived(guest)) {
        guest.status = guest.refund > 0 ? "refund" : "waiting";
        guest.label = guest.refund > 0 ? "退货" : guest.rival ? "在对比" : "在等";
      }
      if (guest.held > 0) {
        guest.held = Math.max(0, guest.held - dt);
        if (guest.held > 0) continue;
        if (guest.status === "waiting") guest.label = guest.rival ? "在对比" : "在等";
      }
      if (guest.id === this.servingId || guest.refund > 0) continue;
      guest.patience = Math.max(0, guest.patience - dt * 0.045);
      if (guest.patience <= 1.2 && guest.label !== "要被带走") guest.label = "要走了";
      if (guest.patience <= 0) this.lose(guest.id as CustomerId, CUSTOMERS[guest.id as CustomerId].lostLine);
    }
  }

  private chase(dt: number) {
    const luyao = this.actor("luyao");
    const you = this.actor("xuyuan");
    if (!luyao) return;
    if (this.luyaoCool > 0) {
      this.huntId = null;
      if (luyao.goal !== "luyao") this.send(luyao, "luyao", "先退一步");
      return;
    }
    if (this.minutes < START + this.luyaoDelay) return;
    const mark = this.liveCustomers().find(item => item.rival && item.status === "waiting" && item.id !== this.servingId && item.refund <= 0);
    this.huntId = mark?.id as CustomerId ?? null;
    if (!mark) {
      if (luyao.goal !== "luyao") this.send(luyao, "luyao", "在维珞观察");
      return;
    }
    if (you && this.near(you, mark, 10) && (this.orderId === mark.id || this.servingId === mark.id)) {
      if (mark.threatLeft > 0) this.interruptHunt(mark, luyao);
      return;
    }
    if (luyao.goal !== mark.home) this.send(luyao, mark.home, `靠近${mark.name}`);
    if (this.huddleLeft > 0) return;
    if (!this.arrived(luyao) || !this.near(luyao, mark, 10)) return;
    if (this.poachId === mark.id && mark.threatLeft <= 0) {
      this.poachId = null;
      this.lose(mark.id as CustomerId, CUSTOMERS[mark.id as CustomerId].lostLine);
      this.say(luyao, "这单我带走了。");
      return;
    }
    if (this.poachId !== mark.id) {
      mark.threatLeft = 6;
      mark.label = "要被带走";
      this.poachId = mark.id as CustomerId;
      this.say(luyao, "这单我也可以做。");
      this.pushLog("陆遥开始截胡", `${mark.name}头上还有六秒。`);
      return;
    }
    mark.threatLeft = Math.max(0, mark.threatLeft - dt);
  }

  private interruptHunt(mark: Actor, luyao: Actor) {
    mark.threatLeft = 0;
    if (mark.status === "waiting") mark.label = mark.rival ? "在对比" : "在等";
    this.luyaoCool = 8;
    this.huntId = null;
    this.poachId = null;
    this.send(luyao, "luyao", "被拦住");
    this.say(luyao, "行，你先。");
    this.pushLog(`拦住陆遥`, `${mark.name}还在。`);
  }

  private probeTick(dt: number) {
    if (this.probeLeft <= 0) return;
    const you = this.actor("xuyuan");
    const customer = this.actors.find(item => item.id === this.orderId && item.kind === "customer");
    if (!you || !customer || !this.near(you, customer, 10)) return;
    this.probeLeft = Math.max(0, this.probeLeft - dt);
    if (this.probeLeft > 0) return;
    const next = customer.cluePool.find(line => !customer.clues.includes(line));
    if (next) {
      customer.clues.push(next);
      this.say(you, next);
      this.pushLog(`看了${customer.name}一眼`, next);
    }
    if (you.label.startsWith("在看")) you.label = `站在${customer.name}身边`;
  }

  private serveTick(dt: number) {
    if (!this.servingId || !this.servingProduct) return;
    const customer = this.actor(this.servingId);
    const you = this.actor("xuyuan");
    if (!customer || !you) return;
    if (!this.near(you, customer, 12)) return;
    this.servingLeft -= dt;
    customer.speechLeft = Math.max(customer.speechLeft, 1);
    if (this.servingLeft > 0) return;
    const product = PRODUCTS.find(item => item.id === this.servingProduct)!;
    let fit = fitFor(customer, product.id);
    if (fit === "poor" && customer.gifted) {
      fit = "good";
      customer.gifted = false;
    }
    customer.tried.push(product.id);
    this.servingId = null;
    this.servingProduct = null;
    if (fit === "poor") {
      customer.status = "waiting";
      customer.label = "摇头";
      customer.speech = REACTIONS[product.id].bad;
      customer.speechLeft = 8;
      customer.patience = Math.max(1.2, customer.patience * 0.5);
      this.orderId = customer.id;
      this.say(you, "换一支。");
      this.pushLog(`${customer.name}摇头`, `${product.short}不对，她还在。`);
      return;
    }
    const good = fit === "good";
    const amount = good ? customer.sale : customer.wrongSale;
    customer.status = "sold";
    customer.threatLeft = 0;
    customer.label = good ? "成交" : "勉强买单";
    customer.speech = good ? REACTIONS[product.id].good : REACTIONS[product.id].bad;
    customer.speechLeft = 8;
    this.sales += amount;
    this.daySales += amount;
    this.flags.push(`served:${customer.id}:${good ? "good" : "risky"}`);
    if (!good) this.flags.push(`return:${customer.id}:${amount}`);
    this.history.push({ day: this.day, text: `${customer.name}${good ? "买了对的" : "被推了不合适的"} · ${product.short} ¥${amount}` });
    this.pushLog(good ? `${customer.name}成交` : `${customer.name}勉强买单`, `${product.short} +¥${amount.toLocaleString("zh-CN")}`);
    this.send(customer, "exit", customer.label);
    this.send(you, "xuyuan", "等你下令");
    this.orderId = null;
    this.say(you, good ? "这单站得住。" : "数字有了，明天可能退。");
  }

  private refundTick(dt: number) {
    const back = this.actors.find(item => item.kind === "customer" && item.refund > 0 && item.status !== "sold" && item.status !== "lost");
    if (!back) return;
    const you = this.actor("xuyuan");
    if (back.status === "refund" && this.arrived(back) && this.servingId !== back.id) {
      if (this.servingId) this.abortServe();
      this.servingId = back.id as CustomerId;
      this.servingProduct = null;
      this.servingLeft = 8;
      this.orderId = back.id;
      if (you) {
        this.send(you, "checkout", `处理${back.name}退货`);
        this.say(you, "昨天那单回来了。");
      }
      this.pushLog(`${back.name}来退货`, `−¥${back.refund.toLocaleString("zh-CN")}`);
    }
    if (this.servingId !== back.id || this.servingProduct) return;
    if (you && !this.near(you, back, 12)) return;
    this.servingLeft -= dt;
    if (this.servingLeft > 0) return;
    this.sales = Math.max(0, this.sales - back.refund);
    this.daySales = Math.max(0, this.daySales - back.refund);
    this.flags.push(`refunded:${back.id}`);
    this.history.push({ day: this.day, text: `${back.name}退货 −¥${back.refund}` });
    back.status = "lost";
    back.label = "已退";
    this.send(back, "exit", "已退");
    this.servingId = null;
    this.orderId = null;
    if (you) this.send(you, "xuyuan", "等你下令");
  }

  private lose(id: CustomerId, line: string) {
    const customer = this.actor(id);
    if (!customer || customer.status === "sold" || customer.status === "lost") return;
    customer.status = "lost";
    customer.label = "离开";
    customer.threatLeft = 0;
    customer.speech = line;
    customer.speechLeft = 8;
    if (customer.refund > 0 && !this.flags.includes(`refunded:${id}`)) {
      this.sales = Math.max(0, this.sales - customer.refund);
      this.daySales = Math.max(0, this.daySales - customer.refund);
      this.flags.push(`refunded:${id}`);
    }
    this.flags.push(`lost:${id}`);
    this.history.push({ day: this.day, text: line });
    this.pushLog(line, "你把注意力给了别处。");
    this.send(customer, customer.rival ? "velora" : "exit", "离开");
    if (this.servingId === id) {
      this.servingId = null;
      this.servingProduct = null;
      this.probeLeft = 0;
      const you = this.actor("xuyuan");
      if (you) this.send(you, "xuyuan", "等你下令");
    }
    if (this.orderId === id) this.orderId = null;
    if (this.huntId === id) this.huntId = null;
    if (this.poachId === id) this.poachId = null;
    if (this.claimId === id) this.cancelClaim();
  }

  private abortServe() {
    const customer = this.servingId ? this.actor(this.servingId) : null;
    if (customer && customer.status === "serving") {
      customer.status = "waiting";
      customer.label = customer.rival ? "被放下" : "在等";
    }
    this.servingId = null;
    this.servingProduct = null;
    this.servingLeft = 0;
    this.probeLeft = 0;
  }

  private near(a: Actor, b: Actor, range: number) {
    return Math.hypot(a.x - b.x, a.y - b.y) < range;
  }

  private staffActs(): StaffAct[] {
    if (this.close || this.finale || this.huddleLeft > 0) return [];
    const selected = this.actor(this.selectedId);
    if (!selected || selected.kind !== "staff") return [];
    if (selected.id === "xuyuan") return [{ id: "back", label: "回柜", detail: "取消当前令" }];
    if (selected.id === "luyao" && this.huntId) {
      const mark = this.actor(this.huntId);
      return [
        { id: "contest", label: "去抢回来", detail: mark ? `冲向${mark.name}` : "拦住她" },
        { id: "let-luyao", label: "让她带走", detail: "你不去拦" },
      ];
    }
    if (selected.id === "tangke" && this.claimId) {
      const mark = this.actor(this.claimId);
      return [
        { id: "contest", label: "抢回来", detail: mark ? `赶在她收走${mark.name}前` : "现在回去" },
        { id: "yield-claim", label: "让给她", detail: "这单算唐可的" },
      ];
    }
    if (selected.id === "suman") {
      const idle = this.liveCustomers().find(item => item.status === "waiting" && item.held <= 0 && item.refund <= 0);
      if (idle && !this.helped) return [{ id: "ask-suman", label: "请她拖一下", detail: this.helper === "suman" || this.flags.includes("cover-suman") ? `${idle.name}会先被她按住` : "她未必肯" }];
    }
    if (selected.id === "roman" || selected.id === "fangmin") return [{ id: "to-checkout", label: "去收银", detail: "许愿走到她那边" }];
    return [];
  }

  private unattended(guest: Actor) {
    return guest.status === "waiting" && guest.refund <= 0 && guest.held <= 0 && guest.threatLeft <= 0 && this.servingId !== guest.id && this.orderId !== guest.id && this.poachId !== guest.id;
  }

  private claimTick(dt: number) {
    const tangke = this.actor("tangke");
    if (!tangke || this.helper === "tangke") {
      if (this.claimId) this.cancelClaim();
      return;
    }
    for (const guest of this.liveCustomers()) {
      if (this.unattended(guest)) guest.away += dt;
      else guest.away = 0;
    }
    if (this.claimId) {
      const guest = this.actor(this.claimId);
      if (!guest || !this.unattended(guest) && this.orderId !== guest.id && this.servingId !== guest.id) {
        this.cancelClaim();
        return;
      }
      if (this.orderId === guest.id || this.servingId === guest.id || guest.threatLeft > 0) {
        this.cancelClaim("许愿回来了");
        return;
      }
      this.send(tangke, guest.home, `想接${guest.name}`);
      guest.label = "唐可想接";
      this.claimLeft -= dt;
      if (this.claimLeft <= 0) this.tangkeTake(guest);
      return;
    }
    const mark = this.liveCustomers()
      .filter(item => this.unattended(item) && item.away >= 5)
      .sort((a, b) => b.away - a.away)[0];
    if (!mark) return;
    this.claimId = mark.id as CustomerId;
    this.claimLeft = 4;
    mark.label = "唐可想接";
    this.send(tangke, mark.home, `想接${mark.name}`);
    this.say(tangke, "这单我先接。");
    this.pushLog("唐可想接", `${mark.name}头上还有四秒。`);
  }

  private cancelClaim(reason?: string) {
    const tangke = this.actor("tangke");
    const guest = this.claimId ? this.actor(this.claimId) : null;
    if (guest && guest.status === "waiting" && guest.label === "唐可想接") {
      guest.label = guest.rival ? "在对比" : "在等";
    }
    this.claimId = null;
    this.claimLeft = 0;
    if (tangke && !this.huddleLeft) this.send(tangke, "tangke", "同期新人");
    if (reason && guest) this.pushLog("唐可退开", reason);
  }

  private tangkeTake(guest: Actor) {
    if (guest.status === "sold" || guest.status === "lost") return;
    guest.status = "lost";
    guest.label = "被唐可接走";
    guest.speech = "她先开口了。";
    guest.speechLeft = 8;
    guest.away = 0;
    this.flags.push(`taken:${guest.id}`);
    this.history.push({ day: this.day, text: `唐可接走了${guest.name}` });
    this.pushLog(`唐可接走了${guest.name}`, "单不算你的。");
    this.send(guest, "checkout", "被唐可接走");
    const tangke = this.actor("tangke");
    if (tangke) this.send(tangke, "checkout", `收下${guest.name}`);
    if (this.servingId === guest.id) this.abortServe();
    if (this.orderId === guest.id) this.orderId = null;
    this.claimId = null;
    this.claimLeft = 0;
  }

  private spawnTick() {
    while (this.spawnQueue.length && this.minutes >= this.spawnQueue[0].at) {
      const next = this.spawnQueue.shift()!;
      if (this.actor(next.id)) continue;
      const guest = makeCustomer(next.id, this.actors.filter(item => item.kind === "customer").length);
      this.send(guest, guest.home, "进店");
      this.actors.push(guest);
      this.pushLog(`${guest.name}进了中庭`, guest.rival ? "陆遥会盯上她。" : "她在等。");
    }
  }

  private beginHuddle() {
    this.huddleDone = true;
    this.huddleLeft = 8;
    this.probeLeft = 0;
    if (this.servingId) this.abortServe();
    const roman = this.actor("roman");
    const you = this.actor("xuyuan");
    if (roman) {
      this.send(roman, "checkout", "开会");
      this.say(roman, "柜台，现在。客单我晚上要。");
    }
    if (you) this.send(you, "checkout", "被叫去开会");
    this.pushLog("罗曼召集开会", "陆遥还在过道上。听完或先走开。");
  }

  private endHuddle() {
    const you = this.actor("xuyuan");
    const roman = this.actor("roman");
    if (you) this.send(you, "xuyuan", "等你下令");
    if (roman) this.send(roman, "roman", "柜长");
    this.flags.push("stayed-huddle");
    this.pushLog("会开完了", "许愿可以回场。");
  }

  private staffIdle() {
    const suman = this.actor("suman");
    if (!this.helped && this.helper === "suman" && suman && this.arrived(suman) && this.huddleLeft <= 0) {
      const idle = this.liveCustomers().find(item => item.status === "waiting" && item.held <= 0 && item.id !== this.servingId && item.refund <= 0);
      if (idle) {
        this.helped = true;
        this.send(suman, idle.home, `替你拖着${idle.name}`);
        idle.held = 12;
        idle.label = "被苏蔓拖住";
        this.pushLog("苏蔓帮你拖客", `${idle.name}暂时不会走。`);
      }
    }
    for (const staff of this.actors.filter(item => item.kind === "staff")) {
      if (staff.id === "xuyuan" || staff.id === "luyao") continue;
      if (this.huddleLeft > 0) continue;
      if (!this.arrived(staff)) continue;
      if (staff.id === "tangke" && !this.claimId && this.helper !== "tangke" && staff.goal === staff.home) {
        staff.label = "同期新人";
      }
    }
  }

  private beginClose() {
    for (const guest of this.liveCustomers()) {
      this.lose(guest.id as CustomerId, CUSTOMERS[guest.id as CustomerId].lostLine);
    }
    this.close = closingFor(this.day, this.flags);
    const speaker = this.actor(this.close.speaker);
    const you = this.actor("xuyuan");
    if (speaker && you) {
      this.send(speaker, nearestNode(you.x, you.y), this.close.title);
      this.say(speaker, this.close.body);
    }
    if (this.day === 5) {
      const fang = makeStaff().find(item => item.id === "fangmin");
      if (fang && !this.actor("fangmin")) {
        const stand = standPoint("backroom", fang.id);
        fang.x = stand.x;
        fang.y = stand.y;
        fang.destX = stand.x;
        fang.destY = stand.y;
        fang.goal = "backroom";
        this.actors.push(fang);
        this.send(fang, "checkout", "盘点");
      }
    }
    this.selectedId = this.close.speaker;
    this.pushLog("闭店", this.close.title);
  }

  private send(actor: Actor, dest: NodeId, label: string) {
    actor.label = label;
    if (actor.goal === dest && (actor.path.length > 0 || !this.arrived(actor))) return;
    const from = nearestNode(actor.x, actor.y);
    actor.goal = dest;
    actor.path = from === dest ? [] : pathTo(from, dest);
    this.aim(actor);
  }

  private aim(actor: Actor) {
    const point = standPoint(actor.path[0] ?? actor.goal, actor.id);
    actor.destX = point.x;
    actor.destY = point.y;
  }

  private move(actor: Actor, dt: number) {
    const speed = actor.kind === "customer" ? 6.2 : 7.4;
    const dx = actor.destX - actor.x;
    const dy = actor.destY - actor.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= 0.45 || step >= dist) {
      actor.x = actor.destX;
      actor.y = actor.destY;
      if (actor.path.length) {
        actor.path.shift();
        this.aim(actor);
      }
    } else {
      actor.x += (dx / dist) * step;
      actor.y += (dy / dist) * step;
    }
    actor.speechLeft = Math.max(0, actor.speechLeft - dt);
    if (actor.speechLeft <= 0 && actor.kind === "staff") actor.speech = "";
  }

  private arrived(actor: Actor) {
    return actor.path.length === 0 && Math.hypot(actor.destX - actor.x, actor.destY - actor.y) < 0.7;
  }

  private separate() {
    const people = this.actors.filter(item => item.status !== "sold" && item.status !== "lost");
    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const a = people[i];
        const b = people[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= 4.4 || dist < 0.01) continue;
        const push = (4.4 - dist) * 0.35;
        const nx = dx / dist;
        const ny = dy / dist;
        if (!this.arrived(a)) {
          a.x -= nx * push;
          a.y -= ny * push;
        }
        if (!this.arrived(b)) {
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private say(actor: Actor, text: string) {
    actor.speech = text;
    actor.speechLeft = 7;
  }

  private pushLog(title: string, detail: string) {
    this.logs.unshift({ id: String(this.idSeq++), clock: clockOf(this.minutes), title, detail });
    this.logs = this.logs.slice(0, 16);
  }
}

export function roomOf(actor: Actor) {
  return roomAt(actor.x, actor.y);
}

export { PRODUCTS, TARGET };
