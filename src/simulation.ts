import type {
  Employee,
  EmployeeChange,
  GameState,
  MetricKey,
  RelationshipChange,
  SimEvent,
} from './types';

type EventBlueprint = Omit<SimEvent, 'id' | 'time'>;

interface EventFactory {
  key: string;
  create: (state: GameState) => EventBlueprint;
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const eventFactories: EventFactory[] = [
  {
    key: 'product-change',
    create: () => ({
      title: '需求在开工后被临时改了',
      description: '林薇临时修改企业版需求，周岩盯着排期表沉默了很久。',
      icon: '⚡',
      involvedIds: ['product_manager', 'backend_engineer'],
      employeeChanges: [
        {
          employeeId: 'backend_engineer',
          stress: 12,
          satisfaction: -8,
          quitRisk: 4,
          currentThought: '产品再这样改，我真的会考虑离开。',
          currentTask: '重估接口改动与延期风险',
        },
        {
          employeeId: 'product_manager',
          stress: 4,
          currentThought: '这次改动是必要的，只能硬推。',
        },
      ],
      relationshipChanges: [
        { fromId: 'backend_engineer', toId: 'product_manager', delta: -10 },
        { fromId: 'product_manager', toId: 'backend_engineer', delta: -5 },
      ],
      metricChanges: { morale: -3, conflict: 4, businessPressure: 2, quitRisk: 2 },
    }),
  },
  {
    key: 'client-risk',
    create: () => ({
      title: '大客户正在接触竞争对手',
      description: '韩峰发现年度最大客户同时在测试竞品，销售区的气氛立刻紧张起来。',
      icon: '!',
      involvedIds: ['sales_lead', 'sales'],
      employeeChanges: [
        {
          employeeId: 'sales_lead',
          stress: 10,
          satisfaction: -3,
          currentThought: '必须在两天内把决策人约出来。',
          currentTask: '制定大客户挽回方案',
        },
        {
          employeeId: 'sales',
          stress: 6,
          currentThought: '今晚大概又要加班打电话了。',
        },
      ],
      relationshipChanges: [
        { fromId: 'sales_lead', toId: 'sales', delta: -4 },
        { fromId: 'sales', toId: 'sales_lead', delta: -3 },
      ],
      metricChanges: { businessPressure: 8, bossSatisfaction: -4, morale: -2 },
    }),
  },
  {
    key: 'tech-refusal',
    create: () => ({
      title: '技术负责人拒绝今晚强行上线',
      description: '顾言当面拒绝了沈知行的上线要求：现在发布，只是在赌不会出事故。',
      icon: '⚡',
      involvedIds: ['tech_lead', 'ceo'],
      employeeChanges: [
        {
          employeeId: 'tech_lead',
          stress: 7,
          satisfaction: 2,
          currentThought: '底线守住了，但 CEO 肯定不会高兴。',
        },
        {
          employeeId: 'ceo',
          stress: 6,
          satisfaction: -4,
          currentThought: '技术团队需要更强的交付意识。',
        },
      ],
      relationshipChanges: [
        { fromId: 'tech_lead', toId: 'ceo', delta: -5 },
        { fromId: 'ceo', toId: 'tech_lead', delta: -8 },
      ],
      metricChanges: { conflict: 5, businessPressure: 4, bossSatisfaction: -6 },
    }),
  },
  {
    key: 'intern-overheard',
    create: () => ({
      title: '实习生听到了裁员谈话',
      description: '陆一然在茶水间无意听到苏晴和沈知行讨论“人员优化名单”。',
      icon: '…',
      involvedIds: ['intern', 'hr', 'ceo'],
      employeeChanges: [
        {
          employeeId: 'intern',
          stress: 14,
          satisfaction: -7,
          quitRisk: 6,
          currentThought: '他们说的名单里会不会有我？',
        },
        {
          employeeId: 'hr',
          stress: 5,
          currentThought: '必须控制消息扩散。',
        },
      ],
      relationshipChanges: [
        { fromId: 'intern', toId: 'hr', delta: -7 },
        { fromId: 'intern', toId: 'ceo', delta: -6 },
      ],
      metricChanges: { morale: -4, conflict: 2, quitRisk: 4, bossSatisfaction: -2 },
    }),
  },
  {
    key: 'design-conflict',
    create: () => ({
      title: '设计稿被“顺手优化”了',
      description: '陈野为了赶进度改了几个关键交互，乔语看到成品后明显不高兴。',
      icon: '!',
      involvedIds: ['frontend_engineer', 'ui_designer'],
      employeeChanges: [
        {
          employeeId: 'ui_designer',
          stress: 7,
          satisfaction: -6,
          currentThought: '如果不尊重设计，评审还有什么意义？',
          currentTask: '逐项核对前端实现',
        },
        {
          employeeId: 'frontend_engineer',
          stress: 3,
          currentThought: '先上线再修细节才现实。',
        },
      ],
      relationshipChanges: [
        { fromId: 'ui_designer', toId: 'frontend_engineer', delta: -9 },
        { fromId: 'frontend_engineer', toId: 'ui_designer', delta: -4 },
      ],
      metricChanges: { morale: -2, conflict: 4, businessPressure: 1 },
    }),
  },
  {
    key: 'cash-warning',
    create: () => ({
      title: '财务发出了现金流预警',
      description: '赵辰把新版现金流表放到 CEO 桌上：按当前速度，安全垫正在快速变薄。',
      icon: '!',
      involvedIds: ['finance', 'ceo'],
      employeeChanges: [
        {
          employeeId: 'finance',
          stress: 8,
          satisfaction: -2,
          currentThought: '再不控制支出，下个月会更被动。',
          currentTask: '准备成本压缩清单',
        },
        {
          employeeId: 'ceo',
          stress: 5,
          currentThought: '融资和回款，至少要解决一个。',
        },
      ],
      relationshipChanges: [
        { fromId: 'finance', toId: 'ceo', delta: -3 },
        { fromId: 'ceo', toId: 'finance', delta: 2 },
      ],
      metricChanges: { cash: -18, businessPressure: 6, bossSatisfaction: -3 },
    }),
  },
  {
    key: 'sales-win',
    create: () => ({
      title: '销售拿下了一笔关键订单',
      description: '许乐跟进了三周的客户终于签约，销售区爆发出一阵欢呼。',
      icon: '✓',
      involvedIds: ['sales', 'sales_lead'],
      employeeChanges: [
        {
          employeeId: 'sales',
          stress: -9,
          satisfaction: 12,
          quitRisk: -4,
          currentThought: '这三周的坚持总算值了。',
          currentTask: '完成客户交接与回款跟进',
        },
        {
          employeeId: 'sales_lead',
          satisfaction: 7,
          stress: -4,
          currentThought: '团队的打法终于跑通了一次。',
        },
      ],
      relationshipChanges: [
        { fromId: 'sales_lead', toId: 'sales', delta: 8 },
        { fromId: 'sales', toId: 'sales_lead', delta: 5 },
      ],
      metricChanges: { cash: 46, morale: 6, businessPressure: -5, bossSatisfaction: 7 },
    }),
  },
  {
    key: 'production-bug',
    create: () => ({
      title: '线上服务突然出现故障',
      description: '计费服务短暂异常，周岩和陈野被同时拉进紧急排查群。',
      icon: '⚡',
      involvedIds: ['backend_engineer', 'frontend_engineer', 'tech_lead'],
      employeeChanges: [
        {
          employeeId: 'backend_engineer',
          stress: 11,
          satisfaction: -4,
          currentThought: '这正是技术债拖太久的结果。',
          currentTask: '紧急修复线上计费故障',
        },
        {
          employeeId: 'frontend_engineer',
          stress: 7,
          currentTask: '核对前端请求与错误兜底',
        },
        {
          employeeId: 'tech_lead',
          stress: 6,
          currentThought: '修完以后必须安排稳定性专项。',
        },
      ],
      relationshipChanges: [
        { fromId: 'backend_engineer', toId: 'tech_lead', delta: -3 },
        { fromId: 'tech_lead', toId: 'backend_engineer', delta: 3 },
      ],
      metricChanges: { cash: -8, morale: -3, businessPressure: 7, bossSatisfaction: -5 },
    }),
  },
  {
    key: 'hr-talk',
    create: (state) => {
      const employee = [...state.employees]
        .filter((item) => item.id !== 'hr' && item.id !== 'ceo')
        .sort((a, b) => b.stress - a.stress)[0];
      return {
        title: 'HR 约压力最高的员工聊了聊',
        description: `苏晴注意到${employee.name}状态不对，主动留出半小时听完了对方的抱怨。`,
        icon: '…',
        involvedIds: ['hr', employee.id],
        employeeChanges: [
          {
            employeeId: employee.id,
            stress: -8,
            satisfaction: 5,
            quitRisk: -4,
            currentThought: '至少公司里还有人愿意认真听。',
          },
          {
            employeeId: 'hr',
            stress: 3,
            satisfaction: 2,
          },
        ],
        relationshipChanges: [
          { fromId: employee.id, toId: 'hr', delta: 8 },
          { fromId: 'hr', toId: employee.id, delta: 4 },
        ],
        metricChanges: { morale: 4, conflict: -2, quitRisk: -3 },
      };
    },
  },
  {
    key: 'user-feedback',
    create: () => ({
      title: '一批尖锐的用户反馈涌了进来',
      description: '唐糖整理出高频问题，林薇发现它们正好击中了当前版本的薄弱处。',
      icon: '!',
      involvedIds: ['operations', 'product_manager'],
      employeeChanges: [
        {
          employeeId: 'operations',
          stress: 4,
          satisfaction: 2,
          currentThought: '用户愿意骂，至少说明还在用。',
          currentTask: '整理用户问题优先级',
        },
        {
          employeeId: 'product_manager',
          stress: 7,
          currentThought: '下个版本的方向需要重排。',
          currentTask: '重排版本需求优先级',
        },
      ],
      relationshipChanges: [
        { fromId: 'product_manager', toId: 'operations', delta: 6 },
        { fromId: 'operations', toId: 'product_manager', delta: 3 },
      ],
      metricChanges: { businessPressure: 5, conflict: 1, bossSatisfaction: -2 },
    }),
  },
  {
    key: 'meeting-alignment',
    create: () => ({
      title: '一次难得的高效评审会',
      description: '顾言和林薇在白板前把范围砍到可交付，团队终于对目标达成一致。',
      icon: '✓',
      involvedIds: ['tech_lead', 'product_manager', 'backend_engineer'],
      employeeChanges: [
        {
          employeeId: 'tech_lead',
          stress: -5,
          satisfaction: 5,
          currentThought: '只要范围清楚，团队就能交付。',
        },
        {
          employeeId: 'product_manager',
          stress: -4,
          satisfaction: 4,
          currentThought: '少做一点，也许真的能更快验证。',
        },
        {
          employeeId: 'backend_engineer',
          stress: -6,
          satisfaction: 4,
        },
      ],
      relationshipChanges: [
        { fromId: 'tech_lead', toId: 'product_manager', delta: 7 },
        { fromId: 'product_manager', toId: 'tech_lead', delta: 5 },
      ],
      metricChanges: { morale: 5, conflict: -5, businessPressure: -3, bossSatisfaction: 3 },
    }),
  },
  {
    key: 'competitor-poach',
    create: (state) => {
      const employee = [...state.employees]
        .filter((item) => !['ceo', 'hr'].includes(item.id))
        .sort((a, b) => b.quitRisk - a.quitRisk)[0];
      return {
        title: '竞争对手开始挖人',
        description: `${employee.name}收到一家竞争公司的私信，对方给出的条件颇有吸引力。`,
        icon: '…',
        involvedIds: [employee.id, 'hr'],
        employeeChanges: [
          {
            employeeId: employee.id,
            stress: 4,
            satisfaction: -2,
            quitRisk: 10,
            currentThought: '也许我应该认真听听外面的机会。',
          },
          {
            employeeId: 'hr',
            stress: 5,
            currentThought: '核心岗位的留人动作要提前了。',
          },
        ],
        relationshipChanges: [
          { fromId: employee.id, toId: 'hr', delta: -4 },
          { fromId: 'hr', toId: employee.id, delta: 3 },
        ],
        metricChanges: { morale: -3, quitRisk: 6, businessPressure: 2 },
      };
    },
  },
];

function createGodEvent(text: string, state: GameState): EventBlueprint {
  const staff = state.employees.filter((employee) => employee.id !== 'ceo');
  const vulnerable = [...staff]
    .sort((a, b) => b.ambition + b.quitRisk - (a.ambition + a.quitRisk))
    .slice(0, 3);
  const relationships: RelationshipChange[] = vulnerable.map((employee) => ({
    fromId: employee.id,
    toId: 'ceo',
    delta: -6,
  }));

  if (/裁员|优化|末位/.test(text)) {
    return {
      title: '上帝事件：裁员信号出现',
      description: text,
      icon: '⚡',
      involvedIds: ['ceo', 'hr', ...vulnerable.map((employee) => employee.id)],
      employeeChanges: staff.map((employee) => ({
        employeeId: employee.id,
        stress: 11,
        satisfaction: -9,
        quitRisk: employee.ambition > 70 ? 10 : 6,
        currentThought: '公司是不是已经不再安全了？',
      })),
      relationshipChanges: relationships.map((item) => ({ ...item, delta: -9 })),
      metricChanges: { morale: -14, conflict: 7, businessPressure: 5, quitRisk: 11, bossSatisfaction: -4 },
    };
  }

  if (/没有.*年终奖|取消.*年终奖|不发.*奖金|没有.*奖金/.test(text)) {
    return {
      title: '上帝事件：年终奖被取消',
      description: text,
      icon: '!',
      involvedIds: ['ceo', ...vulnerable.map((employee) => employee.id)],
      employeeChanges: staff.map((employee) => ({
        employeeId: employee.id,
        stress: 6,
        satisfaction: -10,
        quitRisk: employee.ambition > 70 || employee.satisfaction < 60 ? 8 : 4,
        currentThought: '努力和回报之间的关系，可能要重新算算了。',
      })),
      relationshipChanges: relationships.map((item) => ({ ...item, delta: -8 })),
      metricChanges: { cash: 35, morale: -13, conflict: 5, quitRisk: 8, bossSatisfaction: -3 },
    };
  }

  if (/加薪|奖金|涨薪|分红/.test(text)) {
    return {
      title: '上帝事件：公司释放了奖励信号',
      description: text,
      icon: '✓',
      involvedIds: ['ceo', ...vulnerable.map((employee) => employee.id)],
      employeeChanges: staff.map((employee) => ({
        employeeId: employee.id,
        stress: -4,
        satisfaction: 9,
        quitRisk: -6,
        currentThought: '至少公司愿意把回报讲清楚。',
      })),
      relationshipChanges: relationships.map((item) => ({ ...item, delta: 8 })),
      metricChanges: { cash: -42, morale: 12, conflict: -4, quitRisk: -7, bossSatisfaction: 4 },
    };
  }

  if (/融资|投资|到账/.test(text)) {
    return {
      title: '上帝事件：资金面突然转好',
      description: text,
      icon: '✓',
      involvedIds: ['ceo', 'finance', 'tech_lead'],
      employeeChanges: [
        { employeeId: 'ceo', stress: -12, satisfaction: 8, currentThought: '现在有空间打下一场仗了。' },
        { employeeId: 'finance', stress: -10, satisfaction: 7, currentThought: '现金安全垫终于回来了。' },
        { employeeId: 'tech_lead', stress: -5, satisfaction: 5 },
      ],
      relationshipChanges: [
        { fromId: 'finance', toId: 'ceo', delta: 8 },
        { fromId: 'tech_lead', toId: 'ceo', delta: 4 },
      ],
      metricChanges: { cash: 180, morale: 9, businessPressure: -10, quitRisk: -5, bossSatisfaction: 10 },
    };
  }

  if (/客户|订单|签约|回款/.test(text)) {
    return {
      title: '上帝事件：业务侧出现重大变化',
      description: text,
      icon: '✓',
      involvedIds: ['sales_lead', 'sales', 'ceo'],
      employeeChanges: [
        { employeeId: 'sales_lead', stress: -8, satisfaction: 10, currentThought: '这会改变整个季度的局面。' },
        { employeeId: 'sales', stress: -5, satisfaction: 7, quitRisk: -3 },
        { employeeId: 'ceo', stress: -5, satisfaction: 8 },
      ],
      relationshipChanges: [
        { fromId: 'ceo', toId: 'sales_lead', delta: 9 },
        { fromId: 'sales_lead', toId: 'sales', delta: 6 },
      ],
      metricChanges: { cash: 75, morale: 8, businessPressure: -9, bossSatisfaction: 9 },
    };
  }

  if (/团建|放假|休假/.test(text)) {
    return {
      title: '上帝事件：团队获得喘息机会',
      description: text,
      icon: '✓',
      involvedIds: ['hr', 'operations', ...vulnerable.map((employee) => employee.id)],
      employeeChanges: staff.map((employee) => ({
        employeeId: employee.id,
        stress: -8,
        satisfaction: 7,
        quitRisk: -3,
        currentThought: '总算可以从工作里抬起头了。',
      })),
      relationshipChanges: [
        { fromId: 'operations', toId: 'hr', delta: 7 },
        { fromId: 'hr', toId: 'operations', delta: 5 },
      ],
      metricChanges: { cash: -12, morale: 11, conflict: -5, businessPressure: -3, quitRisk: -4 },
    };
  }

  return {
    title: '上帝事件改变了公司的节奏',
    description: text,
    icon: '⚡',
    involvedIds: ['ceo', ...vulnerable.map((employee) => employee.id)],
    employeeChanges: vulnerable.map((employee) => ({
      employeeId: employee.id,
      stress: 5,
      satisfaction: -2,
      quitRisk: 3,
      currentThought: '这件事会把公司带向哪里？',
    })),
    relationshipChanges: relationships,
    metricChanges: { morale: -2, conflict: 3, businessPressure: 5, quitRisk: 2, bossSatisfaction: -2 },
  };
}

function applyEmployeeChange(employee: Employee, change: EmployeeChange): Employee {
  return {
    ...employee,
    stress: clamp(employee.stress + (change.stress ?? 0)),
    satisfaction: clamp(employee.satisfaction + (change.satisfaction ?? 0)),
    quitRisk: clamp(employee.quitRisk + (change.quitRisk ?? 0)),
    currentThought: change.currentThought ?? employee.currentThought,
    currentTask: change.currentTask ?? employee.currentTask,
  };
}

function applyEvent(state: GameState, event: SimEvent): GameState {
  const employees = state.employees.map((employee) => {
    const employeeChange = event.employeeChanges.find((change) => change.employeeId === employee.id);
    let updated = employeeChange ? applyEmployeeChange(employee, employeeChange) : employee;

    const relationshipChanges = event.relationshipChanges.filter((change) => change.fromId === employee.id);
    if (relationshipChanges.length > 0) {
      const relationships = [...updated.relationships];
      relationshipChanges.forEach((change) => {
        const index = relationships.findIndex((item) => item.targetId === change.toId);
        if (index >= 0) {
          relationships[index] = {
            ...relationships[index],
            value: clamp(relationships[index].value + change.delta, -100, 100),
          };
        } else {
          relationships.push({ targetId: change.toId, value: clamp(change.delta, -100, 100) });
        }
      });
      updated = { ...updated, relationships };
    }

    return updated;
  });

  const company = { ...state.company };
  (Object.entries(event.metricChanges) as [MetricKey, number][]).forEach(([key, delta]) => {
    company[key] = key === 'cash'
      ? clamp(company[key] + delta, -999, 9999)
      : clamp(company[key] + delta);
  });

  return { ...state, employees, company };
}

function randomTimes(count: number, includesGodEvent: boolean): string[] {
  const pool = ['09:20', '10:10', '11:40', '13:35', '14:25', '15:10', '16:20', '17:35', '18:30'];
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count - (includesGodEvent ? 1 : 0));
  if (includesGodEvent) shuffled.push('08:50');
  return shuffled.sort();
}

function addOneDay(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function advanceOneDay(current: GameState): GameState {
  const nextDate = addOneDay(current.date);
  const eventCount = 3 + Math.floor(Math.random() * 3);
  const hasGodEvent = Boolean(current.pendingGodEvent.trim());
  const previousTitles = new Set(current.todayEvents.map((event) => event.title));
  const available = eventFactories.filter((factory) => {
    const preview = factory.create(current);
    return !previousTitles.has(preview.title);
  });
  const normalCount = eventCount - (hasGodEvent ? 1 : 0);
  const selectedFactories = [...available]
    .sort(() => Math.random() - 0.5)
    .slice(0, normalCount);
  const blueprints: EventBlueprint[] = selectedFactories.map((factory) => factory.create(current));

  if (hasGodEvent) {
    blueprints.push(createGodEvent(current.pendingGodEvent.trim(), current));
  }

  const times = randomTimes(blueprints.length, hasGodEvent);
  const events = blueprints
    .map((blueprint, index): SimEvent => ({
      ...blueprint,
      id: `${nextDate}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      time: times[index],
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  let nextState: GameState = {
    ...current,
    day: current.day + 1,
    date: nextDate,
    todayEvents: events,
    pendingGodEvent: '',
  };

  events.forEach((event) => {
    nextState = applyEvent(nextState, event);
  });

  return nextState;
}
