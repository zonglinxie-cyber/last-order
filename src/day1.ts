import type { PlayerGender } from './visualAssets';

export type NpcId = 'ceo' | 'operations' | 'sales' | 'ui_designer' | 'finance';
export type Day1Phase = 'onboarding' | 'morning' | 'task' | 'result' | 'closed';
export type ChatRole = 'player' | 'npc' | 'system' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface NpcDay1State {
  relationship: number;
  memories: string[];
  revealedFactIds: string[];
  messages: ChatMessage[];
}

export interface ReceptionFields {
  clientCount: string;
  arrivalTime: string;
  attendees: string;
  materials: string;
  meetingRoom: string;
  reception: string;
  notes: string;
}

export interface ReceptionTask {
  active: boolean;
  source: string;
  time: string;
  revealedFactIds: string[];
  fields: ReceptionFields;
  sources: Partial<Record<keyof ReceptionFields, string>>;
  delivery: ReceptionFields;
}

export interface Day1Result {
  summary: string;
  feedback: Record<NpcId, string>;
}

export interface Day1State {
  version: 1;
  playerName: string;
  playerGender: PlayerGender | null;
  phase: Day1Phase;
  time: string;
  npc: Record<NpcId, NpcDay1State>;
  task: ReceptionTask;
  result: Day1Result | null;
}

export interface NpcChatResult {
  reply: string;
  attitude_delta: number;
  revealed_fact_ids: string[];
  memory_candidate: string | null;
}

export const npcIds: NpcId[] = ['ceo', 'operations', 'sales', 'ui_designer', 'finance'];

export const factValues: Record<string, string> = {
  FACT_CLIENT_TYPE: '客户是一家合作过一段时间的企业客户',
  FACT_CLIENT_TIME: '15:00左右',
  FACT_CLIENT_COUNT: '3人',
  FACT_SALES_OWNER: '高伟负责客户沟通',
  FACT_BOSS_ATTENDS: '周启明参加',
  FACT_MEETING_ROOM: '公司小会议区',
  FACT_MATERIALS: '现有业务介绍资料',
  FACT_DRINKS: '普通瓶装水',
};

export const npcDisplayNames: Record<NpcId, string> = {
  ceo: '周启明',
  operations: '林静',
  sales: '高伟',
  ui_designer: '陈成',
  finance: '王芳',
};

const emptyFields = (): ReceptionFields => ({
  clientCount: '',
  arrivalTime: '',
  attendees: '',
  materials: '',
  meetingRoom: '',
  reception: '',
  notes: '',
});

const emptyNpcState = (): NpcDay1State => ({
  relationship: 0,
  memories: [],
  revealedFactIds: [],
  messages: [],
});

export function createInitialDay1State(): Day1State {
  return {
    version: 1,
    playerName: '',
    playerGender: null,
    phase: 'onboarding',
    time: '09:00',
    npc: {
      ceo: emptyNpcState(),
      operations: emptyNpcState(),
      sales: emptyNpcState(),
      ui_designer: emptyNpcState(),
      finance: emptyNpcState(),
    },
    task: {
      active: false,
      source: '周启明',
      time: '明天下午',
      revealedFactIds: [],
      fields: emptyFields(),
      sources: {},
      delivery: emptyFields(),
    },
    result: null,
  };
}

export function hydrateDay1State(value: unknown): Day1State {
  const initial = createInitialDay1State();
  if (!value || typeof value !== 'object') return initial;
  const saved = value as Partial<Day1State>;
  if (saved.version !== 1) return initial;

  const hydratedNpc = { ...initial.npc };
  npcIds.forEach((id) => {
    const npc = saved.npc?.[id];
    if (!npc) return;
    hydratedNpc[id] = {
      relationship: typeof npc.relationship === 'number' ? npc.relationship : 0,
      memories: Array.isArray(npc.memories) ? npc.memories.slice(-10) : [],
      revealedFactIds: Array.isArray(npc.revealedFactIds) ? npc.revealedFactIds : [],
      messages: Array.isArray(npc.messages) ? npc.messages.slice(-16) : [],
    };
  });

  return {
    ...initial,
    ...saved,
    playerName: typeof saved.playerName === 'string' ? saved.playerName : '',
    playerGender: saved.playerGender === 'male' || saved.playerGender === 'female' ? saved.playerGender : null,
    npc: hydratedNpc,
    task: {
      ...initial.task,
      ...saved.task,
      fields: { ...initial.task.fields, ...saved.task?.fields },
      sources: { ...initial.task.sources, ...saved.task?.sources },
      delivery: { ...initial.task.delivery, ...saved.task?.delivery },
      revealedFactIds: Array.isArray(saved.task?.revealedFactIds) ? saved.task.revealedFactIds : [],
    },
  };
}

export function relationshipDescription(value: number) {
  if (value <= -45) return '很排斥';
  if (value <= -15) return '有些不满';
  if (value < 25) return '一般';
  if (value < 50) return '比较熟';
  if (value < 75) return '信任';
  return '很信任';
}

export function activateReceptionTask(state: Day1State): Day1State {
  const bossMessage: ChatMessage = {
    id: `scenario-${Date.now()}`,
    role: 'npc',
    content: '对了，明天下午有个客户过来，你帮忙准备一下。',
  };
  return {
    ...state,
    phase: 'task',
    time: '16:20',
    npc: {
      ...state.npc,
      ceo: {
        ...state.npc.ceo,
        messages: [...state.npc.ceo.messages, bossMessage].slice(-16),
      },
    },
    task: { ...state.task, active: true },
  };
}

export function applyNpcChatResult(state: Day1State, npcId: NpcId, result: NpcChatResult): Day1State {
  const npc = state.npc[npcId];
  const validFacts = result.revealed_fact_ids.filter((id) => id in factValues);
  const revealedFactIds = [...new Set([...npc.revealedFactIds, ...validFacts])];
  const taskFacts = [...new Set([...state.task.revealedFactIds, ...validFacts])];
  const attendees: string[] = [];
  if (taskFacts.includes('FACT_BOSS_ATTENDS')) attendees.push('周启明');
  if (taskFacts.includes('FACT_SALES_OWNER')) attendees.push('高伟');

  const fields: ReceptionFields = {
    ...state.task.fields,
    clientCount: taskFacts.includes('FACT_CLIENT_COUNT') ? factValues.FACT_CLIENT_COUNT : state.task.fields.clientCount,
    arrivalTime: taskFacts.includes('FACT_CLIENT_TIME') ? factValues.FACT_CLIENT_TIME : state.task.fields.arrivalTime,
    attendees: attendees.length ? attendees.join('、') : state.task.fields.attendees,
    materials: taskFacts.includes('FACT_MATERIALS') ? factValues.FACT_MATERIALS : state.task.fields.materials,
    meetingRoom: taskFacts.includes('FACT_MEETING_ROOM') ? factValues.FACT_MEETING_ROOM : state.task.fields.meetingRoom,
    reception: taskFacts.includes('FACT_DRINKS') ? factValues.FACT_DRINKS : state.task.fields.reception,
    notes: taskFacts.includes('FACT_CLIENT_TYPE') ? factValues.FACT_CLIENT_TYPE : state.task.fields.notes,
  };
  const sources = { ...state.task.sources };
  const sourceName = npcDisplayNames[npcId];
  const sourceKeys: Partial<Record<string, keyof ReceptionFields>> = {
    FACT_CLIENT_COUNT: 'clientCount',
    FACT_CLIENT_TIME: 'arrivalTime',
    FACT_SALES_OWNER: 'attendees',
    FACT_BOSS_ATTENDS: 'attendees',
    FACT_MATERIALS: 'materials',
    FACT_MEETING_ROOM: 'meetingRoom',
    FACT_DRINKS: 'reception',
    FACT_CLIENT_TYPE: 'notes',
  };
  validFacts.forEach((factId) => {
    const key = sourceKeys[factId];
    if (key) sources[key] = sourceName;
  });
  const delivery = { ...state.task.delivery };
  (Object.keys(fields) as (keyof ReceptionFields)[]).forEach((key) => {
    if (!delivery[key] && fields[key]) delivery[key] = fields[key];
  });

  return {
    ...state,
    npc: {
      ...state.npc,
      [npcId]: {
        ...npc,
        relationship: Math.max(-100, Math.min(100, npc.relationship + result.attitude_delta)),
        revealedFactIds,
        memories: result.memory_candidate
          ? [...npc.memories, result.memory_candidate].slice(-10)
          : npc.memories,
        messages: [
          ...npc.messages,
          { id: `npc-${Date.now()}`, role: 'npc', content: result.reply } as ChatMessage,
        ].slice(-16),
      },
    },
    task: { ...state.task, revealedFactIds: taskFacts, fields, sources, delivery },
  };
}

export function evaluateDay1(state: Day1State): Day1Result {
  const facts = state.task.revealedFactIds;
  const importantFacts = ['FACT_CLIENT_COUNT', 'FACT_CLIENT_TIME', 'FACT_MEETING_ROOM'];
  const missingImportant = importantFacts.filter((id) => !facts.includes(id));
  const contacts = npcIds.filter((id) => state.npc[id].messages.some((message) => message.role === 'player'));
  const delivery = state.task.delivery;
  const isUncertain = (value: string) => !value.trim() || /不确定|待确认|不知道/.test(value);
  const wrongAssumptions = [
    !isUncertain(delivery.arrivalTime) && !/(15|3点|三点)/.test(delivery.arrivalTime),
    !isUncertain(delivery.clientCount) && !/(3|三)/.test(delivery.clientCount),
    !isUncertain(delivery.attendees) && !/周启明|周总|老板/.test(delivery.attendees),
    !isUncertain(delivery.meetingRoom) && !/小会议|会议区/.test(delivery.meetingRoom),
    !isUncertain(delivery.materials) && !/业务|介绍资料/.test(delivery.materials),
    !isUncertain(delivery.reception) && !/瓶装水|水/.test(delivery.reception),
  ].filter(Boolean).length;
  const wellPrepared = facts.length >= 6 && missingImportant.length === 0 && contacts.length >= 3 && wrongAssumptions === 0;
  const unprepared = facts.length <= 2 || missingImportant.length >= 2;

  const summary = wellPrepared
    ? '你基本把明天的客户接待安排理清楚了，关键时间、人数和现场准备都有依据。'
    : wrongAssumptions >= 2
      ? '你提交了接待安排，但其中有几处没有信息依据的判断。明天开始前，这些内容仍需要重新确认。'
      : unprepared
      ? '还有几个关键问题没有确认。你提交了现有信息，但明天开始前最好尽快补齐。'
      : '接待安排已经有了基本轮廓。仍有少量信息不确定，不过你至少知道主动去问。';

  return {
    summary,
    feedback: {
      ceo: state.npc.ceo.relationship < 0
        ? '对你刚才的处理方式有些不满。'
        : wellPrepared ? '觉得你能把模糊任务往前推进。' : '对你暂时没有明显评价。',
      operations: state.npc.operations.relationship < 0
        ? '觉得你刚才的沟通方式不太妥当。'
        : contacts.includes('operations')
          ? wellPrepared || state.npc.operations.relationship > 0 ? '觉得你做事比较仔细。' : '觉得你愿意确认，但还需要更利索一点。'
        : '对你还不太了解。',
      sales: state.npc.sales.relationship < 0
        ? '觉得你有点难沟通。'
        : contacts.includes('sales')
          ? facts.includes('FACT_CLIENT_COUNT') ? '觉得你问题不少，但还算好沟通。' : '觉得你还没有问到真正关键的信息。'
        : '今天几乎没和你打交道。',
      ui_designer: state.npc.ui_designer.relationship < 0
        ? '不太喜欢你刚才的说话方式。'
        : contacts.includes('ui_designer') ? '觉得你说话还算直接。' : '对你没有形成明显印象。',
      finance: state.npc.finance.relationship < 0
        ? '觉得你做事有点不负责任。'
        : contacts.includes('finance')
          ? facts.includes('FACT_MEETING_ROOM') ? '觉得你至少注意到了实际准备。' : '觉得你对流程还不够熟。'
        : '对你还没有明显评价。',
    },
  };
}
