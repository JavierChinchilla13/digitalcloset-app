import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, RefreshCw, Scissors, CheckCircle2 } from 'lucide-react';
import { segmentationService } from '../../utils/segmentationService';
import { cloudinaryService } from '../../api/cloudinaryService';

interface JacketSegmentationToolProps {
  originalFile: File;
  onComplete: (segments: Record<string, string>) => void; // Map of segment name to Cloudinary URL
  onBack: () => void;
}

const JacketSegmentationTool: React.FC<JacketSegmentationToolProps> = ({ originalFile, onComplete, onBack }) => {
  const [segments, setSegments] = useState<Map<string, Blob>>(new Map());
  const [segmentUrls, setSegmentUrls] = useState<Map<string, string>>(new Map()); // Preview URLs
  const [isSegmenting, setIsSegmenting] = useState(true);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set(['torso', 'leftSleeve', 'rightSleeve']));

  useEffect(() => {
    const runSegmentation = async () => {
      try {
        const results = await segmentationService.segmentJacket(originalFile);
        setSegments(results);
        
        // Create preview URLs
        const urls = new Map<string, string>();
        results.forEach((blob, key) => {
          urls.set(key, URL.createObjectURL(blob));
        });
        setSegmentUrls(urls);
        setIsSegmenting(false);
      } catch (err) {
        console.error("Segmentation failed:", err);
        setIsSegmenting(false);
      }
    };

    runSegmentation();

    return () => {
      segmentUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [originalFile]);

  const handleFinish = async () => {
    setUploadingStatus('Uploading segments to cloud...');
    const finalUrls: Record<string, string> = {};
    
    try {
      for (const segmentName of Array.from(selectedSegments)) {
        const blob = segments.get(segmentName);
        if (blob) {
          setUploadingStatus(`Uploading ${segmentName}...`);
          const url = await cloudinaryService.uploadImage(blob);
          finalUrls[segmentName] = url;
        }
      }
      onComplete(finalUrls);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadingStatus(null);
    }
  };

  const toggleSegment = (name: string) => {
    const next = new Set(selectedSegments);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSegments(next);
  };

  if (isSegmenting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8 h-full">
        <div className="relative">
          <RefreshCw className="text-accent animate-spin" size={64} />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-accent/30 blur-3xl rounded-full"
          />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-light tracking-tight text-white uppercase italic">AI Semantic Analysis</h3>
          <p className="text-text-secondary text-[10px] font-black tracking-[0.4em] uppercase opacity-40">Parsing jacket architecture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-light tracking-tighter text-white uppercase italic italic">Step 3 — Architecture Decomposition</h2>
        <p className="text-text-secondary text-[10px] font-black tracking-widest uppercase opacity-40">Select identified regions for independent manipulation</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto no-scrollbar p-1">
        {Array.from(segmentUrls.entries()).map(([name, url]) => (
          <motion.div
            key={name}
            whileHover={{ scale: 1.02 }}
            onClick={() => toggleSegment(name)}
            className={`relative aspect-[3/4] rounded-3xl border-2 transition-all cursor-pointer overflow-hidden group ${
              selectedSegments.has(name) 
                ? 'border-accent bg-accent/5' 
                : 'border-white/5 bg-white/[0.02] grayscale opacity-60'
            }`}
          >
            <img src={url} alt={name} className="w-full h-full object-contain p-4" />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{name.replace(/([A-Z])/g, ' $1')}</span>
              {selectedSegments.has(name) && <CheckCircle2 size={16} className="text-accent" />}
            </div>

            {selectedSegments.has(name) && (
              <div className="absolute top-4 right-4 bg-accent text-white p-1 rounded-full">
                <Check size={12} />
              </div>
            )}
          </motion.div>
        ))}

        {segmentUrls.size === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-text-secondary border-2 border-dashed border-white/10 rounded-[2.5rem]">
            <Scissors size={48} className="opacity-20 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest opacity-40 text-center px-8">
              AI could not decompose this jacket automatically.<br/>Falling back to rigid single-layer mode.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {uploadingStatus && (
          <div className="flex items-center gap-3 justify-center text-accent animate-pulse">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{uploadingStatus}</span>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-6 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase transition-all"
          >
            Back
          </button>
          <button
            onClick={handleFinish}
            disabled={!!uploadingStatus}
            className="flex-[2] py-6 bg-accent hover:bg-accent-hover text-white rounded-[2rem] font-black text-xs tracking-[0.4em] uppercase transition-all shadow-xl shadow-accent/20 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {uploadingStatus ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
            <span>{segmentUrls.size > 0 ? 'Initialize Modular Studio' : 'Proceed Rigid'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default JacketSegmentationTool;
