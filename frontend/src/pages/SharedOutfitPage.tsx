import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import PersonaRenderer from '../components/PersonaRenderer';
import ErrorState from '../components/ErrorState';
import { publicOutfitService, type PublicOutfit } from '../api/publicOutfitService';
import { buildOutfitPersona } from '../utils/personaEligibility';
import { useAuthStore } from '../store/useAuthStore';
import type { ClothingItem, Outfit } from '../types';

type Status = 'loading' | 'ready' | 'gone' | 'error';

// Task 102: the page behind a public share link (/s/:token). Anyone can open it, signed in or not.
// It draws the outfit from the data in the link alone - never the visitor's own closet - and tells
// search engines not to index it. A link that was turned off (or never existed) shows a friendly note.
const SharedOutfitPage = () => {
  const { token = '' } = useParams<{ token: string }>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<PublicOutfit | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Search engines should not index personal outfit links.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    publicOutfitService
      .getByToken(token)
      .then((outfit) => {
        if (cancelled) return;
        setData(outfit);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 (turned off / never existed) and 429 (too many requests) are not "the site is down".
        setStatus(err?.response?.status === 404 ? 'gone' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // The shared garments as closet items, and the persona they are worn on.
  const { items, persona } = useMemo(() => {
    if (!data) return { items: [] as ClothingItem[], persona: null };
    const garments: ClothingItem[] = data.garments.map((g) => ({
      itemId: g.itemId,
      name: g.name,
      category: g.category,
      imageUrl: g.imageUrl,
      personaType: g.personaType,
      transform: g.transform,
      side: g.side,
      isModular: g.isModular,
      modularData: g.modularData,
      personaStatus: g.personaStatus,
    }));
    const outfit: Outfit = {
      outfitId: 0,
      name: data.name,
      avatarType: data.avatarType,
      createdAt: '',
      items: data.items.map((i) => ({
        outfitItemId: i.itemId,
        itemId: i.itemId,
        slot: i.slot,
        itemOrder: i.itemOrder,
        layerOrder: i.layerOrder,
      })),
    };
    return { items: garments, persona: buildOutfitPersona(outfit, garments) };
  }, [data]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-32" role="status" aria-label="Loading the outfit">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (status === 'gone') {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center text-center px-6 gap-6">
        <h1 className="text-xl font-light tracking-[0.2em] uppercase text-text-primary">This outfit is no longer shared</h1>
        <p className="text-text-secondary text-sm max-w-sm">
          The link was turned off by its owner, or it never existed.
        </p>
        <Link to="/" className="px-8 py-4 bg-ink text-background-main rounded-full text-[11px] tracking-[0.2em] uppercase">
          Go to VYSVI
        </Link>
      </div>
    );
  }

  if (status === 'error' || !data || !persona) {
    return (
      <ErrorState
        title="We couldn't load this outfit"
        message="Check your connection and try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center px-6 pb-16">
      <div className="text-center mb-6 mt-4">
        <span className="inline-block px-4 py-1 rounded-full border border-accent/30 text-accent text-[10px] font-medium tracking-[0.4em] mb-4 bg-accent/5 uppercase">
          Shared outfit
        </span>
        <h1 className="text-2xl sm:text-3xl font-light tracking-[0.15em] uppercase text-text-primary">{data.name}</h1>
      </div>

      <div className="w-full max-w-md">
        <PersonaRenderer persona={persona} items={items} className="h-[min(62dvh,calc((100vw-3rem)*1.3333))] sm:h-[min(70dvh,calc((100vw-3rem)*1.3333))]" />
      </div>

      <div className="mt-8 text-center space-y-3">
        <p className="text-text-secondary text-xs tracking-widest uppercase">Made with VYSVI</p>
        <Link
          to={isAuthenticated ? '/showcase' : '/signup'}
          className="inline-flex items-center gap-3 px-8 py-4 bg-ink text-background-main rounded-full text-[11px] tracking-[0.2em] uppercase transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles size={16} />
          {isAuthenticated ? 'Open your closet' : 'Make your own outfits'}
        </Link>
      </div>
    </div>
  );
};

export default SharedOutfitPage;
