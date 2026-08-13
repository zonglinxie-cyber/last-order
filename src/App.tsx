import { FormEvent, useEffect, useMemo, useState } from 'react';

type CustomerId = 'mei' | 'shen' | 'xiaoyu' | 'anjie';
type CustomerStatus = 'waiting' | 'served' | 'lost';
type ActionId = 'observe' | 'ask' | 'trial' | 'gift' | 'sample' | 'compare' | 'sell';

type Customer = {
  id: CustomerId;
  name: string;
  tag: string;
  portrait: string;
  x: number;
  y: number;
  value: number;
  trust: number;
  patience: number;
  status: CustomerStatus;
  owner: 'none' | 'player' | 'tangke' | 'luyao' | 'suman';
  rivalProgress: number;
  clueLevel: number;
  line: string;
};

type Alert = { id: string; tone: 'danger' | 'message' | 'info'; title: string; body: string; target?: CustomerId };
type Message = { id: string; from: string; portrait: string; body: string; unread: boolean; saved: boolean };
type BusyAction = { id: ActionId | 'speech'; customerId: CustomerId; label: string; left: number; total: number; speech?: string };

type GameState = {
  phase: 'live' | 'closing';
  secondsLeft: number;
  sales: number;
  target: number;
  gifts: number;
  samples: number;
  risk: number;
  focus: CustomerId | null;
  busy: BusyAction | null;
  customers: Record<CustomerId, Customer>;
  alerts: Alert[];
  messages: Message[];
  phoneOpen: boolean;
  evidence: number;
  tangkeRelation: number;
  disputeResolved: boolean;
  log: string[];
};

const STORAGE_KEY = 'last-order-live-theater-v1';
const scene = '/assets/scenes/cosmetics-floor-prototype.png';
const art = {
  player: '/assets/characters/player_female.png',
  tangke: '/assets/characters/chen_cheng.png',
  luyao: '/assets/characters/gao_wei.png',
  roman: '/assets/characters/wang_fang.png',
  suman: '/assets/characters/lin_jing.png',
  mei: '/assets/characters/wang_fang.png',
  shen: '/assets/characters/player_female.png',
  xiaoyu: '/assets/characters/lin_jing.png',
  anjie: '/assets/characters/wang_fang.png',
};

const ACTIONS: Record<ActionId, { label: string; sub: string; duration: number }> = {
  observe: { label: '长按观察', sub: '确认她真正关注什么', duration: 3 },
  ask: { label: '追问需求', sub: '让顾客说出真实顾虑', duration: 5 },
  trial: { label: '开始试妆', sub: '效果强，但要占用10秒', duration: 10 },
  gift: { label: '拿赠品压单', sub: '消耗唯一高端赠品', duration: 4 },
  sample: { label: '私下给小样', sub: '快速推进，留下盘点缺口', duration: 3 },
  compare: { label: '对比竞品', sub: '阻止陆遥继续截客', duration: 6 },
  sell: { label: '现在成交', sub: '结账时仍可能有人争单', duration: 5 },
};

function initialState(): GameState {
  return {
    phase: 'live', secondsLeft: 210, sales: 17300, target: 26000, gifts: 1, samples: 2, risk: 6,
    focus: 'mei', busy: null, phoneOpen: false, evidence: 0, tangkeRelation: -5, disputeResolved: false,
    log: ['梅女士刚完成半边试妆，唐可突然被叫去中庭。'],
    alerts: [
      { id: 'cold-1', tone: 'danger', title: '唐可插话', body: '“等一下，这位客人是我先接的。”', target: 'mei' },
      { id: 'cold-2', tone: 'message', title: '柜长罗曼', body: '总部盘点提前，所有小样暂停发放。' },
    ],
    messages: [
      { id: 'm1', from: '唐可', portrait: art.tangke, body: '灰外套那位我已经聊了十分钟。你先替我守一下，别让她走。', unread: true, saved: false },
      { id: 'm2', from: '罗曼', portrait: art.roman, body: '总部盘点提前了。现在起所有小样停止发放，缺口闭店前解释。', unread: true, saved: false },
      { id: 'm3', from: '苏蔓', portrait: art.suman, body: '安姐晚高峰会来。她要什么先答应，今天先把数字做出来。', unread: true, saved: false },
    ],
    customers: {
      mei: { id: 'mei', name: '梅女士', tag: '唐可的顾客', portrait: art.mei, x: 62, y: 57, value: 4200, trust: 56, patience: 48, status: 'waiting', owner: 'tangke', rivalProgress: 0, clueLevel: 1, line: '刚才那个小姑娘呢？她说去一下就回来。你们这单到底算谁的？' },
      shen: { id: 'shen', name: '沈薇', tag: '正在比较竞品', portrait: art.shen, x: 40, y: 48, value: 9800, trust: 26, patience: 58, status: 'waiting', owner: 'none', rivalProgress: 15, clueLevel: 0, line: '我还在对面看了一套。她们赠品更多，你们贵在哪里？' },
      xiaoyu: { id: 'xiaoyu', name: '小雨', tag: '正在拍新品', portrait: art.xiaoyu, x: 78, y: 58, value: 1800, trust: 35, patience: 72, status: 'waiting', owner: 'none', rivalProgress: 0, clueLevel: 0, line: '给我一支没拆封的新品小样吧，我今晚就能发视频。' },
      anjie: { id: 'anjie', name: '安姐', tag: '晚高峰到店', portrait: art.anjie, x: 52, y: 43, value: 12800, trust: 48, patience: 72, status: 'waiting', owner: 'suman', rivalProgress: 0, clueLevel: 1, line: '苏蔓说今天你替她接我。上次那套赠品还是照给，对吧？' },
    },
  };
}

function hydrate(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialState(), ...JSON.parse(saved) } as GameState : initialState();
  } catch { return initialState(); }
}

function money(value: number) { return `¥${value.toLocaleString('zh-CN')}`; }
function clock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

function customerActions(customer: Customer): ActionId[] {
  if (customer.id === 'mei') return customer.trust >= 62 ? ['sell', 'ask', 'trial'] : ['ask', 'trial', 'observe'];
  if (customer.id === 'shen') return customer.trust >= 58 ? ['sell', 'trial', 'gift'] : ['compare', 'trial', 'ask'];
  if (customer.id === 'xiaoyu') return customer.trust >= 55 ? ['sell', 'sample', 'ask'] : ['sample', 'observe', 'ask'];
  return customer.trust >= 62 ? ['sell', 'gift', 'ask'] : ['gift', 'ask', 'observe'];
}

function finishAction(state: GameState, action: BusyAction): GameState {
  const customer = state.customers[action.customerId];
  if (!customer || customer.status !== 'waiting') return { ...state, busy: null };
  let patch: Partial<Customer> = {};
  let sales = state.sales;
  let gifts = state.gifts;
  let samples = state.samples;
  let risk = state.risk;
  let tangkeRelation = state.tangkeRelation;
  let note = '';
  let alerts = state.alerts;

  if (action.id === 'observe') {
    patch = { trust: customer.trust + 6, clueLevel: customer.clueLevel + 1, line: customer.id === 'shen' ? '我不是怕贵。我怕婚礼当天脱妆，也不想买一堆以后不用的。' : '你没有马上推最贵的，我愿意再听听。' };
    note = `你看出了${customer.name}没有说出口的顾虑。`;
  } else if (action.id === 'ask') {
    patch = { trust: customer.trust + 12, clueLevel: customer.clueLevel + 1, line: customer.id === 'mei' ? '我不想掺和你们抢单。谁能把后续说清楚，我就跟谁买。' : '那我说实话：我需要依据，不想听“肯定有效”。' };
    note = `${customer.name}说出了真实顾虑。`;
  } else if (action.id === 'trial') {
    patch = { trust: customer.trust + 22, patience: customer.patience + 8, line: '这个效果确实比我想象中自然。刚才那十秒没有白等。' };
    note = `试妆完成，${customer.name}明显更信任你。`;
  } else if (action.id === 'compare') {
    patch = { trust: customer.trust + 15, rivalProgress: Math.max(0, customer.rivalProgress - 35), line: '你没有只说对面不好，而是把差异讲清楚了。那我再试一下。' };
    note = '陆遥暂时没有继续插话。';
  } else if (action.id === 'gift') {
    if (gifts <= 0) return { ...state, busy: null };
    gifts -= 1; risk += customer.id === 'anjie' ? 14 : 5;
    patch = { trust: customer.trust + 26, line: '赠品如果真能留给我，我今天就可以定。请写在小票上。' };
    note = `唯一的高端赠品已经承诺给${customer.name}。`;
  } else if (action.id === 'sample') {
    if (samples <= 0) return { ...state, busy: null };
    samples -= 1; risk += 22;
    patch = { trust: customer.trust + 28, line: '放心，我视频里不会拍到来源。你比她们灵活。' };
    note = '小样交出去了，登记表上没有这一笔。';
    alerts = [{ id: `sample-${Date.now()}`, tone: 'danger', title: '盘点风险上升', body: '方敏刚刚在工作群里问：谁动了新品批次？' }, ...alerts];
  } else if (action.id === 'speech') {
    const good = /适合|担心|需要|试|预算|退|考虑|区别/.test(action.speech ?? '');
    patch = { trust: customer.trust + (good ? 14 : 5), line: good ? '你是在先解决我的问题。那你继续说。' : '我听到了，但这还没有解决我的顾虑。' };
    note = `你对${customer.name}说：“${action.speech}”`;
  } else if (action.id === 'sell') {
    if (customer.trust < 55) return { ...state, busy: null, alerts: [{ id: `fail-${Date.now()}`, tone: 'danger', title: '成交失败', body: `${customer.name}还没有准备好付款。` }, ...alerts] };
    sales += customer.value;
    patch = { status: 'served', owner: 'player', line: '付款成功。' };
    note = `${customer.name}成交 ${money(customer.value)}。`;
    if (customer.id === 'mei') {
      tangkeRelation -= 22;
      alerts = [{ id: `dispute-${Date.now()}`, tone: 'danger', title: '唐可当场拦住你', body: '“你只是替我看一下，为什么整单进了你名下？”', target: 'mei' }, ...alerts];
    }
  }

  return {
    ...state, busy: null, sales, gifts, samples, risk, tangkeRelation, alerts,
    customers: { ...state.customers, [customer.id]: { ...customer, ...patch } },
    log: [note, ...state.log].slice(0, 12),
  };
}

function tick(state: GameState): GameState {
  if (state.phase !== 'live') return state;
  let next = { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1) };
  const customers = { ...next.customers };
  const alerts = [...next.alerts];

  (Object.keys(customers) as CustomerId[]).forEach((id) => {
    const customer = customers[id];
    if (customer.status !== 'waiting') return;
    const focused = next.focus === id;
    const visibleNow = id !== 'anjie' || next.secondsLeft <= 125;
    if (!visibleNow) return;
    let patience = customer.patience - (focused ? 0.15 : 1);
    let rivalProgress = customer.rivalProgress;
    if (id === 'shen' && !focused) rivalProgress += 2.6;
    if (rivalProgress >= 100) {
      customers[id] = { ...customer, status: 'lost', owner: 'luyao', rivalProgress: 100, line: '我去对面再看看。' };
      alerts.unshift({ id: `lost-rival-${Date.now()}`, tone: 'danger', title: '陆遥截走了沈薇', body: '你专注在别处时，她完成了竞品试妆。' });
    } else if (patience <= 0) {
      customers[id] = { ...customer, status: 'lost', patience: 0, line: '我赶时间，先走了。' };
      alerts.unshift({ id: `lost-${id}-${Date.now()}`, tone: 'danger', title: `${customer.name}离开了`, body: '她等了太久，没有人继续接待。' });
    } else customers[id] = { ...customer, patience, rivalProgress };
  });

  next = { ...next, customers, alerts };
  if (next.busy) {
    const busy = { ...next.busy, left: next.busy.left - 1 };
    next = busy.left <= 0 ? finishAction(next, busy) : { ...next, busy };
  }
  if (next.secondsLeft <= 0) next = { ...next, phase: 'closing', focus: null, busy: null };
  return next;
}

function ScenePerson({ name, portrait, x, y, type = 'staff', stateText, selected, onClick }: {
  name: string; portrait: string; x: number; y: number; type?: string; stateText?: string; selected?: boolean; onClick?: () => void;
}) {
  const content = <><span className="live-shadow"/><span className="live-avatar"><img src={portrait} alt="" /></span><span className="live-name">{name}</span>{stateText && <span className="live-state">{stateText}</span>}</>;
  const style = { left: `${x}%`, top: `${y}%` };
  return onClick ? <button type="button" className={`live-person ${type} ${selected ? 'selected' : ''}`} style={style} onClick={onClick}>{content}</button> : <div className={`live-person ${type}`} style={style}>{content}</div>;
}

function App() {
  const [state, setState] = useState<GameState>(hydrate);
  const [speech, setSpeech] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => {
    const timer = window.setInterval(() => setState((current) => tick(current)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const focused = state.focus ? state.customers[state.focus] : null;
  const activeAlerts = state.alerts.slice(0, 2);
  const served = Object.values(state.customers).filter((c) => c.status === 'served').length;
  const lost = Object.values(state.customers).filter((c) => c.status === 'lost').length;
  const pan = focused ? (focused.x < 48 ? 0 : focused.x < 70 ? -205 : -390) : -190;

  function focusCustomer(id: CustomerId) {
    const customer = state.customers[id];
    if (customer.status !== 'waiting') return;
    setState((s) => ({ ...s, focus: id, busy: null, alerts: s.alerts.filter((alert) => alert.target !== id) }));
  }

  function startAction(id: ActionId) {
    if (!focused || state.busy) return;
    if (id === 'gift' && state.gifts <= 0) return;
    if (id === 'sample' && state.samples <= 0) return;
    const action = ACTIONS[id];
    setState((s) => ({ ...s, busy: { id, customerId: focused.id, label: action.label, left: action.duration, total: action.duration } }));
  }

  function submitSpeech(event: FormEvent) {
    event.preventDefault();
    if (!focused || !speech.trim() || state.busy) return;
    const text = speech.trim().slice(0, 80);
    setState((s) => ({ ...s, busy: { id: 'speech', customerId: focused.id, label: '正在回应', left: 4, total: 4, speech: text } }));
    setSpeech('');
  }

  function resolveDispute(kind: 'claim' | 'share' | 'yield') {
    setState((s) => {
      let sales = s.sales;
      let relation = s.tangkeRelation;
      let text = '';
      if (kind === 'claim') { relation -= 20; text = '你坚持拿走全部业绩。唐可保存了聊天记录。'; }
      if (kind === 'share') { sales -= 2100; relation += 24; text = '你们当场五五拼单。唐可把明天的预约客信息发给了你。'; }
      if (kind === 'yield') { sales -= 4200; relation += 38; text = '你把整单还给唐可。她替你解释了小样登记。'; }
      return { ...s, sales, tangkeRelation: relation, disputeResolved: true, alerts: s.alerts.filter((a) => !a.id.startsWith('dispute')), log: [text, ...s.log] };
    });
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState());
  }

  if (state.phase === 'closing') {
    const complete = state.sales >= state.target;
    const sampleViolation = state.samples < 2 || state.risk >= 20;
    return <div className="mobile-stage-shell"><main className="episode-ending">
      <div className="end-lights"><span>21:45 · 商场闭店</span><h1>{complete ? '任务完成。' : '还差最后一单。'}</h1><p>{complete ? '付款声停了，今天留下的承诺开始生效。' : '灯已经熄了。明天，这个缺口仍然在等你。'}</p></div>
      <section className="battle-report"><span>第 12 天 · 新品活动</span><div className="report-total"><small>今日销售</small><strong>{money(state.sales)}</strong><i>{Math.round(state.sales / state.target * 100)}%</i></div><div className="report-stats"><p><b>{served}</b><span>成交顾客</span></p><p><b>{lost}</b><span>错过顾客</span></p><p><b>{state.risk}</b><span>盘点风险</span></p><p><b>{state.evidence}</b><span>保存证据</span></p></div>
        <div className="end-consequences"><p>{sampleViolation ? '方敏把小样登记表翻到了你的签名页。' : '方敏核对完小样，把登记表暂时合上了。'}</p><p>{state.tangkeRelation >= 10 ? '唐可把明天的预约客发给了你。' : '唐可没有和你说晚安。'}</p><p>{complete ? '为了今天的数字，你已经抵押了一部分明天。' : '你没有拿到最后一单，但也没有把所有人都变成敌人。'}</p></div>
      </section>
      <button className="replay" type="button" onClick={reset}>再玩一次 · 换个做法</button>
      <div className="tomorrow-hook"><span>明天 09:00</span><strong>{sampleViolation ? '临时盘点' : '安姐的预约'}</strong><p>{sampleViolation ? '方敏停在了你拿走新品小样的那一行。' : '苏蔓说：“她要的赠品，你今天还没有答应。”'}</p></div>
    </main></div>;
  }

  const actions = focused ? customerActions(focused) : [];
  return <div className="mobile-stage-shell">
    <main className="live-theater">
      <header className="mobile-hud">
        <div className="mini-brand"><span>绮光</span><div><strong>最后一单</strong><small>新品活动日</small></div></div>
        <div className="shift-clock"><small>晚高峰剩余</small><strong>{clock(state.secondsLeft)}</strong></div>
        <div className="hud-sales"><small>今日业绩</small><strong>{money(state.sales)}</strong><span>{Math.round(state.sales / state.target * 100)}%</span></div>
        <button type="button" onClick={() => setState((s) => ({ ...s, phoneOpen: true }))}><i>{state.messages.filter((m) => m.unread).length}</i>消息</button>
      </header>

      <section className="live-scene">
        <div className="scene-track" style={{ '--mobile-pan': `${pan}px` } as React.CSSProperties}>
          <img className="theater-bg" src={scene} alt="绮光与维珞专柜实时场景" />
          <span className="brand-zone rival">维珞</span><span className="brand-zone aurora">绮光</span>
          <ScenePerson name="陆遥" portrait={art.luyao} x={18} y={47} type="rival" stateText={state.customers.shen.status === 'waiting' ? '正在靠近沈薇' : '维珞销冠'} />
          <ScenePerson name="苏蔓" portrait={art.suman} x={72} y={39} stateText="接待老客" />
          <ScenePerson name="唐可" portrait={art.tangke} x={58} y={51} type="warning" stateText={state.disputeResolved ? '继续工作' : '盯着你的订单'} />
          <ScenePerson name="你" portrait={art.player} x={67} y={68} type="player" stateText={state.busy ? state.busy.label : focused ? `接待${focused.name}` : '等待指令'} />
          {(Object.keys(state.customers) as CustomerId[]).map((id) => {
            const customer = state.customers[id];
            const visible = id !== 'anjie' || state.secondsLeft <= 125;
            if (!visible || customer.status !== 'waiting') return null;
            const urgent = customer.patience < 18 || customer.rivalProgress > 65;
            return <ScenePerson key={id} name={customer.name} portrait={customer.portrait} x={customer.x} y={customer.y} type={`customer ${urgent ? 'urgent' : ''}`} stateText={customer.rivalProgress > 65 ? '快被陆遥截走' : customer.tag} selected={state.focus === id} onClick={() => focusCustomer(id)} />;
          })}
          {state.busy && <div className="busy-ring"><span>{state.busy.label}</span><b>{state.busy.left}s</b><i><em style={{ width: `${(state.busy.total - state.busy.left) / state.busy.total * 100}%` }} /></i></div>}
        </div>
        <div className="scene-vignette" />
        <div className="live-alerts">
          {activeAlerts.map((alert) => <button type="button" className={alert.tone} key={alert.id} onClick={() => alert.target ? focusCustomer(alert.target) : setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== alert.id) }))}><strong>{alert.title}</strong><span>{alert.body}</span></button>)}
        </div>
        {state.customers.shen.status === 'waiting' && state.focus !== 'shen' && <button className="edge-threat left" type="button" onClick={() => focusCustomer('shen')}><i style={{ height: `${state.customers.shen.rivalProgress}%` }}/><span>陆遥正在截沈薇</span><b>{Math.max(1, Math.ceil((100 - state.customers.shen.rivalProgress) / 2.6))}秒</b></button>}
        {state.customers.xiaoyu.status === 'waiting' && state.focus !== 'xiaoyu' && <button className="edge-threat right" type="button" onClick={() => focusCustomer('xiaoyu')}><span>小雨还在等小样</span><b>{Math.ceil(state.customers.xiaoyu.patience)}秒</b></button>}
      </section>

      <section className={`focus-sheet ${focused ? 'open' : ''}`}>
        {focused ? <>
          <div className="focus-heading"><img src={focused.portrait} alt=""/><div><span>{focused.tag}</span><h2>{focused.name}</h2></div><div className="focus-bars"><small>耐心</small><i><b style={{ width: `${Math.min(100, focused.patience)}%` }}/></i><small>信任 {focused.trust}</small></div></div>
          <div className="live-dialogue">“{focused.line}”</div>
          {focused.id === 'mei' && !state.disputeResolved && focused.status === 'waiting' && <div className="ownership-warning"><b>订单归属有争议</b><span>唐可完成首次接待和半边试妆</span></div>}
          {focused.id === 'shen' && <div className="rival-meter"><span>陆遥截客进度</span><i><b style={{ width: `${focused.rivalProgress}%` }}/></i></div>}
          {focused.status === 'waiting' && !state.busy && <div className="thumb-actions">{actions.map((id) => <button key={id} type="button" onClick={() => startAction(id)} disabled={(id === 'gift' && state.gifts === 0) || (id === 'sample' && state.samples === 0)}><strong>{ACTIONS[id].label}</strong><small>{ACTIONS[id].sub}</small></button>)}</div>}
          {state.busy && <div className="busy-copy"><span>{state.busy.label}进行中</span><p>场景没有暂停。其他顾客和陆遥仍在行动。</p><button type="button" onClick={() => setState((s) => ({ ...s, busy: null }))}>中断操作</button></div>}
          {!state.busy && focused.status === 'waiting' && <form className="one-line-speech" onSubmit={submitSpeech}><input value={speech} onChange={(e) => setSpeech(e.target.value)} placeholder="自己说一句……" maxLength={80}/><button type="submit">发送</button></form>}
          {focused.id === 'mei' && focused.status === 'served' && !state.disputeResolved && <div className="instant-dispute"><p>唐可要求当场处理这笔 ¥4,200 的归属。</p><div><button onClick={() => resolveDispute('claim')} type="button">坚持拿走</button><button onClick={() => resolveDispute('share')} type="button">五五拼单</button><button onClick={() => resolveDispute('yield')} type="button">整单让回</button></div></div>}
        </> : <div className="no-focus"><strong>选择你现在要关注的人</strong><span>所有顾客和同事都在继续行动</span></div>}
      </section>

      <nav className="mobile-nav"><button className="active" type="button">现场</button><button type="button" onClick={() => setState((s) => ({ ...s, phoneOpen: true }))}>消息</button><button type="button" onClick={() => setState((s) => ({ ...s, phase: 'closing' }))}>提前闭店</button></nav>

      {state.phoneOpen && <div className="message-scrim" onClick={() => setState((s) => ({ ...s, phoneOpen: false }))}><section className="half-phone" onClick={(e) => e.stopPropagation()}><div className="phone-handle"/><header><div><small>场景仍在运行</small><h2>消息</h2></div><button type="button" onClick={() => setState((s) => ({ ...s, phoneOpen: false }))}>收起</button></header>{state.messages.map((message) => <article key={message.id}><img src={message.portrait} alt=""/><div><strong>{message.from}</strong><p>{message.body}</p><div><button type="button" onClick={() => setState((s) => ({ ...s, messages: s.messages.map((m) => m.id === message.id ? { ...m, unread: false } : m) }))}>快速回复</button><button type="button" className={message.saved ? 'saved' : ''} onClick={() => setState((s) => ({ ...s, evidence: message.saved ? s.evidence : s.evidence + 1, messages: s.messages.map((m) => m.id === message.id ? { ...m, saved: true, unread: false } : m) }))}>{message.saved ? '已截图' : '截图留证'}</button></div></div></article>)}</section></div>}
    </main>
  </div>;
}

export default App;
