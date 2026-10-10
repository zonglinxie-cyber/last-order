// 话术牌局与人工场音效：WebAudio 现合成，不用音频文件（写法沿用 ../src/RushGame.tsx 的 beep —
// 首次用户手势时才创建/resume AudioContext，所有异常吞掉，静音状态存 localStorage）。
// `at` 是起音延迟（秒）：同一次状态变化里要响两下时（成交 + 翻脸）用它错开，不叠成一团。
export type SfxKind = "tap" | "card" | "brush" | "up" | "down" | "register" | "bell" | "regular" | "lead";

const MUTE_KEY = "last-order-duel-muted";
let ctx: AudioContext | null = null;
let muted = false;
try { muted = window.localStorage.getItem(MUTE_KEY) === "1"; } catch { /* 私密模式下读不到就当没存过 */ }

export const sfxMuted = () => muted;
export function sfxMute(next: boolean) {
  muted = next;
  try { window.localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* 同上 */ }
}

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx || ctx.state === "closed") ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(frequency: number, at: number, length = 0.16, type: OscillatorType = "sine", volume = 0.06) {
  const c = ctx!;
  const oscillator = c.createOscillator(), gain = c.createGain(), time = c.currentTime + at;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + length);
  oscillator.connect(gain);
  gain.connect(c.destination);
  oscillator.start(time);
  oscillator.stop(time + length + 0.02);
}

// 上脸是刷子的声音：300ms 滤波噪声，比一声 beep 更像"擦过去"。
function brushStroke(at: number) {
  const c = ctx!;
  const length = Math.floor(c.sampleRate * 0.3);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.8;
  gain.gain.value = 0.12;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  source.start(c.currentTime + at);
}

export function sfx(kind: SfxKind, at = 0) {
  try {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    ctx = c;
    if (kind === "tap") tone(880, at, 0.08, "sine", 0.04);
    else if (kind === "card") { tone(392, at, 0.1, "triangle", 0.05); tone(523.25, at + 0.05, 0.12, "triangle", 0.05); }
    else if (kind === "brush") brushStroke(at);
    else if (kind === "up") { tone(523.25, at, 0.12); tone(783.99, at + 0.07, 0.14); }
    else if (kind === "down") { tone(392, at, 0.12, "sawtooth", 0.03); tone(311.13, at + 0.07, 0.16, "sawtooth", 0.03); }
    else if (kind === "register") { tone(1046.5, at, 0.09, "square", 0.035); tone(1046.5, at + 0.1, 0.09, "square", 0.035); tone(1318.5, at + 0.2, 0.22, "triangle", 0.06); }
    else if (kind === "bell") { tone(1568, at, 0.5, "sine", 0.05); tone(1174.7, at + 0.18, 0.5, "sine", 0.035); }
    // 回头客：先落一拍再抬上去，像门口那阵风铃 —— 和"新开一单"的收银声是两个形状。
    else if (kind === "regular") { tone(659.25, at, 0.12, "sine", 0.05); tone(880, at + 0.1, 0.2, "triangle", 0.055); }
    // 反超：一路向上的四个音，比"看法变好"那两个音长，胜负这一档要听得出不一样。
    else if (kind === "lead") {
      tone(523.25, at, 0.1, "triangle", 0.05); tone(659.25, at + 0.08, 0.1, "triangle", 0.05);
      tone(783.99, at + 0.16, 0.12, "triangle", 0.055); tone(1046.5, at + 0.26, 0.24, "sine", 0.06);
    }
  } catch { /* 音效是增强：浏览器音频限制不能打断一局。 */ }
}
