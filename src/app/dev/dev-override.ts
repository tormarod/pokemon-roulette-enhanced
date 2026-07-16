import { WheelItem } from '../interfaces/wheel-item';

export type WheelForceMode = 'off' | 'win' | 'lose' | 'pick';
let mode: WheelForceMode = 'off';
let pickedIndex: number | null = null;

export function setWheelForceMode(m: WheelForceMode): void { mode = m; install(); }
export function setPickedIndex(i: number | null): void { pickedIndex = i; }

function install(): void {
  (window as unknown as { __devForceWheelIndex?: (items: WheelItem[]) => number | null })
    .__devForceWheelIndex = (items: WheelItem[]): number | null => {
      if (mode === 'win') return items.findIndex(i => i.text.endsWith('.yes'));
      if (mode === 'lose') return items.findIndex(i => i.text.endsWith('.no'));
      if (mode === 'pick') { const i = pickedIndex; pickedIndex = null; return i; } // one-shot
      return null;
    };
}
