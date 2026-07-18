export interface ReleaseNotes {
  version: string;
  date?: string;
  noteKeys: string[];
}

// Newest first. Add an entry ONLY for player-facing releases.
// noteKeys are i18n keys defined in every locale file (see §5).
export const RELEASE_NOTES: ReleaseNotes[] = [
  {
    version: '3.0.0',
    date: '2026-07-18',
    noteKeys: [
      'whatsNew.v3_0_0.0',
      'whatsNew.v3_0_0.1',
      'whatsNew.v3_0_0.2',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-07-17',
    noteKeys: [
      'whatsNew.v2_2_0.0',
      'whatsNew.v2_2_0.1',
      'whatsNew.v2_2_0.2',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-07-16',
    noteKeys: [
      'whatsNew.v2_1_0.0',
      'whatsNew.v2_1_0.1',
      'whatsNew.v2_1_0.2',
      'whatsNew.v2_1_0.3',
      'whatsNew.v2_1_0.4',
      'whatsNew.v2_1_0.5',
      'whatsNew.v2_1_0.6',
      'whatsNew.v2_1_0.7',
    ],
  },
];

export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? '';

/** >0 if a>b, <0 if a<b, 0 if equal. Numeric dot-segments, missing = 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
