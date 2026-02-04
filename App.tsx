
import React, { useState, useEffect, useRef } from 'react';
import { ViewType, KeyboardSettings, InstrumentType, Song, Recording } from './types';
import Keyboard from './components/Keyboard';
import Settings from './components/Settings';
import Instructions from './components/Instructions';
import SongTimeline from './components/SongTimeline';
import { pitchDetectionService } from './services/pitchDetectionService';
import { songAnalysisService } from './services/songAnalysisService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('HOME');
  const [typedText, setTypedText] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  
  const [settings, setSettings] = useState<KeyboardSettings>({
    soundEnabled: true,
    volume: 80,
    instrumentType: InstrumentType.ACOUSTIC,
    musicMode: {
      enabled: false,
      sensitivity: 50,
      highlightColor: '#06b6d4',
      practiceMode: false,
      recordMode: false,
      speed: 1.0,
      transposition: 0,
      timelineEnabled: true,
      silentMode: false,
      showChords: true
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIntervalRef = useRef<number | null>(null);

  // Sync playback time
  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = window.setInterval(() => {
        if (audioRef.current && !settings.musicMode.silentMode) {
          setPlaybackTime(audioRef.current.currentTime * 1000);
        } else {
          setPlaybackTime(prev => prev + (16 * settings.musicMode.speed));
        }
      }, 16);
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, settings.musicMode.silentMode, settings.musicMode.speed]);

  // Handle Key Highlighting during Song Playback
  useEffect(() => {
    if (activeSong && isPlaying) {
      const currentNotes = activeSong.notes.filter(n => 
        playbackTime >= n.time && playbackTime <= n.time + n.duration
      );
      
      const nextHighlighted = new Set<string>();
      currentNotes.forEach(n => nextHighlighted.add(n.key.toUpperCase()));
      setHighlightedKeys(nextHighlighted);
    } else if (!settings.musicMode.enabled) {
      setHighlightedKeys(new Set());
    }
  }, [playbackTime, activeSong, isPlaying, settings.musicMode.enabled]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAnalysisProgress(0);
      const song = await songAnalysisService.analyzeMP3(file, setAnalysisProgress);
      setActiveSong(song);
      
      // Setup audio element for non-silent playback
      if (audioRef.current) audioRef.current.src = URL.createObjectURL(file);
      else audioRef.current = new Audio(URL.createObjectURL(file));
      
      setAnalysisProgress(null);
    } catch (err) {
      alert("Failed to analyze song. Ensure it is a valid MP3.");
      setAnalysisProgress(null);
    }
  };

  const exportMIDI = () => {
    if (!activeSong) return;
    
    // Simple Standard MIDI File (SMF) Format 0 Generation (Header + Track)
    const header = [
      0x4D, 0x54, 0x68, 0x64, // MThd
      0x00, 0x00, 0x00, 0x06, // Length
      0x00, 0x00,             // Format 0
      0x00, 0x01,             // 1 Track
      0x01, 0xE0              // 480 ticks per quarter
    ];

    const trackHeader = [0x4D, 0x54, 0x72, 0x6B]; // MTrk
    const events: number[] = [];
    
    // Convert notes to MIDI events (Simplified)
    activeSong.notes.forEach(note => {
      const midiNote = 60 + (note.key.charCodeAt(0) - 65); // Mapping A to 60+
      events.push(0x00, 0x90, midiNote, 0x64); // Note On
      events.push(0x81, 0x40, 0x80, midiNote, 0x00); // Note Off after delta
    });
    
    events.push(0x00, 0xFF, 0x2F, 0x00); // End of track
    
    const trackLength = events.length;
    const trackLenBytes = [
      (trackLength >> 24) & 0xFF,
      (trackLength >> 16) & 0xFF,
      (trackLength >> 8) & 0xFF,
      trackLength & 0xFF
    ];

    const midiFile = new Uint8Array([...header, ...trackHeader, ...trackLenBytes, ...events]);
    const blob = new Blob([midiFile], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSong.name}.mid`;
    a.click();
  };

  const togglePlayback = () => {
    if (!activeSong) return;
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current && !settings.musicMode.silentMode) {
        audioRef.current.playbackRate = settings.musicMode.speed;
        audioRef.current.play();
      }
      setIsPlaying(true);
    }
  };

  const handleKeyPress = (char: string) => {
    if (char === 'BS') setTypedText(prev => prev.slice(0, -1));
    else if (char === 'ENT') setTypedText(prev => prev + '\n');
    else setTypedText(prev => prev + char);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'SETTINGS':
        return <Settings settings={settings} onUpdate={setSettings} onBack={() => setCurrentView('HOME')} />;
      case 'INSTRUCTIONS':
        return <Instructions onBack={() => setCurrentView('HOME')} />;
      case 'HOME':
      default:
        return (
          <div className="flex flex-col h-full bg-slate-900">
            {/* Header */}
            <header className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-music text-white text-sm"></i>
                </div>
                <h1 className="font-bold text-lg leading-none">MusicKey <span className="text-xs text-blue-400">PRO</span></h1>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCurrentView('INSTRUCTIONS')} className="p-2 text-slate-400"><i className="fa-solid fa-circle-question"></i></button>
                <button onClick={() => setCurrentView('SETTINGS')} className="p-2 text-slate-400"><i className="fa-solid fa-gear"></i></button>
              </div>
            </header>

            {/* Analysis Progress Overlay */}
            {analysisProgress !== null && (
              <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-10">
                <div className="w-full bg-slate-800 h-2 rounded-full mb-4 overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${analysisProgress}%` }}></div>
                </div>
                <p className="text-white font-bold animate-pulse">Analyzing Song Spectrum... {analysisProgress}%</p>
                <p className="text-slate-400 text-xs mt-2">Extracting dominant notes offline</p>
              </div>
            )}

            {/* Song Tools Dashboard */}
            <div className="px-4 py-3 bg-slate-800/20 flex gap-2 items-center overflow-x-auto no-scrollbar border-b border-slate-800 shrink-0">
              <label className="shrink-0 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                <i className="fa-solid fa-file-audio"></i>
                OPEN MP3
                <input type="file" accept="audio/mp3" onChange={handleFileUpload} className="hidden" />
              </label>

              {activeSong && (
                <>
                  <button onClick={togglePlayback} className="shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                  </button>
                  <button onClick={() => { setPlaybackTime(0); if(audioRef.current) audioRef.current.currentTime = 0; }} className="shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-rotate-left text-xs"></i>
                  </button>
                  <button onClick={exportMIDI} className="shrink-0 px-3 py-1.5 bg-emerald-600 rounded-full text-[10px] font-bold">
                    EXPORT MIDI
                  </button>
                  <div className="shrink-0 flex items-center gap-1 bg-slate-800 rounded-full px-2 py-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">KEY:</span>
                    <button onClick={() => setSettings(s => ({ ...s, musicMode: { ...s.musicMode, transposition: Math.max(-12, s.musicMode.transposition - 1) }}))} className="text-xs px-1 text-blue-400">-</button>
                    <span className="text-xs font-bold w-4 text-center">{settings.musicMode.transposition > 0 ? '+' : ''}{settings.musicMode.transposition}</span>
                    <button onClick={() => setSettings(s => ({ ...s, musicMode: { ...s.musicMode, transposition: Math.min(12, s.musicMode.transposition + 1) }}))} className="text-xs px-1 text-blue-400">+</button>
                  </div>
                </>
              )}
            </div>

            {/* Main Area */}
            <main className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
              {activeSong && settings.musicMode.timelineEnabled && (
                <SongTimeline song={activeSong} currentTime={playbackTime} settings={settings.musicMode} />
              )}
              
              <div className="flex-1 bg-slate-800/40 rounded-xl border border-slate-700 p-4 relative overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                    {activeSong ? `Playing: ${activeSong.name}` : 'Ready to analyze'}
                  </span>
                  <div className="flex gap-2">
                     <button onClick={() => setSettings(s => ({...s, musicMode: {...s.musicMode, silentMode: !s.musicMode.silentMode}}))} 
                             className={`text-[9px] px-2 py-0.5 rounded border ${settings.musicMode.silentMode ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'border-slate-600 text-slate-400'}`}>
                        SILENT MODE
                     </button>
                  </div>
                </div>
                <textarea 
                  className="flex-1 bg-transparent resize-none outline-none text-white font-mono placeholder-slate-700 text-lg"
                  placeholder="Analyze a song to begin playing along..."
                  value={typedText}
                  readOnly
                />
              </div>

              {/* Speed Controls */}
              <div className="mt-4 flex gap-2 justify-center">
                 {[0.5, 0.75, 1.0, 1.25, 1.5].map(s => (
                   <button 
                    key={s} 
                    onClick={() => setSettings(prev => ({ ...prev, musicMode: { ...prev.musicMode, speed: s }}))}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold ${settings.musicMode.speed === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                   >
                     {s}x
                   </button>
                 ))}
              </div>
            </main>

            <div className="shrink-0 w-full mt-auto">
              <Keyboard 
                settings={settings} 
                onKeyPress={handleKeyPress} 
                highlightedKeys={highlightedKeys} 
              />
              <div className="bg-[#1e293b] h-4 flex justify-center pb-2">
                <div className="w-20 h-1 bg-slate-700 rounded-full opacity-30"></div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full flex justify-center bg-black overflow-hidden">
      <div className="relative w-full max-w-lg h-full bg-slate-900 shadow-2xl overflow-hidden border-x border-slate-800">
        {renderContent()}
      </div>
    </div>
  );
};

export default App;
