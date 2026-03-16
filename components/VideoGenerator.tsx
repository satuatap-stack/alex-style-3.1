/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeResult, VideoSettings, AppSettings } from '../types';
import { ChevronLeftIcon, SparklesIcon, DownloadIcon, XIcon, SettingsIcon } from './icons';
import { generateVideo, getVideosOperation, getAIInstance } from '../services/geminiService';
import Spinner from './Spinner';

interface VideoGeneratorProps {
  selectedTheme: ThemeResult;
  onBack: () => void;
  appSettings: AppSettings;
  onOpenSettings: () => void;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ selectedTheme, onBack, appSettings, onOpenSettings }) => {
  const [prompt, setPrompt] = useState(`Model fashion ini sedang berjalan dengan anggun di ${selectedTheme.themeName}, pakaian bergerak tertiup angin sepoi-sepoi, pencahayaan sinematik.`);
  const [settings, setSettings] = useState<VideoSettings>({
    resolution: '720p',
    aspectRatio: '9:16',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentProvider = appSettings.useDefaultVeo ? 'gemini' : appSettings.videoProvider;

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    setProgress(`Memulai proses pembuatan video dengan ${currentProvider === 'gemini' ? 'Veo 3' : currentProvider.toUpperCase()}...`);

    try {
      if (currentProvider === 'gemini' && appSettings.useDefaultVeo) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      let operation = await generateVideo(
        selectedTheme.imageUrl,
        prompt,
        settings.resolution,
        settings.aspectRatio,
        settings.seed
      );

      setProgress(`Video sedang diproses oleh ${currentProvider === 'gemini' ? 'Veo 3' : currentProvider.toUpperCase()}...`);

      // If it's gemini, we might need to poll. Others might return result immediately.
      if (currentProvider === 'gemini' && !(operation as any).done) {
        while (!(operation as any).done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          try {
            operation = await getVideosOperation(operation);
            if ((operation as any).error) {
              throw new Error((operation as any).error.message || 'Gagal membuat video');
            }
          } catch (err: any) {
            if (err.message?.includes('Requested entity was not found')) {
              await window.aistudio.openSelectKey();
              throw new Error('Kunci API tidak valid atau sesi berakhir. Silakan pilih kunci lagi.');
            }
            throw err;
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
        if (downloadLink.startsWith('http')) {
          // For external URLs (Grok/OpenRouter), we can try to fetch or just use directly
          // But to avoid CORS issues and for consistency, we'll try to fetch if it's gemini
          if (currentProvider === 'gemini') {
            const { apiKey } = getAIInstance('video');
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
          } else {
            // For others, just use the URL directly
            setVideoUrl(downloadLink);
          }
        } else {
          throw new Error('Format link video tidak valid');
        }
      } else {
        throw new Error('Tidak ada video yang dihasilkan');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat membuat video');
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `video-fashion-${Date.now()}.mp4`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors group"
          >
            <ChevronLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Galeri
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSettings}
              className="p-3 bg-white border border-gray-200 rounded-xl shadow-md hover:bg-gray-50 transition-all active:scale-95 group"
              title="Pengaturan API KEY"
            >
              <SettingsIcon className="w-5 h-5 text-gray-700 group-hover:rotate-90 transition-transform duration-500" />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl shadow-md">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${appSettings.videoApiKey || appSettings.useDefaultVeo ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  VID: {appSettings.useDefaultVeo ? 'DEFAULT (VEO 3)' : `${appSettings.videoProvider.toUpperCase()}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Preview */}
          <div className="space-y-6">
            <h2 className="text-3xl font-serif font-medium text-gray-900">Buat Video Fashion</h2>
            <div className="aspect-[9/16] max-h-[70vh] bg-gray-100 rounded-2xl overflow-hidden shadow-xl relative">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={selectedTheme.imageUrl} 
                  alt="Selected Theme" 
                  className="w-full h-full object-cover"
                />
              )}
              
              <AnimatePresence>
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center"
                  >
                    <Spinner />
                    <p className="mt-4 text-lg font-medium">{progress}</p>
                    <p className="text-sm text-white/60 mt-2 italic">Proses ini mungkin memakan waktu beberapa menit...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {videoUrl && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
              >
                <DownloadIcon className="w-5 h-5" />
                Simpan Video ke Perangkat
              </button>
            )}
          </div>

          {/* Right: Controls */}
          <div className="space-y-8">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Deskripsi Gerakan Video (Prompt)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  placeholder="Deskripsikan bagaimana model harus bergerak..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Resolusi
                  </label>
                  <select
                    value={settings.resolution}
                    onChange={(e) => setSettings({...settings, resolution: e.target.value as any})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="720p">720p (Cepat)</option>
                    <option value="1080p">1080p (Kualitas Tinggi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Aspek Rasio
                  </label>
                  <select
                    value={settings.aspectRatio}
                    onChange={(e) => setSettings({...settings, aspectRatio: e.target.value as any})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider flex justify-between items-center">
                  Seed (Opsional)
                  <button 
                    onClick={() => setSettings({...settings, seed: Math.floor(Math.random() * 2147483647)})}
                    className="text-[10px] text-indigo-600 hover:underline font-normal"
                  >
                    Acak Seed
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.seed ?? ''}
                    onChange={(e) => setSettings({...settings, seed: e.target.value ? parseInt(e.target.value) : undefined})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Biarkan kosong untuk acak..."
                  />
                  {settings.seed !== undefined && (
                    <button 
                      onClick={() => setSettings({...settings, seed: undefined})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Gunakan seed yang sama untuk hasil yang konsisten.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-3">
                  <XIcon className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98]"
              >
                <SparklesIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Sedang Memproses...' : `Generate Video dengan ${currentProvider === 'gemini' ? 'Veo 3' : currentProvider.toUpperCase()}`}
              </button>
              
              <p className="text-xs text-gray-400 text-center">
                Memerlukan API Key berbayar. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-indigo-600">Pelajari selengkapnya</a>.
              </p>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <h3 className="font-bold text-indigo-900 mb-2">Tips Prompt Video:</h3>
              <ul className="text-sm text-indigo-800 space-y-2 list-disc list-inside">
                <li>Gunakan kata kerja aktif (berjalan, berputar, tersenyum).</li>
                <li>Sebutkan detail pencahayaan (sinar matahari, lampu neon).</li>
                <li>Deskripsikan pergerakan kain pakaian agar terlihat natural.</li>
                <li>Tambahkan suasana (anggun, energik, misterius).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
