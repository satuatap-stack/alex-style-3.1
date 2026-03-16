
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { RotateCcwIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon, VideoIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import { THEMES } from '../constants';

interface CanvasProps {
  displayImageUrl: string | null;
  displayVideoUrl?: string | null;
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  availablePoseKeys: string[];
  onGenerateThemes: () => void;
  isGeneratingThemes: boolean;
  onGenerateVideo?: () => void;
  selectedManualThemeId: string;
  onSelectManualThemeId: (id: string) => void;
  isManualDropdownOpen: boolean;
  onToggleManualDropdown: () => void;
  onGenerateManualTheme: () => void;
  isGeneratingManualTheme: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
  displayImageUrl, 
  displayVideoUrl,
  onStartOver, 
  isLoading, 
  loadingMessage, 
  onSelectPose, 
  poseInstructions, 
  currentPoseIndex, 
  availablePoseKeys, 
  onGenerateThemes, 
  isGeneratingThemes,
  onGenerateVideo,
  selectedManualThemeId,
  onSelectManualThemeId,
  isManualDropdownOpen,
  onToggleManualDropdown,
  onGenerateManualTheme,
  isGeneratingManualTheme
}) => {
  
  const handlePreviousPose = () => {
    if (isLoading || availablePoseKeys.length <= 1) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    
    if (currentIndexInAvailable === -1) {
        onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
        return;
    }

    const prevIndexInAvailable = (currentIndexInAvailable - 1 + availablePoseKeys.length) % availablePoseKeys.length;
    const prevPoseInstruction = availablePoseKeys[prevIndexInAvailable];
    const newGlobalPoseIndex = poseInstructions.indexOf(prevPoseInstruction);
    
    if (newGlobalPoseIndex !== -1) {
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleNextPose = () => {
    if (isLoading) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);

    if (currentIndexInAvailable === -1 || availablePoseKeys.length === 0) {
        onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
        return;
    }
    
    const nextIndexInAvailable = currentIndexInAvailable + 1;
    if (nextIndexInAvailable < availablePoseKeys.length) {
        const nextPoseInstruction = availablePoseKeys[nextIndexInAvailable];
        const newGlobalPoseIndex = poseInstructions.indexOf(nextPoseInstruction);
        if (newGlobalPoseIndex !== -1) {
            onSelectPose(newGlobalPoseIndex);
        }
    } else {
        const newGlobalPoseIndex = (currentPoseIndex + 1) % poseInstructions.length;
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleDownload = () => {
    const url = displayVideoUrl || displayImageUrl;
    if (!url) return;
    const isVideo = !!displayVideoUrl;
    const link = document.createElement('a');
    link.href = url;
    link.download = `hasil-uji-coba-${Date.now()}.${isVideo ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in group">
      {/* Top Controls - Start Over & Download */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
        <button 
            onClick={onStartOver}
            className="pointer-events-auto flex items-center justify-center bg-white/90 backdrop-blur-md border border-gray-200 text-gray-700 font-bold py-2.5 px-5 rounded-2xl transition-all duration-200 hover:bg-white hover:shadow-lg active:scale-95 text-xs shadow-sm"
        >
            <RotateCcwIcon className="w-3.5 h-3.5 mr-2" />
            Mulai Dari Awal
        </button>

        {(displayImageUrl || displayVideoUrl) && !isLoading && (
          <button 
              onClick={handleDownload}
              className="pointer-events-auto flex items-center justify-center bg-gray-900 text-white font-bold py-2.5 px-5 rounded-2xl transition-all duration-200 hover:bg-gray-800 hover:shadow-lg active:scale-95 text-xs shadow-md"
          >
              <DownloadIcon className="w-3.5 h-3.5 mr-2" />
              Simpan {displayVideoUrl ? 'Video' : 'Gambar'}
          </button>
        )}
      </div>

      {/* Left Sidebar - Generation Controls */}
      {displayImageUrl && (
        <div className="absolute left-4 top-20 bottom-4 z-30 hidden md:flex flex-col gap-4 w-64 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-3 p-4 bg-white/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl shadow-black/5">
            <div className="px-2 pb-2 border-b border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Auto Generate</p>
            </div>
            
            <button 
                onClick={onGenerateThemes}
                disabled={isLoading || isGeneratingThemes}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-2xl transition-all hover:bg-indigo-700 active:scale-95 text-xs shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
                <SparklesIcon className={`w-4 h-4 ${isGeneratingThemes ? 'animate-spin' : ''}`} />
                {isGeneratingThemes ? 'Memproses...' : 'Generate Semua Tema'}
            </button>
            
            {onGenerateVideo && (
              <button 
                  onClick={onGenerateVideo}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-2xl transition-all hover:bg-gray-50 active:scale-95 text-xs shadow-sm disabled:opacity-50"
              >
                  <VideoIcon className="w-4 h-4 text-indigo-600" />
                  Animasikan Model
              </button>
            )}

            <div className="pt-4 px-2 pb-2 border-b border-gray-100 mt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Manual Select</p>
            </div>

            <div className="relative">
              <button 
                  onClick={onToggleManualDropdown}
                  disabled={isLoading || isGeneratingManualTheme}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-xs font-bold ${
                    isManualDropdownOpen 
                      ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10 text-indigo-600' 
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  } disabled:opacity-50`}
              >
                  <span className="truncate">
                    {selectedManualThemeId 
                      ? THEMES.find(t => t.id === selectedManualThemeId)?.name 
                      : 'Pilih Tema...'}
                  </span>
                  {isManualDropdownOpen ? <ChevronUpIcon className="w-4 h-4 ml-2" /> : <ChevronDownIcon className="w-4 h-4 ml-2" />}
              </button>

              <AnimatePresence>
                {isManualDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto custom-scrollbar"
                  >
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          onSelectManualThemeId(theme.id);
                          onToggleManualDropdown();
                        }}
                        className={`w-full text-left px-5 py-4 text-xs transition-all hover:bg-indigo-50 flex flex-col gap-1 border-b border-gray-50 last:border-0 ${
                          selectedManualThemeId === theme.id ? 'bg-indigo-50/80 text-indigo-700 font-bold' : 'text-gray-700'
                        }`}
                      >
                        <span className="tracking-tight">{theme.name}</span>
                        <span className="text-[9px] font-normal text-gray-400 line-clamp-1 italic">{theme.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {selectedManualThemeId && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onGenerateManualTheme}
                disabled={isLoading || isGeneratingManualTheme}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGeneratingManualTheme ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <SparklesIcon className="w-4 h-4" />
                )}
                Generate Sekarang
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Controls - Bottom Bar */}
      {displayImageUrl && (
        <div className="absolute bottom-4 left-4 right-4 z-40 md:hidden flex flex-col gap-2">
           <div className="flex gap-2">
              <button 
                  onClick={onGenerateThemes}
                  disabled={isLoading || isGeneratingThemes}
                  className="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-lg"
              >
                  {isGeneratingThemes ? '...' : 'Generate Semua'}
              </button>
              <button 
                  onClick={onToggleManualDropdown}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-2xl text-xs shadow-sm"
              >
                  Manual Select
              </button>
           </div>
           
           <AnimatePresence>
              {isManualDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed inset-x-4 bottom-20 bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden z-[60] max-h-[50vh] overflow-y-auto"
                >
                   <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Pilih Tema</p>
                      <button onClick={onToggleManualDropdown} className="p-2 bg-gray-100 rounded-full"><XIcon className="w-4 h-4" /></button>
                   </div>
                   <div className="p-2">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          onSelectManualThemeId(theme.id);
                          onToggleManualDropdown();
                        }}
                        className="w-full text-left px-5 py-4 text-sm border-b border-gray-50 last:border-0"
                      >
                        {theme.name}
                      </button>
                    ))}
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      )}

      {/* Image Display or Placeholder */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-10">
        <div className="relative w-full h-full max-w-md md:max-w-lg max-h-[65vh] md:max-h-[80vh] flex items-center justify-center bg-white rounded-[2rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] overflow-hidden border border-gray-100/80 group/canvas">
          {displayVideoUrl ? (
            <video
              key={displayVideoUrl}
              src={displayVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain transition-all duration-500 animate-fade-in rounded-[1.5rem]"
              id="main-canvas-video"
              style={{ 
                filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.15))',
                transform: 'scale(1.02)'
              }}
            />
          ) : displayImageUrl ? (
            <img
              key={displayImageUrl}
              src={displayImageUrl}
              alt="Model uji coba virtual"
              className="w-full h-full object-contain transition-all duration-500 animate-fade-in rounded-[1.5rem]"
              id="main-canvas-image"
              style={{ 
                filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.15))',
                transform: 'scale(1.02)'
              }}
            />
          ) : (
              <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="relative z-10 flex flex-col items-center">
                  <Spinner />
                  <p className="text-md font-serif text-gray-600 mt-4">Memuat Model...</p>
                </div>
              </div>
          )}
          
          <AnimatePresence>
            {isLoading && (
                <motion.div
                    className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <Spinner />
                    {loadingMessage && (
                        <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                    )}
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pose Controls - Moved to the right side */}
      {displayImageUrl && !isLoading && (
        <div 
          className="absolute right-6 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col gap-2 max-h-[80vh] w-64 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Variasi Pose</p>
               <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {currentPoseIndex + 1} / {poseInstructions.length}
              </span>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar p-3 space-y-1.5 max-h-[50vh]">
              {poseInstructions.map((pose, index) => (
                <button
                  key={`${pose}-${index}`}
                  onClick={() => onSelectPose(index)}
                  disabled={isLoading || index === currentPoseIndex}
                  className={`w-full text-left text-[11px] leading-tight font-bold p-4 rounded-2xl transition-all ${
                    index === currentPoseIndex 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' 
                      : 'text-gray-600 hover:bg-white hover:shadow-sm hover:translate-x-1'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {pose}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-6 bg-gray-50/30">
              <button 
                onClick={handlePreviousPose}
                aria-label="Pose sebelumnya"
                className="p-3 rounded-2xl hover:bg-white hover:shadow-sm active:scale-90 transition-all disabled:opacity-30"
                disabled={isLoading}
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-800" />
              </button>
              <button 
                onClick={handleNextPose}
                aria-label="Pose berikutnya"
                className="p-3 rounded-2xl hover:bg-white hover:shadow-sm active:scale-90 transition-all disabled:opacity-30"
                disabled={isLoading}
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-800" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
