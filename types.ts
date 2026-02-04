
export enum InstrumentType {
  ACOUSTIC = 'ACOUSTIC',
  ELECTRIC = 'ELECTRIC',
  SITAR = 'SITAR',
  HARP = 'HARP',
  PIANO = 'PIANO'
}

export interface SongNote {
  key: string;
  time: number;     // Milliseconds
  duration: number; // Milliseconds
}

export interface Song {
  id: string;
  name: string;
  notes: SongNote[];
  duration: number;
}

export interface Recording {
  timestamp: number;
  notes: { key: string; time: number; duration?: number }[];
  instrument: InstrumentType;
}

export interface MusicModeSettings {
  enabled: boolean;
  sensitivity: number; // 0 to 100
  highlightColor: string;
  practiceMode: boolean;
  recordMode: boolean;
  speed: number; // 0.5 to 1.5
  transposition: number; // -12 to +12 semitones
  timelineEnabled: boolean;
  silentMode: boolean;
  showChords: boolean;
}

export interface KeyboardSettings {
  soundEnabled: boolean;
  volume: number;
  instrumentType: InstrumentType;
  musicMode: MusicModeSettings;
}

export type ViewType = 'HOME' | 'SETTINGS' | 'INSTRUCTIONS' | 'PRACTICE' | 'RECORDINGS';
