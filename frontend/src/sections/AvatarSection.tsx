import { useState } from "react";
import { motion } from "framer-motion";
import { UserCog, Sparkles, Save, Loader2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { usePersonaStore } from "../store/usePersonaStore";
import { useOutfitStore, outfitItemsFromEquipped } from "../store/useOutfitStore";
import type { OutfitRequest } from "../types";
import PersonaRenderer from "../components/PersonaRenderer";
import PersonaSpotlight from "../components/PersonaSpotlight";

const AvatarSection = () => {
  const { persona } = usePersonaStore();
  const { saveOutfit } = useOutfitStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveOutfit = async () => {
    if (!persona) return;
    setIsSaving(true);

    const outfitData: OutfitRequest = {
      name: `Style ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      avatarType: persona.type,
      items: outfitItemsFromEquipped(persona),
    };

    try {
      await saveOutfit(outfitData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save outfit:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-32 bg-background-main">
      <PersonaSpotlight />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-24 z-20 text-center pointer-events-none"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles size={14} className="text-accent" />
          <span className="text-[10px] font-black tracking-[0.4em] text-accent uppercase">
            Persona Core
          </span>
        </div>
      </motion.div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        <PersonaRenderer persona={persona} />

        <div className="mt-12 flex flex-col items-center gap-10 w-full px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            <Link
              to="/persona"
              className="px-12 py-5 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 text-white font-black rounded-full flex items-center gap-3 transition-all backdrop-blur-md shadow-xl"
            >
              <UserCog size={18} className="text-text-secondary" />
              <span className="text-[11px] tracking-[0.2em] uppercase">
                Configure Persona
              </span>
            </Link>

            <button
              onClick={handleSaveOutfit}
              disabled={isSaving}
              className={`
                px-6 py-3 border border-white/10 rounded-full flex items-center gap-2 transition-all text-[9px] font-black uppercase tracking-widest
                ${saveSuccess ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white"}
              `}
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saveSuccess ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              <span>{saveSuccess ? "Saved to Collection" : "Save Style"}</span>
            </button>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-background-main via-background-main/80 to-transparent pointer-events-none z-20" />

      <div className="hidden lg:block absolute left-12 top-1/2 -translate-y-1/2 -rotate-90">
        <p className="text-[8px] font-black tracking-[0.5em] text-white/20 uppercase">
          Digital Closet System v2.0 // Node: Persona_Main
        </p>
      </div>
      <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 rotate-90">
        <p className="text-[8px] font-black tracking-[0.5em] text-white/20 uppercase">
          Biometric Data: {persona.type} // Sync: Stable
        </p>
      </div>
    </section>
  );
};

export default AvatarSection;
