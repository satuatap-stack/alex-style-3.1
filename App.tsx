
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { 
  generateVirtualTryOnImage, 
  generatePoseVariation, 
  generateThemeVariation,
  generateVideo,
  getVideosOperation
} from './services/geminiService';
import { OutfitLayer, WardrobeItem, ThemeResult, AppSettings } from './types';
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon, XIcon, GrokIcon, VideoIcon, DownloadIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';
import ThemeGallery from './components/ThemeGallery';
import VideoGenerator from './components/VideoGenerator';
import CustomVideoGenerator from './components/CustomVideoGenerator';
import SettingsModal from './components/SettingsModal';
import { THEMES } from './constants';

const POSE_INSTRUCTIONS = [
  "Tampilan depan, tangan di pinggang",
  "Agak miring, tampilan 3/4",
  "Tampilan profil samping",
  "Melompat di udara",
  "Berjalan ke arah kamera",
  "Bersandar di dinding",
  "S-Curve ekstrem, bobot di satu kaki belakang",
  "Over-the-shoulder, tatapan tajam ke belakang",
  "Tangan di saku, bahu rileks",
  "Bahu maju membungkuk powerful",
  "Duduk lantai dramatis, satu lutut tinggi",
  "Lengan disilang tinggi di dada",
  "Melihat ke samping jauh, leher memanjang",
  "Tangan membingkai wajah editorial",
  "Condong ke depan agresif ke kamera",
  "Lengan asimetris, satu diangkat tinggi",
  "Jongkok powerful, tangan di lutut",
  "Lengkung badan ke belakang sensual"
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', listener);
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }
    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [themeResults, setThemeResults] = useState<ThemeResult[]>([]);
  const [isGeneratingThemes, setIsGeneratingThemes] = useState(false);
  const [selectedManualThemeId, setSelectedManualThemeId] = useState<string>(THEMES[0].id);
  const [isManualDropdownOpen, setIsManualDropdownOpen] = useState(false);
  const [isGeneratingManualTheme, setIsGeneratingManualTheme] = useState(false);
  const [manualThemeResult, setManualThemeResult] = useState<ThemeResult | null>(null);
  const [selectedThemeForVideo, setSelectedThemeForVideo] = useState<ThemeResult | null>(null);
  const [selectedThemeForCustomVideo, setSelectedThemeForCustomVideo] = useState<ThemeResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse app settings', e);
    }
    return {
      imageProvider: 'gemini',
      imageApiKey: '',
      videoProvider: 'gemini',
      videoApiKey: '',
      useDefaultGemini: true,
      useDefaultVeo: true,
    };
  });
  const isMobile = useMediaQuery('(max-width: 767px)');

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  const displayVideoUrl = useMemo(() => {
    if (outfitHistory.length === 0) return null;
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer?.videoUrl || null;
  }, [outfitHistory, currentOutfitIndex]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleGenerateCanvasVideo = useCallback(async () => {
    if (!displayImageUrl || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage("Menganimasikan model...");

    try {
      const prompt = "Model fashion ini sedang bergerak dengan anggun, pakaian bergerak tertiup angin sepoi-sepoi, pencahayaan sinematik, kualitas tinggi.";
      const operation = await generateVideo(
        displayImageUrl as string,
        prompt,
        '720p',
        '9:16'
      );

      let finalOperation = operation;
      if (!finalOperation.done) {
        while (!finalOperation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          finalOperation = await getVideosOperation(finalOperation);
        }
      }

      const videoUrl = finalOperation.response?.generatedVideos?.[0]?.video?.uri;
      if (videoUrl) {
        setOutfitHistory(prev => {
          const newHistory = [...prev];
          if (newHistory[currentOutfitIndex]) {
            newHistory[currentOutfitIndex].videoUrl = videoUrl;
          }
          return newHistory;
        });
      } else {
        throw new Error('Tidak ada URL video yang ditemukan dalam respon API.');
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err as any, 'Gagal membuat video'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentOutfitIndex]);

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    setThemeResults([]);
    setManualThemeResult(null);
    setIsGeneratingThemes(false);
    setIsGeneratingManualTheme(false);
    setSelectedThemeForVideo(null);
    setSelectedThemeForCustomVideo(null);
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
  };

  const handleGenerateManualTheme = useCallback(async () => {
    if (!displayImageUrl || isLoading || isGeneratingManualTheme) return;

    const theme = THEMES.find(t => t.id === selectedManualThemeId);
    if (!theme) return;

    setIsGeneratingManualTheme(true);
    setError(null);

    try {
      const imageUrl = await generateThemeVariation(displayImageUrl as string, theme.desc);
      setManualThemeResult({
        themeId: theme.id,
        themeName: theme.name,
        imageUrl
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err as any, 'Gagal mengenerate tema manual'));
    } finally {
      setIsGeneratingManualTheme(false);
    }
  }, [displayImageUrl, isLoading, isGeneratingManualTheme, selectedManualThemeId]);

  const handleGenerateThemes = useCallback(async () => {
    if (!displayImageUrl || isLoading || isGeneratingThemes) return;

    setIsGeneratingThemes(true);
    setThemeResults([]);
    setError(null);

    try {
      // We generate themes one by one to avoid overwhelming the API
      // and to show progress to the user.
      for (const theme of THEMES.slice(0, 150)) {
        try {
          const imageUrl = await generateThemeVariation(displayImageUrl as string, theme.desc);
          setThemeResults(prev => [...prev, {
            themeId: theme.id,
            themeName: theme.name,
            imageUrl
          }]);
          
          // Add a 1-second delay between successful requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`Failed to generate theme ${theme.name}:`, err);
          // Continue with next theme even if one fails
        }
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err as any, 'Gagal mengenerate tema'));
    } finally {
      setIsGeneratingThemes(false);
    }
  }, [displayImageUrl, isLoading, isGeneratingThemes]);

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    // Check for displayImageUrl before proceeding
    if (!displayImageUrl || isLoading) return;

    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0);
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Menambahkan ${garmentInfo.name}...`);

    try {
      // Fixed: Explicitly cast displayImageUrl to string to satisfy type checker
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl as string, garmentFile);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) {
            return prev;
        }
        return [...prev, garmentInfo];
      });
    } catch (err) {
      // Fixed: Explicitly cast err to any for getFriendlyErrorMessage
      setError(getFriendlyErrorMessage(err as any, 'Gagal menerapkan pakaian'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Mengubah pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      // Fixed: Cast baseImageForPoseChange to string to satisfy type checker (Error on line 182)
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange as string, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        if (updatedLayer) {
           updatedLayer.poseImages[poseInstruction] = newImageUrl;
        }
        return newHistory;
      });
    } catch (err) {
      // Fixed: Explicitly cast err to any for getFriendlyErrorMessage
      setError(getFriendlyErrorMessage(err as any, 'Gagal mengubah pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex]);

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans min-h-screen bg-gray-50 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-full min-h-screen flex items-center justify-center p-4"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen 
              onModelFinalized={handleModelFinalized} 
              onOpenSettings={() => setIsSettingsOpen(true)}
              appSettings={appSettings}
            />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col min-h-screen bg-white overflow-y-auto"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-white/60 backdrop-blur-md border border-gray-300/80 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${appSettings.useDefaultGemini ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                    <span className="hidden sm:inline">IMG:</span>
                    <span>{appSettings.useDefaultGemini ? 'DEF' : appSettings.imageProvider.substring(0, 3)}</span>
                  </div>
                  <div className="w-[1px] h-3 bg-gray-300 mx-1"></div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${appSettings.useDefaultVeo ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                    <span className="hidden sm:inline">VID:</span>
                    <span>{appSettings.useDefaultVeo ? 'DEF' : appSettings.videoProvider.substring(0, 3)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 bg-white/60 backdrop-blur-md border border-gray-300/80 rounded-full text-gray-700 hover:bg-white transition-all shadow-sm active:scale-95"
                  title="Pengaturan API"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  displayVideoUrl={displayVideoUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onGenerateThemes={handleGenerateThemes}
                  isGeneratingThemes={isGeneratingThemes}
                  onGenerateVideo={handleGenerateCanvasVideo}
                  selectedManualThemeId={selectedManualThemeId}
                  onSelectManualThemeId={setSelectedManualThemeId}
                  isManualDropdownOpen={isManualDropdownOpen}
                  onToggleManualDropdown={() => setIsManualDropdownOpen(!isManualDropdownOpen)}
                  onGenerateManualTheme={handleGenerateManualTheme}
                  isGeneratingManualTheme={isGeneratingManualTheme}
                />
                
                {/* Manual Theme Result Area - Professional Card Style */}
                {manualThemeResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 w-full max-w-4xl mx-auto"
                  >
                    <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col md:flex-row items-center gap-10 md:gap-16 relative overflow-hidden">
                      {/* Decorative Background Element */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                      
                      <div className="flex-1 flex flex-col gap-6 text-center md:text-left relative z-10">
                        <div className="inline-flex items-center justify-center md:justify-start gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full w-fit mx-auto md:mx-0">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manual Generation Success</span>
                        </div>
                        
                        <h3 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 leading-tight">
                          {manualThemeResult.themeName}
                        </h3>
                        
                        <p className="text-gray-500 text-sm leading-relaxed max-w-md">
                          Hasil generate manual berdasarkan tema yang Anda pilih. Anda dapat menganimasikan model ini atau menyimpannya ke perangkat Anda.
                        </p>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                          <button
                            onClick={() => setSelectedThemeForCustomVideo(manualThemeResult)}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-amber-100"
                          >
                            <GrokIcon className="w-4 h-4" />
                            Grok Video
                          </button>
                          <button
                            onClick={() => setSelectedThemeForVideo(manualThemeResult)}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-indigo-100"
                          >
                            <VideoIcon className="w-4 h-4" />
                            Animasikan
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = manualThemeResult.imageUrl;
                              link.download = `manual-outfit-${manualThemeResult.themeId}.png`;
                              link.click();
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-xs transition-all active:scale-95"
                          >
                            <DownloadIcon className="w-4 h-4" />
                            Simpan Gambar
                          </button>
                        </div>
                      </div>

                      <div className="relative group w-full md:w-72 aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-gray-100 transition-transform duration-500 hover:scale-[1.02]">
                        <img 
                          src={manualThemeResult.imageUrl} 
                          alt={manualThemeResult.themeName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-6">
                           <p className="text-white text-[10px] font-bold uppercase tracking-widest">Preview Result</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Perluas panel' : 'Sembunyikan panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-50/50 backdrop-blur-sm border border-red-200 text-red-800 p-4 mb-6 rounded-2xl shadow-sm overflow-hidden relative group" 
                        role="alert"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Peringatan Sistem</p>
                        <p className="text-sm leading-relaxed font-medium">{error}</p>
                        <button 
                          onClick={() => setError(null)}
                          className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                    />
                    <WardrobePanel
                      onGarmentSelect={handleGarmentSelect}
                      activeGarmentIds={activeGarmentIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                    />
                  </div>
              </aside>
            </main>
            <ThemeGallery 
              themes={themeResults} 
              isGenerating={isGeneratingThemes} 
              onCreateVideo={(theme) => setSelectedThemeForVideo(theme)}
              onCreateCustomVideo={(theme) => setSelectedThemeForCustomVideo(theme)}
            />
            <AnimatePresence>
              {isSettingsOpen && (
                <SettingsModal
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  settings={appSettings}
                  onSave={handleSaveSettings}
                />
              )}
              {selectedThemeForVideo && (
                <VideoGenerator 
                  selectedTheme={selectedThemeForVideo} 
                  onBack={() => setSelectedThemeForVideo(null)} 
                  appSettings={appSettings}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              )}
              {selectedThemeForCustomVideo && (
                <CustomVideoGenerator
                  selectedTheme={selectedThemeForCustomVideo}
                  onBack={() => setSelectedThemeForCustomVideo(null)}
                  appSettings={appSettings}
                  onSaveSettings={handleSaveSettings}
                />
              )}
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
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
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;
