import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeResult, AppSettings, AIProvider } from '../types';
import { 
  ChevronLeftIcon, 
  SparklesIcon, 
  DownloadIcon, 
  XIcon, 
  SettingsIcon, 
  GrokIcon, 
  SlidersIcon,
  CheckIcon
} from './icons';
import Spinner from './Spinner';
import SettingsModal from './SettingsModal';
import { 
  generateVideo, 
  getVideosOperation, 
  getAIInstance 
} from '../services/geminiService';

interface CustomVideoGeneratorProps {
  selectedTheme: ThemeResult;
  onBack: () => void;
  appSettings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

const CustomVideoGenerator: React.FC<CustomVideoGeneratorProps> = ({ 
  selectedTheme, 
  onBack, 
  appSettings,
  onSaveSettings
}) => {
  const [prompt, setPrompt] = useState(`Cinematic fashion video of a model in ${selectedTheme.themeName}, high detail, 4k, smooth motion.`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Custom settings for non-Veo models
  const [customSettings, setCustomSettings] = useState({
    motionBucket: 127,
    steps: 25,
    cfgScale: 7.5,
    fps: 24,
    seed: -1,
    provider: appSettings.videoProvider === 'gemini' ? 'openrouter' : appSettings.videoProvider
  });

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    
    try {
      // Check if API key is set for the selected provider
      const { apiKey } = getAIInstance('video');
      if (!apiKey && !appSettings.useDefaultVeo) {
        throw new Error(`API Key untuk ${customSettings.provider} belum diatur. Buka pengaturan untuk mengaturnya.`);
      }

      console.log(`Generating video using ${customSettings.provider} with prompt: ${prompt}`);
      
      let operation = await generateVideo(
        selectedTheme.imageUrl,
        prompt,
        '720p',
        '9:16'
      );

      const { provider: currentProvider } = getAIInstance('video');

      if (currentProvider === 'gemini' && !operation.done) {
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await getVideosOperation(operation);
          if ((operation as any).error) {
            throw new Error(((operation as any).error.message as string) || 'Gagal membuat video');
          }
        }
      }
      
      if (!operation.response) {
        console.error('Operation is done but response is missing:', operation);
        throw new Error('API mengembalikan status selesai tetapi tidak ada data video. Silakan periksa konsol untuk detailnya.');
      }
      
      const generatedVideos = operation.response?.generatedVideos;
      if (!generatedVideos || generatedVideos.length === 0) {
        console.error('Operation response has no videos:', operation.response);
        throw new Error('API tidak mengembalikan video. Ini mungkin karena filter keamanan atau kesalahan teknis.');
      }

      const downloadLink = generatedVideos[0]?.video?.uri;
      if (downloadLink) {
        if (downloadLink.startsWith('data:') || downloadLink.startsWith('http')) {
          setVideoUrl(downloadLink);
        } else {
          const response = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': (apiKey || '') as string,
            },
          });
          
          if (!response.ok) throw new Error('Gagal mengunduh video hasil generate');
          
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
        }
      } else {
        throw new Error('Tidak ada video yang dihasilkan');
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal membuat video');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `custom-video-${Date.now()}.mp4`;
    link.click();
  };

  const apiStatus = appSettings.videoApiKey ? 'connected' : 'disconnected';

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <GrokIcon className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Custom Image-to-Video</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200">
            <div className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {customSettings.provider}: {apiStatus === 'connected' ? 'TERHUBUNG' : 'TIDAK ADA KEY'}
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            title="Pengaturan API"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Preview Area */}
        <div className="flex-grow bg-gray-900 flex items-center justify-center p-8 relative overflow-hidden">
          <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden relative group">
            {videoUrl ? (
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain"
              />
            ) : (
              <img 
                src={selectedTheme.imageUrl} 
                alt="Source Image" 
                className="w-full h-full object-contain opacity-80"
              />
            )}

            <AnimatePresence>
              {isGenerating && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center z-10"
                >
                  <Spinner />
                  <p className="mt-4 text-xl font-bold tracking-tight">Menghasilkan Video...</p>
                  <p className="text-sm text-white/60 mt-2">Menggunakan {customSettings.provider} API</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overlay Info */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
               <div className="bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white text-xs">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-white/60 mb-1">Source Image</p>
                  <p className="truncate max-w-[200px]">{selectedTheme.themeName}</p>
               </div>
               {videoUrl && (
                 <button
                   onClick={handleDownload}
                   className="bg-white text-black p-3 rounded-full shadow-xl hover:scale-110 transition-transform"
                 >
                   <DownloadIcon className="w-5 h-5" />
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* Right: Controls Panel */}
        <div className="w-full lg:w-[400px] bg-white border-l border-gray-100 flex flex-col shrink-0">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <SlidersIcon className="w-4 h-4" />
              Panel Kontrol
            </h2>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-8">
            {/* Provider Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase">Video Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {['grok', 'openrouter'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setCustomSettings({ ...customSettings, provider: p as any });
                      onSaveSettings({ ...appSettings, videoProvider: p as any });
                    }}
                    className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                      customSettings.provider === p 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    {p === 'grok' ? 'xAI Grok' : 'OpenRouter'}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase">Video Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-sm"
                placeholder="Deskripsikan gerakan video..."
              />
            </div>

            {/* Advanced Settings */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-500 uppercase">Advanced Settings</label>
                <button 
                  onClick={() => setCustomSettings({
                    motionBucket: 127,
                    steps: 25,
                    cfgScale: 7.5,
                    fps: 24,
                    seed: -1,
                    provider: customSettings.provider
                  })}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  RESET
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Motion Bucket</span>
                    <span className="text-xs font-bold text-indigo-600">{customSettings.motionBucket}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="255" 
                    value={customSettings.motionBucket}
                    onChange={(e) => setCustomSettings({...customSettings, motionBucket: parseInt(e.target.value)})}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Steps</span>
                    <span className="text-xs font-bold text-indigo-600">{customSettings.steps}</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="50" 
                    value={customSettings.steps}
                    onChange={(e) => setCustomSettings({...customSettings, steps: parseInt(e.target.value)})}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">CFG Scale</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={customSettings.cfgScale}
                      onChange={(e) => setCustomSettings({...customSettings, cfgScale: parseFloat(e.target.value)})}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">FPS</label>
                    <select 
                      value={customSettings.fps}
                      onChange={(e) => setCustomSettings({...customSettings, fps: parseInt(e.target.value)})}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="12">12 FPS</option>
                      <option value="24">24 FPS</option>
                      <option value="30">30 FPS</option>
                      <option value="60">60 FPS</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs flex items-start gap-3">
                <XIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50/30">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <SparklesIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Sedang Memproses...' : `Generate Video (${customSettings.provider})`}
            </button>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={appSettings}
            onSave={onSaveSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomVideoGenerator;
