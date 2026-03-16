
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, SettingsIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage, refineModelImage } from '../services/geminiService';
import Spinner from './Spinner';
import { getFriendlyErrorMessage } from '../lib/utils';
import { AppSettings } from '../types';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
  onOpenSettings: () => void;
  appSettings: AppSettings;
}

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized, onOpenSettings, appSettings }) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineText, setRefineText] = useState("");

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
        setError('Silakan pilih file gambar.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUserImageUrl(dataUrl);
        setIsGenerating(true);
        setGeneratedModelUrl(null);
        setError(null);
        try {
            const result = await generateModelImage(file);
            setGeneratedModelUrl(result);
        } catch (err) {
            setError(getFriendlyErrorMessage(err as any, 'Gagal membuat model'));
            setUserImageUrl(null);
        } finally {
            setIsGenerating(false);
        }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRefine = async () => {
    if (!generatedModelUrl || !refineText.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const result = await refineModelImage(generatedModelUrl, refineText);
      setGeneratedModelUrl(result);
      setRefineText("");
    } catch (err) {
      setError(getFriendlyErrorMessage(err as any, 'Gagal memperbaiki model'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const reset = () => {
    setUserImageUrl(null);
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setError(null);
    setRefineText("");
  };

  const screenVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  return (
    <AnimatePresence mode="wait">
      {!userImageUrl ? (
        <motion.div
          key="uploader"
          className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 relative py-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="max-w-lg">
              <h1 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 leading-tight">
                Buat Model Pribadi untuk Segala Gaya.
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Pernah membayangkan bagaimana pakaian tertentu tampak di tubuh Anda? Berhenti menebak. Unggah foto dan lihat hasilnya. AI kami membuat model pribadi Anda, siap mencoba apa pun.
              </p>
              <hr className="my-8 border-gray-200" />
              <div className="flex flex-col items-center lg:items-start w-full gap-3">
                <label htmlFor="image-upload-start" className="w-full relative flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-gray-900 rounded-xl cursor-pointer group hover:bg-gray-800 transition-all shadow-xl active:scale-[0.98]">
                  <UploadCloudIcon className="w-6 h-6 mr-3" />
                  Unggah Foto Anda
                </label>
                <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                <p className="text-gray-500 text-sm">Pilih foto seluruh tubuh yang jelas untuk hasil terbaik.</p>
                <p className="text-gray-500 text-xs mt-1">Dengan mengunggah, Anda setuju untuk tidak membuat konten berbahaya atau melanggar hukum. Layanan ini untuk penggunaan kreatif yang bertanggung jawab.</p>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
            <Compare
              firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
              secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
              slideMode="drag"
              className="w-full max-w-sm aspect-[3/4] rounded-2xl bg-gray-200"
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="compare"
          className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 relative py-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* API Settings Button & Status Indicator */}
          <div className="absolute top-0 left-0 z-50 flex items-center gap-3 p-6">
            <button
              onClick={onOpenSettings}
              className="p-3 bg-white border border-gray-200 rounded-xl shadow-md hover:bg-gray-50 transition-all active:scale-95 group"
              title="Pengaturan API KEY"
            >
              <SettingsIcon className="w-5 h-5 text-gray-700 group-hover:rotate-90 transition-transform duration-500" />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl shadow-md">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${appSettings.imageApiKey || appSettings.useDefaultGemini ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">IMG: {appSettings.useDefaultGemini ? 'DEFAULT' : appSettings.imageProvider}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${appSettings.videoApiKey || appSettings.useDefaultVeo ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">VID: {appSettings.useDefaultVeo ? 'DEFAULT' : appSettings.videoProvider}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:w-1/2 flex-shrink-0 flex flex-col items-center md:items-start w-full">
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 leading-tight">
                Versi Baru Anda
              </h1>
              <p className="mt-2 text-md text-gray-600">
                Geser slider untuk melihat transformasi Anda.
              </p>
            </div>
            
            {isGenerating && (
              <div className="flex items-center gap-3 text-lg text-gray-700 font-serif mt-6">
                <Spinner />
                <span>Memproses...</span>
              </div>
            )}

            {error && 
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center md:text-left mt-6 p-4 bg-red-50 border border-red-100 rounded-xl"
              >
                <p className="font-bold text-red-700 mb-1">Pembuatan Gagal</p>
                <p className="text-sm text-red-600 mb-4 leading-relaxed">{error}</p>
                <button 
                  onClick={reset} 
                  className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Coba Lagi &rarr;
                </button>
              </motion.div>
            }
            
            <AnimatePresence>
              {generatedModelUrl && !isGenerating && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5 }}
                  className="w-full space-y-6 mt-8"
                >
                  {/* Refinement UI */}
                  <div className="w-full max-w-md p-4 bg-gray-100 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Perbaiki Model (Opsional)</p>
                    <div className="flex flex-col gap-2">
                      <textarea 
                        value={refineText}
                        onChange={(e) => setRefineText(e.target.value)}
                        placeholder="Contoh: 'Buat wajah lebih mirip foto asli' atau 'Ganti baju dengan kaos putih polos'..."
                        className="w-full h-24 p-3 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:outline-none resize-none transition-all"
                      />
                      <button
                        onClick={handleRefine}
                        disabled={!refineText.trim() || isGenerating}
                        className="w-full py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        Perbaiki Hasil
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={reset}
                      className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-gray-700 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
                    >
                      Gunakan Foto Lain
                    </button>
                    <button 
                      onClick={() => onModelFinalized(generatedModelUrl)}
                      className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors shadow-lg"
                    >
                      Lanjut ke Penataan &rarr;
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:w-1/2 w-full flex items-center justify-center">
            <div 
              className={`relative rounded-[1.25rem] transition-all duration-700 ease-in-out ${isGenerating ? 'border border-gray-300 animate-pulse' : 'border border-transparent'}`}
            >
              <Compare
                firstImage={userImageUrl}
                secondImage={generatedModelUrl ?? userImageUrl}
                slideMode="drag"
                className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartScreen;
