import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Link2, Loader2, Share2, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { useToast } from './Toast';
import { useOutfitStore } from '../store/useOutfitStore';
import { useClothingStore } from '../store/useClothingStore';
import { buildOutfitPersona } from '../utils/personaEligibility';
import { renderOutfitToBlob } from '../utils/outfitImage';
import { getApiErrorMessage } from '../utils/apiError';

interface ShareOutfitModalProps {
  outfitId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// The public address of a shared outfit on this site.
export const shareUrlFor = (token: string) => `${window.location.origin}/s/${token}`;

// A file name that is safe on every system, from the outfit's name.
const fileNameFor = (name: string) => `${(name || 'outfit').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'outfit'}.png`;

// Task 102: share an outfit two ways - as a picture (download it, or hand it to the phone's share sheet)
// and as a public link that anyone can open without an account (and that can be turned off again).
const ShareOutfitModal = ({ outfitId, isOpen, onClose }: ShareOutfitModalProps) => {
  const outfit = useOutfitStore((state) => state.outfits.find((o) => o.outfitId === outfitId));
  const shareOutfit = useOutfitStore((state) => state.shareOutfit);
  const unshareOutfit = useOutfitStore((state) => state.unshareOutfit);
  const closetItems = useClothingStore((state) => state.items);
  const { showToast } = useToast();

  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // How the outfit is worn on its persona (the same preview the cards and the Showcase draw).
  const persona = useMemo(() => (outfit ? buildOutfitPersona(outfit, closetItems) : null), [outfit, closetItems]);

  // Draws the picture whenever the modal opens (or the outfit's pieces change).
  useEffect(() => {
    if (!isOpen || !outfit || !persona) return;
    let cancelled = false;
    setBlob(null);
    setPreviewUrl(null);
    setImageError(null);
    renderOutfitToBlob(persona, closetItems, outfit.name)
      .then((result) => {
        if (cancelled) return;
        setBlob(result);
        setPreviewUrl(URL.createObjectURL(result));
      })
      .catch(() => {
        if (!cancelled) setImageError("The picture couldn't be created. You can still share the link.");
      });
    return () => {
      cancelled = true;
    };
    // The outfit's name and pieces decide the picture; `outfit` changes identity when the link is toggled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, outfit?.outfitId, outfit?.name, outfit?.items, closetItems]);

  // Frees the preview's object URL when it is replaced or the modal goes away.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!outfit) return null;

  const link = outfit.shareToken ? shareUrlFor(outfit.shareToken) : null;
  const file = blob ? new File([blob], fileNameFor(outfit.name), { type: 'image/png' }) : null;
  // The phone's share sheet (WhatsApp, Instagram, ...) when the browser can pass it a file.
  const canNativeShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = fileNameFor(outfit.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleNativeShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: outfit.name });
    } catch (err) {
      // Closing the share sheet is an AbortError, not a failure.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        showToast("Couldn't open the share sheet", 'error');
      }
    }
  };

  const handleCreateLink = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      await shareOutfit(outfit.outfitId);
    } catch (err) {
      setLinkError(getApiErrorMessage(err, "Couldn't create the link. Please try again."));
    } finally {
      setLinkBusy(false);
    }
  };

  const handleTurnOff = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      await unshareOutfit(outfit.outfitId);
      setCopied(false);
    } catch (err) {
      setLinkError(getApiErrorMessage(err, "Couldn't turn the link off. Please try again."));
    } finally {
      setLinkBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast('Link copied', 'success');
    } catch {
      showToast('Copy is blocked here - select the link and copy it', 'info');
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-md bg-background-secondary border border-ink/5 rounded-2xl shadow-lg">
      <div role="dialog" aria-modal="true" aria-label="Share outfit" className="relative p-6 sm:p-8 space-y-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-ink/5"
        >
          <X size={18} />
        </button>
        <h2 className="text-text-primary text-lg font-light tracking-tight uppercase pr-8">Share this outfit</h2>

        <div className="aspect-[3/4] w-full max-w-[16rem] mx-auto rounded-xl overflow-hidden bg-ink/5 border border-ink/5 flex items-center justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt={`${outfit.name} on the figure`} className="w-full h-full object-contain" />
          ) : imageError ? (
            <p className="px-4 text-center text-xs text-text-secondary">{imageError}</p>
          ) : (
            <Loader2 className="animate-spin text-accent" size={24} aria-label="Preparing the picture" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!previewUrl}
            className="flex-1 min-w-[8rem] py-3 bg-ink text-background-main text-[10px] font-medium uppercase tracking-widest rounded-xl disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            <Download size={14} /> Download image
          </button>
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex-1 min-w-[8rem] py-3 border border-ink/15 text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2"
            >
              <Share2 size={14} /> Share
            </button>
          )}
        </div>

        <div className="border-t border-ink/5 pt-5 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">Public link</p>
          {link ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link}
                  aria-label="Public link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-ink/5 border border-ink/10 text-xs text-text-primary"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 rounded-xl border border-ink/15 text-text-primary inline-flex items-center gap-2 text-[10px] uppercase tracking-widest"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Anyone with this link can see this outfit. It shows the outfit and its pieces, not your account.
              </p>
              <button
                type="button"
                onClick={handleTurnOff}
                disabled={linkBusy}
                className="text-[10px] uppercase tracking-widest text-rose-500 disabled:opacity-40"
              >
                {linkBusy ? 'Turning off...' : 'Turn off link'}
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Make a link that anyone can open without an account. You can turn it off whenever you want.
              </p>
              <button
                type="button"
                onClick={handleCreateLink}
                disabled={linkBusy}
                className="w-full py-3 border border-ink/15 text-text-primary text-[10px] font-medium uppercase tracking-widest rounded-xl disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {linkBusy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Create public link
              </button>
            </>
          )}
          {linkError && (
            <p role="alert" className="text-xs text-rose-400">
              {linkError}
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default ShareOutfitModal;
