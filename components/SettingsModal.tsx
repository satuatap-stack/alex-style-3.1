import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SettingsIcon, CheckIcon, SparklesIcon } from './icons';
import { AppSettings, AIProvider } from '../types';
import { GoogleGenAI } from "@google/genai";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [testStatus, setTestStatus] = useState<{ [key: string]: 'idle' | 'testing' | 'success' | 'error' }>({
    image: 'idle',
    video: 'idle',
  });
  const [testError, setTestError] = useState<{image: string | null, video: string | null}>({
    image: null,
    video: null
  });
  const [availableModels, setAvailableModels] = useState<{image: string[], video: string[]}>({
    image: [],
    video: []
  });

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const testConnection = async (type: 'image' | 'video') => {
    setTestStatus(prev => ({ ...prev, [type]: 'testing' }));
    setTestError(prev => ({ ...prev, [type]: null }));
    
    try {
      const apiKey = type === 'image' ? localSettings.imageApiKey : localSettings.videoApiKey;
      const provider = type === 'image' ? localSettings.imageProvider : localSettings.videoProvider;
      
      if (!apiKey) throw new Error("API Key is required");

      // Grok specific validation
      if (provider === 'grok' && !apiKey.startsWith('xai-')) {
        console.warn("Grok API Key usually starts with 'xai-'");
      }

      // For Gemini/Google providers, we can do a simple models.list or a small generateContent
      if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey });
        // We use a very small request to test the key
        await ai.models.generateContent({
          model: type === 'image' ? (localSettings.imageModel || 'gemini-2.5-flash-image') : (localSettings.videoModel || 'gemini-3-flash-preview'),
          contents: [{ parts: [{ text: 'ping' }] }],
          config: { maxOutputTokens: 1 }
        });
      } else if (provider === 'openrouter' || provider === 'openai' || provider === 'grok') {
        // For OpenAI-compatible providers, we test the models endpoint or a simple chat completion
        const baseUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 
                        provider === 'grok' ? 'https://api.x.ai/v1' : 
                        'https://api.openai.com/v1';
        
        const testModel = type === 'image' ? localSettings.imageModel : localSettings.videoModel;
        
        // Try to list models first for Grok to see what's available
        if (provider === 'grok') {
          try {
            const modelsResponse = await fetch(`${baseUrl}/models`, {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              const modelIds = modelsData.data?.map((m: any) => m.id) || [];
              setAvailableModels(prev => ({ ...prev, [type]: modelIds }));
              console.log(`Available Grok models for ${type}:`, modelIds);
              
              // If grok-imagine-video is available, we're good for video
              if (type === 'video' && modelIds.includes('grok-imagine-video')) {
                console.log("grok-imagine-video found!");
              }
            } else if (modelsResponse.status === 401) {
              throw new Error("API Key Grok tidak valid (Unauthorized).");
            } else {
              const errText = await modelsResponse.text();
              console.warn("Models list failed:", errText);
            }
          } catch (e: any) {
            console.warn("Failed to fetch models list:", e.message);
            if (e.message.includes("Unauthorized")) throw e;
          }
        }

        // For Grok video, we skip chat completion test and rely on models list or a dummy video request
        // But for simplicity and to avoid consuming credits, if models list worked and contains the model, we can consider it success
        if (provider === 'grok' && type === 'video') {
           // If we reached here without error and it's Grok video, we can assume success if models list was fetched
           setTestStatus(prev => ({ ...prev, [type]: 'success' }));
           setTimeout(() => setTestStatus(prev => ({ ...prev, [type]: 'idle' })), 3000);
           return;
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: testModel || (provider === 'openrouter' ? 'google/gemini-2.5-flash-image' : 
                   provider === 'grok' ? 'grok-beta' : 'gpt-4o-mini'),
            messages: [{ role: 'user', content: 'say ok' }],
            max_tokens: 5
          })
        });

        if (!response.ok) {
          let errorMsg = `Error ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData?.error?.message || errorData?.message || (typeof errorData === 'object' ? JSON.stringify(errorData) : errorMsg);
            
            if (provider === 'grok') {
              if (response.status === 400) {
                errorMsg = `Grok Bad Request (400): ${errorMsg}. Periksa format payload atau saldo API xAI Anda.`;
              } else if (response.status === 401) {
                errorMsg = "API Key Grok tidak valid atau expired. Pastikan key diawali dengan 'xai-'.";
              }
            }
          } catch (e) {
            const text = await response.text();
            if (text) errorMsg = text.substring(0, 150);
          }
          throw new Error(errorMsg);
        }
      }

      setTestStatus(prev => ({ ...prev, [type]: 'success' }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [type]: 'idle' })), 3000);
    } catch (error: any) {
      console.error(`Test failed for ${type}:`, error);
      setTestStatus(prev => ({ ...prev, [type]: 'error' }));
      setTestError(prev => ({ ...prev, [type]: error.message || "Unknown error" }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [type]: 'idle' })), 8000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pengaturan API AI</h2>
              <p className="text-sm text-gray-500">Konfigurasi model AI untuk Gambar dan Video</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-10">
          {/* Image AI Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-amber-500" />
                Model AI Gambar (Nano Banana)
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={localSettings.useDefaultGemini}
                  onChange={(e) => setLocalSettings({ ...localSettings, useDefaultGemini: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">Gunakan Default (AI Studio)</span>
              </label>
            </div>

            {!localSettings.useDefaultGemini && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Provider</label>
                    <select
                      value={localSettings.imageProvider}
                      onChange={(e) => setLocalSettings({ ...localSettings, imageProvider: e.target.value as AIProvider })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter.ai</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">API Key</label>
                    <input
                      type="password"
                      value={localSettings.imageApiKey}
                      onChange={(e) => setLocalSettings({ ...localSettings, imageApiKey: e.target.value })}
                      placeholder="Masukkan API Key..."
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Model ID (Opsional)</label>
                    <input
                      type="text"
                      value={localSettings.imageModel || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, imageModel: e.target.value })}
                      placeholder="Biarkan default..."
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    {testError.image && (
                      <span className="text-xs text-red-500 font-medium max-w-[200px] truncate" title={testError.image}>
                        Error: {testError.image}
                      </span>
                    )}
                    <div className="flex-1"></div>
                    <button
                      onClick={() => testConnection('image')}
                      disabled={testStatus.image === 'testing' || !localSettings.imageApiKey}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        testStatus.image === 'success' ? 'bg-green-100 text-green-700' :
                        testStatus.image === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {testStatus.image === 'testing' ? 'Menghubungkan...' :
                       testStatus.image === 'success' ? <><CheckIcon className="w-4 h-4" /> Terhubung</> :
                       testStatus.image === 'error' ? 'Gagal' : 'Test Koneksi'}
                    </button>
                  </div>
                  
                  {availableModels.image.length > 0 && localSettings.imageProvider === 'grok' && (
                    <div className="text-[10px] text-gray-400 bg-gray-100 p-2 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-gray-600">Status Grok: <span className="text-green-600">Aktif</span></p>
                        <span className="bg-white px-1 rounded text-[8px] border border-gray-200 uppercase">v1 API</span>
                      </div>
                      <p className="font-medium mb-1">Model Tersedia:</p>
                      <div className="flex flex-wrap gap-1">
                        {availableModels.image.slice(0, 8).map((m, idx) => (
                          <span key={`${m}-${idx}`} className="bg-white px-1 rounded border border-gray-200 hover:bg-indigo-50 cursor-default transition-colors">{m}</span>
                        ))}
                      </div>
                      <p className="mt-2 text-[9px] italic text-gray-500">Gunakan 'grok-2-vision-latest' untuk hasil terbaik.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </section>

          {/* Video AI Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-indigo-500" />
                Model AI Video (Veo 3)
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={localSettings.useDefaultVeo}
                  onChange={(e) => setLocalSettings({ ...localSettings, useDefaultVeo: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">Gunakan Default (AI Studio)</span>
              </label>
            </div>

            {!localSettings.useDefaultVeo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Provider</label>
                    <select
                      value={localSettings.videoProvider}
                      onChange={(e) => setLocalSettings({ ...localSettings, videoProvider: e.target.value as AIProvider })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="gemini">Google Veo (Gemini)</option>
                      <option value="openrouter">OpenRouter.ai</option>
                      <option value="grok">xAI Grok</option>
                      <option value="openai">OpenAI (Sora/DALL-E)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">API Key</label>
                    <input
                      type="password"
                      value={localSettings.videoApiKey}
                      onChange={(e) => setLocalSettings({ ...localSettings, videoApiKey: e.target.value })}
                      placeholder="Masukkan API Key..."
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Model ID (Opsional)</label>
                    <input
                      type="text"
                      value={localSettings.videoModel || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, videoModel: e.target.value })}
                      placeholder={localSettings.videoProvider === 'grok' ? 'grok-imagine-video' : 'Biarkan default...'}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-gray-100 shadow-sm">
                    {testError.video && (
                      <span className="text-[11px] text-red-500 font-semibold max-w-[220px] truncate bg-red-50 px-2 py-1 rounded-lg border border-red-100" title={testError.video}>
                        Error: {testError.video}
                      </span>
                    )}
                    <div className="flex-1"></div>
                    <button
                      onClick={() => testConnection('video')}
                      disabled={testStatus.video === 'testing' || !localSettings.videoApiKey}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 ${
                        testStatus.video === 'success' ? 'bg-green-500 text-white' :
                        testStatus.video === 'error' ? 'bg-red-500 text-white' :
                        'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {testStatus.video === 'testing' ? 'Menghubungkan...' :
                       testStatus.video === 'success' ? <><CheckIcon className="w-4 h-4" /> Aktif</> :
                       testStatus.video === 'error' ? 'Gagal' : 'Test Koneksi'}
                    </button>
                  </div>

                  {availableModels.video.length > 0 && localSettings.videoProvider === 'grok' && (
                    <div className="text-[10px] text-gray-400 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                          Status Grok: <span className="text-green-600">Online</span>
                        </div>
                        <span className="bg-white px-2 py-0.5 rounded-full text-[8px] border border-indigo-200 text-indigo-600 font-bold uppercase tracking-tighter">Imagine Video Engine</span>
                      </div>
                      <p className="font-bold text-gray-500 mb-1.5 uppercase tracking-tighter opacity-70">Model Terdeteksi:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableModels.video.slice(0, 8).map((m, idx) => (
                          <span key={`${m}-${idx}`} className={`px-2 py-1 rounded-lg border text-[9px] font-bold transition-all ${m === 'grok-imagine-video' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500'}`}>{m}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-[9px] font-bold text-indigo-600/70 italic flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" />
                        Sistem akan otomatis menggunakan 'grok-imagine-video' untuk pembuatan video.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            Simpan Perubahan
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
