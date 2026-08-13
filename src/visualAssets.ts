import type { ZoneId } from './types';

export interface EmployeeVisual {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  accent: string;
  sprite: string;
  displayName: string;
  displayRole: string;
}

export type PlayerGender = 'male' | 'female';

export const officeScene = {
  src: '/assets/scenes/office-6-person-master.png',
  width: 1672,
  height: 941,
  alt: '六人小公司办公室',
};

export const zoneLabels: Record<ZoneId, string> = {
  'ceo-office': 'CEO 办公室',
  'meeting-room': '会议室',
  'product-dev': '产品 / 研发区',
  'open-office': '开放办公区',
  pantry: '茶水间',
  'sales-area': '销售区',
  reception: '前台',
};

export const npcEmployeeIds = ['ceo', 'operations', 'sales', 'ui_designer', 'finance'] as const;

export const employeeVisuals: Record<string, EmployeeVisual> = {
  ceo: {
    x: 26,
    y: 51,
    scale: 1.08,
    zIndex: 510,
    accent: '#ff725e',
    sprite: '/assets/characters/zhou_qiming.png',
    displayName: '周启明',
    displayRole: '老板',
  },
  operations: {
    x: 61,
    y: 62,
    scale: 0.95,
    zIndex: 620,
    accent: '#c884ff',
    sprite: '/assets/characters/lin_jing.png',
    displayName: '林静',
    displayRole: '运营主管',
  },
  sales: {
    x: 44,
    y: 86,
    scale: 0.98,
    zIndex: 860,
    accent: '#53d694',
    sprite: '/assets/characters/gao_wei.png',
    displayName: '高伟',
    displayRole: '销售',
  },
  ui_designer: {
    x: 49,
    y: 61,
    scale: 0.92,
    zIndex: 610,
    accent: '#54b9e8',
    sprite: '/assets/characters/chen_cheng.png',
    displayName: '陈成',
    displayRole: '执行设计',
  },
  finance: {
    x: 84,
    y: 54,
    scale: 0.99,
    zIndex: 540,
    accent: '#f4b84f',
    sprite: '/assets/characters/wang_fang.png',
    displayName: '王芳',
    displayRole: '财务行政',
  },
};

export const playerVisuals: Record<PlayerGender, EmployeeVisual> = {
  male: {
    x: 73,
    y: 65,
    scale: 0.97,
    zIndex: 650,
    accent: '#9377ff',
    sprite: '/assets/characters/player_male.png',
    displayName: '我',
    displayRole: '男玩家角色',
  },
  female: {
    x: 73,
    y: 65,
    scale: 0.95,
    zIndex: 650,
    accent: '#ff79b0',
    sprite: '/assets/characters/player_female.png',
    displayName: '我',
    displayRole: '女玩家角色',
  },
};
