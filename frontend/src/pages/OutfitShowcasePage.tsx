import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  User,
  LayoutList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOutfitStore } from "../store/useOutfitStore";
import { useClothingStore } from "../store/useClothingStore";
import { usePersonaStore } from "../store/usePersonaStore";
import { buildOutfitPersona } from "../utils/personaEligibility";
import { buildShowcaseRows } from "../utils/selectionDisplay";
import PersonaRenderer from "../components/PersonaRenderer";
import CroppedThumbnail from "../components/CroppedThumbnail";
import type { ClothingItem, Outfit, PersonaState } from "../types";

// Outfit Showcase (Task 75, Phase 9.7) - reachable by clicking the navbar
// logo while signed in ("a landing page that is basically an outfit
// selector"). Deliberately its own page, not a variant of SavedOutfitsPage
// or FlatOutfitBuilderPage - those are management/editing surfaces
// (search, filter, edit, delete); this is a single "showroom" moment with
// one outfit centered, adjacent ones peeking in from the sides to switch
// to. No carousel library or existing drag/slide pattern exists anywhere
// in this codebase, so the center/side swap is built on framer-motion's
// `AnimatePresence` - each of the three visible slots (left/active/right)
// is its own independent mount point in the tree, and switching outfits
// simply fades the old occupant of a slot out and the new one in.
//
// Follow-up feedback after the first version (still Task 75, not yet
// committed): the active outfit's default view is its actual garment
// photos in fixed category rows (Jacket, Top - or Dress in place of both -
// Bottom, Shoes, each collapsed to one representative image + a "+N" badge
// for anything beyond it; Accessories get a trailing count only, no row),
// not the persona/mannequin render - that's now an explicit "View on
// Persona" step below the rows, with its own "majestic" glow treatment.
//
// Switching bug follow-up (found while testing the Eighth aura-size
// follow-up, still Task 75): an earlier version tried to make the SAME
// outfit's box visually grow/shrink as it moved from a side slot to the
// active slot, sharing a `layoutId` across what are actually two
// different `ShowcaseSlot` mounts (the side slots and the active slot are
// separate subtrees, each with its own `AnimatePresence` - promoting an
// outfit unmounts one instance and mounts a new one, framer-motion's
// shared-layoutId system was just supposed to make that handoff look
// like one continuous box). Combined with the two mount points rendering
// completely different markup (a small photo collage vs. the full
// category rows), that FLIP handoff could get stuck - reproduced twice,
// the old collage and the new active rows staying visible on top of each
// other indefinitely instead of settling. Simplified to a plain crossfade
// instead (no shared `layoutId`/`layout` prop) - less of a single fluid
// "box moves across the screen" effect, but it can't get stuck the same
// way, and a clean fade reads just as well for a spotlight swap like this.

// One row of the active outfit's flat breakdown - its representative
// image(s) (2 for a shoe pair, 1 otherwise) and a "+N" badge when the
// outfit has more items in that category than shown. No category label
// text (Jacket/Top/etc) - the photos speak for themselves, per feedback.
// Task 75 follow-up: centered (was left-aligned), and the images float on
// their own (a drop-shadow, not a bordered box "square") - these are
// already-cutout garment photos, so a hard-edged tile around each one just
// fought the image instead of framing it.
// Task 75 follow-up: 4 stacked rows at the earlier 160px image size with
// py-3 padding on each added up to a card taller than most viewports,
// forcing a scroll to see the whole outfit - and stretched the aura (sized
// off this content block) into a tall oval instead of a circle. Tightened
// the vertical rhythm (near-zero row padding) - but at the same time
// shrank the images down from 160px to 128px, which was NOT the point of
// that fix and undid an earlier "still too small" size bump, reported
// back as "clothes still look small, jacket barely visible". Once the
// aura was made a fixed size independent of this content's own height
// (see AuraGlow below) and a redundant page-level padding bug was found
// and removed (see the page wrapper below), the scroll problem no longer
// depends on keeping these images small - so they're back to the 160px
// size, `py-0.5` stays as-is (that part of the fix was real and unrelated
// to size).
const CategoryRow = ({
  displayItems,
  extraCount,
}: {
  displayItems: ClothingItem[];
  extraCount: number;
}) => (
  <div className="flex items-center justify-center gap-3 py-0.5 border-b border-ink/5 last:border-b-0">
    {displayItems.map((item) => (
      <CroppedThumbnail
        key={item.itemId}
        imageUrl={item.imageUrl}
        transform={item.transform}
        alt={item.name}
        fit="contain"
        className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 drop-shadow-md"
      />
    ))}
    {extraCount > 0 && (
      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
        +{extraCount}
      </span>
    )}
  </div>
);

// Task 75 follow-up: "aura ... like dragon ball when they go super saiyan" -
// a real power-up flare, not just a soft pulse: a blinding core flash on
// entry, a bright hot center that never fully settles, spinning energy rays
// radiating outward, expanding shockwave rings, and rising sparks - built
// from framer-motion + CSS gradients only (no image assets/particle lib).
// Deliberately a fixed bright silver-white energy color rather than the
// theme's own accent token - light mode's accent is graphite (dark, not
// bright), which would defeat a "glowing" effect entirely, so this one
// moment stays a fixed bright color in both themes, the same kind of
// considered exception as the Fabric.js editor stage staying dark in both
// themes (Task 71). Originally gold, changed to silver per feedback - a
// closer match to the app's own accent hue besides.
// Originally only wrapped the persona render; a further follow-up moved it
// to wrap the whole active slot (rows view included) instead, so the flare
// reads as "this outfit has the stage" rather than "you switched to
// persona mode" - it now plays once when an outfit becomes active, and
// keeps pulsing underneath whichever of the two views is showing.
// Speed follow-up (round 2 - "still... way way way slower"): every looping
// duration slowed by roughly another 3x on top of the first slowdown, well
// past "you can watch it move" into "you'd have to compare two screenshots
// a while apart to be sure it's animating at all" territory for the
// rotation/flicker/pulse - only the rising sparks stay slow-but-legible,
// since a spark that takes half a minute to drift up doesn't read as a
// spark. `py-6` also trimmed to `py-2` - it was adding height on top of
// the rows/CategoryRow's own now-much-tighter spacing.
// Shape follow-up (round 2, from real screenshots): the flash/rays/rings/
// core were all sized as PERCENTAGES of their container - and that
// container is the rows content block, which is portrait (4 stacked
// 128px rows, much taller than it is wide), not square. A percentage of a
// portrait box is itself a portrait box, so every "circle" was rendering
// as a tall stretched oval regardless of how tight the rows' own spacing
// was - tightening rows shrank the oval but could never make it round.
// Fixed at the source: every circular layer now gets a fixed, explicitly
// square pixel size (independent of however tall the garment rows are)
// and centers itself on the content with top-1/2/left-1/2 + a
// translate, instead of inheriting the content box's own shape.
// Bumped alongside the CategoryRow image-size restore above - now that
// this size is fixed (not a percentage of content), it's free to be
// picked purely for how well it visually envelops the rows, independent
// of any scroll concern.
// Size follow-up (round 3, from a live screenshot of a real 2-row
// outfit): a fixed size tuned to look right around a full 4-row outfit
// is, by definition, oversized around a sparser one (e.g. just a jacket
// + shoes) - the glow visibly overshoots the actual garments, reading as
// "too much space between them" even though the rows themselves are
// still packed tight (confirmed - jacket-to-shoe gap measured 5px). The
// aura's SHAPE is fixed (still always literally square, so still always
// circular - that earlier fix stands), but its SIZE now scales with how
// many rows the outfit actually has, via a lookup of pre-picked literal
// Tailwind classes (not a runtime-built string - arbitrary-value classes
// only work if Tailwind's build-time scanner can see the literal text)
// rather than one size for every outfit.
const RAY_COUNT = 8;
const AURA_CENTER =
  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none";

// Diameter scales roughly with sqrt(rowCount) (aura area, not diameter,
// should track content amount) off the 4-row size validated live -
// clamped to 1-4 rows since a bare-persona/no-rows case still wants a
// reasonably sized glow, not a pinprick.
const AURA_SIZE_BY_ROWS: Record<1 | 2 | 3 | 4, string> = {
  1: "w-[220px] h-[220px] sm:w-[280px] sm:h-[280px]",
  2: "w-[270px] h-[270px] sm:w-[340px] sm:h-[340px]",
  3: "w-[330px] h-[330px] sm:w-[415px] sm:h-[415px]",
  4: "w-[380px] h-[380px] sm:w-[480px] sm:h-[480px]",
};
const RING_SIZE_BY_ROWS: Record<1 | 2 | 3 | 4, string> = {
  1: "w-[154px] h-[154px] sm:w-[196px] sm:h-[196px]",
  2: "w-[189px] h-[189px] sm:w-[238px] sm:h-[238px]",
  3: "w-[231px] h-[231px] sm:w-[291px] sm:h-[291px]",
  4: "w-[266px] h-[266px] sm:w-[336px] sm:h-[336px]",
};
const CORE_SIZE_BY_ROWS: Record<1 | 2 | 3 | 4, string> = {
  1: "w-[187px] h-[187px] sm:w-[238px] sm:h-[238px]",
  2: "w-[230px] h-[230px] sm:w-[289px] sm:h-[289px]",
  3: "w-[281px] h-[281px] sm:w-[353px] sm:h-[353px]",
  4: "w-[323px] h-[323px] sm:w-[408px] sm:h-[408px]",
};
// Eleventh follow-up: sized off AURA_SIZE_BY_ROWS (the largest layer -
// flash/rays), applied as a min-height on AuraGlow's own wrapper instead
// of a width/height on an aura layer - see the comment on that wrapper
// below for why a sparse outfit's shorter content was letting the aura
// clip against an overflow-hidden ancestor. Twelfth follow-up: matching
// the diameter exactly still clipped - Tailwind's global border-box
// reset means `min-height` INCLUDES this wrapper's own `py-2` padding
// rather than adding on top of it, so the actual available room was 16px
// short of the aura's own size alone; on top of that, the "hot core"
// layer uses `blur-2xl`, and a CSS blur filter visually bleeds past its
// element's own geometric box (unlike a radial-gradient, which fades
// within its own bounds) - neither of those was in the original budget.
// +100px over the base diameter comfortably covers both without needing
// to compute the blur radius's exact falloff.
const AURA_MIN_HEIGHT_BY_ROWS: Record<1 | 2 | 3 | 4, string> = {
  1: "min-h-[320px] sm:min-h-[380px]",
  2: "min-h-[370px] sm:min-h-[440px]",
  3: "min-h-[430px] sm:min-h-[515px]",
  4: "min-h-[480px] sm:min-h-[580px]",
};
const clampRowCount = (n: number): 1 | 2 | 3 | 4 =>
  Math.min(Math.max(Math.round(n), 1), 4) as 1 | 2 | 3 | 4;

const AuraGlow = ({
  rowCount,
  flashKey,
  children,
}: {
  rowCount: number;
  // Outfit-switch animation follow-up: the active ShowcaseSlot instance is
  // now persistent across outfit switches (see OutfitShowcasePage below),
  // so this component no longer remounts on its own when a new outfit
  // becomes active - which would otherwise silence the one-time entry
  // flash after the very first outfit. Putting the outfit's id here as a
  // `key` on JUST the flash element (not the whole AuraGlow, and not
  // wrapped in AnimatePresence/no `exit` prop) forces a plain, synchronous
  // remount of that one element whenever the outfit changes, replaying the
  // flash - nothing to get stuck on since there's no exit animation to
  // await, unlike the AnimatePresence-based attempts that caused the
  // switching bug fixed earlier. The looping rays/rings/core stay on the
  // same instance and keep cycling uninterrupted, which reads better
  // than restarting them on every click anyway.
  flashKey: string | number;
  children: React.ReactNode;
}) => {
  const bucket = clampRowCount(rowCount);
  const auraSize = AURA_SIZE_BY_ROWS[bucket];
  const ringSize = RING_SIZE_BY_ROWS[bucket];
  const coreSize = CORE_SIZE_BY_ROWS[bucket];

  return (
    // Eleventh follow-up: "check the aura flow when an outfit have less
    // pieces...it cuts off" - every aura layer is sized off AURA_SIZE_
    // BY_ROWS (a fixed diameter per row count, unrelated to the actual
    // content height), but this wrapper's own height was previously
    // whatever `children` (the garment rows) needed - for a sparse
    // outfit (1-2 rows), that's shorter than the aura's own diameter, so
    // the aura stuck out past this box's edges. A parent further up
    // (the carousel's middle row) clips overflow, so the aura's top/
    // bottom got visibly cut off instead of rendering as a clean circle.
    // `min-h`, keyed off the same per-row-count bucket as the aura's own
    // size, guarantees this wrapper is always at least as tall as the
    // aura needs, regardless of how little content is inside it.
    <div
      className={`relative flex items-center justify-center py-2 ${AURA_MIN_HEIGHT_BY_ROWS[bucket]}`}
    >
      {/* Entry flash - a bright burst that blooms once and fades, like the
          initial "flash" frame of a power-up. Keyed per-outfit (see the
          comment on the `flashKey` prop above) so it replays every time a
          new outfit becomes active, not just on the page's first load. */}
      <motion.div
        key={flashKey}
        aria-hidden
        className={`${AURA_CENTER} ${auraSize} rounded-full`}
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(199,203,209,0.6) 35%, transparent 70%)",
        }}
        initial={{ opacity: 1, scale: 0.2 }}
        animate={{ opacity: 0, scale: 1.6 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      {/* Spinning energy rays - thin silver beams around the center, rotating
          as one unit while individually flickering. A truly square wrapper
          now, so the rays sweep a real circle instead of an ellipse. */}
      <motion.div
        aria-hidden
        className={`${AURA_CENTER} ${auraSize}`}
        animate={{ rotate: 360 }}
        transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: RAY_COUNT }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-1/2 h-[3px] origin-left"
            style={{
              transform: `rotate(${(360 / RAY_COUNT) * i}deg)`,
              background:
                "linear-gradient(90deg, rgba(226,230,235,0.9), transparent)",
            }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 1.4,
            }}
          />
        ))}
      </motion.div>

      {/* Expanding shockwave rings. */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          aria-hidden
          className={`${AURA_CENTER} ${ringSize} rounded-full border-2`}
          style={{ borderColor: "rgba(199,203,209,0.5)" }}
          animate={{ scale: [0.9, 1.6], opacity: [0.7, 0] }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 11,
          }}
        />
      ))}

      {/* Hot core - never fully settles, keeps the whole thing feeling alive. */}
      <motion.div
        aria-hidden
        className={`${AURA_CENTER} ${coreSize} rounded-full blur-2xl`}
        style={{
          background:
            "radial-gradient(circle, rgba(240,242,245,0.85) 0%, rgba(199,203,209,0.35) 55%, transparent 80%)",
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [0.97, 1.06, 0.97] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative">{children}</div>
    </div>
  );
};

interface ShowcaseSlotProps {
  outfit: Outfit;
  items: ClothingItem[];
  persona: PersonaState;
  role: "active" | "side";
  onSelect?: () => void;
}

const ShowcaseSlot = ({
  outfit,
  items,
  persona,
  role,
  onSelect,
}: ShowcaseSlotProps) => {
  const isActive = role === "active";
  const [showPersona, setShowPersona] = useState(false);

  // Default view resets to the flat rows whenever a different outfit
  // becomes active, rather than remembering "was showing persona" across
  // outfits - each outfit starts on the same footing.
  useEffect(() => {
    setShowPersona(false);
  }, [outfit.outfitId]);

  const outfitItems = useMemo(() => {
    const byId = new Map(items.map((item) => [item.itemId, item]));
    return [...outfit.items]
      .sort((a, b) => (a.itemOrder ?? 0) - (b.itemOrder ?? 0))
      .map((oi) => byId.get(oi.itemId))
      .filter((item): item is ClothingItem => !!item);
  }, [outfit.items, items]);

  const rows = useMemo(() => buildShowcaseRows(outfitItems), [outfitItems]);
  const accessoryCount = useMemo(
    () => outfitItems.filter((item) => item.category === "ACCESSORY").length,
    [outfitItems],
  );

  return (
    // Animation follow-up: the active role's opacity is now fully owned
    // by the persistent fade wrapper in OutfitShowcasePage - this
    // component's own initial/animate opacity, if also applied here,
    // ended up nested inside that wrapper's opacity animation and got
    // visibly stuck at 0 (two independent motion components both racing
    // to control the same CSS `opacity` property on overlapping
    // elements). `initial={false}` skips this component's own mount
    // animation for the active role (nothing to skip in practice, since
    // it no longer remounts) while leaving it in place, unchanged, for
    // the side role - which still remounts per outfit and still needs
    // its own enter/exit fade.
    <motion.div
      initial={isActive ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={!isActive ? onSelect : undefined}
      className={`shrink-0 ${isActive ? "w-[340px] sm:w-[460px]" : "w-[150px] sm:w-[180px] cursor-pointer"}`}
      whileHover={!isActive ? { scale: 1.03 } : undefined}
    >
      {isActive ? (
        <div>
          {/* Task 75 follow-up: the card box (border/background/shadow)
              around the active outfit was removed - the content (and its
              aura) now floats directly on the page instead of sitting in a
              square. */}
          <AuraGlow rowCount={rows.length} flashKey={outfit.outfitId}>
            <AnimatePresence mode="wait">
              {!showPersona ? (
                <motion.div
                  key="rows"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-6"
                >
                  {rows.map((row) => (
                    <CategoryRow
                      key={row.category}
                      displayItems={row.displayItems}
                      extraCount={row.extraCount}
                    />
                  ))}
                  {accessoryCount > 0 && (
                    <p className="pt-3 text-center text-[10px] font-medium uppercase tracking-widest text-text-secondary">
                      + {accessoryCount}{" "}
                      {accessoryCount === 1 ? "Accessory" : "Accessories"}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="persona"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-8"
                >
                  <PersonaRenderer
                    persona={persona}
                    className="h-[45vh] sm:h-[50vh]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </AuraGlow>

          {/* Task 75 follow-up: persona mode is an explicit step below the
              rows, not the default - positioned here (after a row list tall
              enough to often need a scroll) rather than pinned near the
              top. */}
          <button
            onClick={() => setShowPersona((v) => !v)}
            className="w-full py-4 mt-2 border-t border-ink/5 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-ink/[0.02] transition-all rounded-xl"
          >
            {showPersona ? <LayoutList size={14} /> : <User size={14} />}
            {showPersona ? "Show Pieces" : "View on Persona"}
          </button>
        </div>
      ) : (
        <div className="aspect-[3/4] rounded-2xl border border-ink/5 bg-card/60 overflow-hidden opacity-50 hover:opacity-80 transition-opacity grid grid-cols-2 gap-0.5 p-0.5">
          {outfitItems.slice(0, 4).map((item, idx) => (
            <div
              key={item.itemId}
              className={`relative overflow-hidden rounded-lg bg-ink/5 ${outfitItems.length === 1 ? "col-span-2 row-span-2" : ""}`}
            >
              <CroppedThumbnail
                imageUrl={item.imageUrl}
                transform={item.transform}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              {idx === 3 && outfitItems.length > 4 && (
                <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                  <span className="text-on-accent text-[10px] font-medium">
                    +{outfitItems.length - 3}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p
        className={`mt-4 text-center font-medium uppercase tracking-widest line-clamp-1 transition-opacity ${
          isActive
            ? "text-sm text-text-primary opacity-100"
            : "text-[10px] text-text-secondary opacity-0"
        }`}
      >
        {outfit.name}
      </p>
    </motion.div>
  );
};

const OutfitShowcasePage = () => {
  const { outfits: allOutfits, fetchOutfits, isLoading } = useOutfitStore();
  const { items, fetchItems } = useClothingStore();
  const { persona } = usePersonaStore();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    Promise.all([fetchOutfits(), fetchItems()]).finally(() => setReady(true));
  }, [fetchOutfits, fetchItems]);

  // Scoped to the active persona type, same as SavedOutfitsPage's own
  // `filteredOutfits` - without this, an outfit saved for the other
  // persona type would show up here unprompted (reported as "random
  // outfits appearing"), breaking the convention every other outfit
  // listing in the app already follows.
  const outfits = useMemo(
    () => allOutfits.filter((o) => o.avatarType === persona.type),
    [allOutfits, persona.type],
  );

  const n = outfits.length;
  // Clamp in case an outfit was deleted elsewhere and the index is now
  // past the end.
  const safeIndex = n === 0 ? 0 : Math.min(activeIndex, n - 1);

  const activeOutfit = n > 0 ? outfits[safeIndex] : null;
  const rightOutfit = n >= 2 ? outfits[(safeIndex + 1) % n] : null;
  // Only shown once there are 3+ outfits - with exactly 2, left and right
  // would both resolve to the same "other" outfit, which would collide as
  // React keys/layoutIds. Simpler to just show that one outfit on the
  // right only than to invent a rule for which side it "belongs" on.
  const leftOutfit = n >= 3 ? outfits[(safeIndex - 1 + n) % n] : null;

  const activePersona = useMemo(
    () => (activeOutfit ? buildOutfitPersona(activeOutfit, items) : null),
    [activeOutfit, items],
  );
  const leftPersona = useMemo(
    () => (leftOutfit ? buildOutfitPersona(leftOutfit, items) : null),
    [leftOutfit, items],
  );
  const rightPersona = useMemo(
    () => (rightOutfit ? buildOutfitPersona(rightOutfit, items) : null),
    [rightOutfit, items],
  );

  // Outfit-switch animation follow-up: "right now the next set just
  // appears" - wants a smooth transition. Two earlier attempts at
  // animating this exact swap (a shared layoutId FLIP, then an
  // AnimatePresence mode="wait" key-swap - see the switching-bug comment
  // on the active ShowcaseSlot below) both produced a real, reproducible
  // stuck-DOM bug, confirmed even in a production build - both depended
  // on framer-motion's AnimatePresence/exit lifecycle resolving an
  // unmount, which proved unreliable in this file's nested-AnimatePresence
  // structure. This sidesteps that mechanism entirely: rather than
  // remounting a new ShowcaseSlot per outfit and animating its mount/
  // unmount, the active slot now stays a single persistent instance, and
  // a small lagging "what's currently displayed" state crossfades it via
  // a plain `animate` opacity change (no `exit` prop, no
  // AnimatePresence) - nothing here can get stuck the way an awaited
  // unmount can, since there's no unmount involved in the swap at all.
  const FADE_DURATION_MS = 250;
  const [displayedOutfit, setDisplayedOutfit] = useState(activeOutfit);
  const [displayedPersona, setDisplayedPersona] = useState(activePersona);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (activeOutfit?.outfitId === displayedOutfit?.outfitId) return;
    if (!displayedOutfit) {
      // Nothing shown yet (first load) - show it directly, no need to
      // fade "out" of an empty state first.
      setDisplayedOutfit(activeOutfit);
      setDisplayedPersona(activePersona);
      return;
    }
    setIsFading(true);
    const timer = setTimeout(() => {
      setDisplayedOutfit(activeOutfit);
      setDisplayedPersona(activePersona);
      setIsFading(false);
    }, FADE_DURATION_MS);
    return () => clearTimeout(timer);
    // Deliberately keyed only on the outfit id, same pattern as this
    // file's other "just happened" effects (e.g. the persona-preview
    // exclusion toast) - activePersona is derived from activeOutfit/items
    // and read fresh inside the timeout closure, not a separate trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutfit?.outfitId]);

  const goToPrev = () => setActiveIndex((i) => (n === 0 ? 0 : (i - 1 + n) % n));
  const goToNext = () => setActiveIndex((i) => (n === 0 ? 0 : (i + 1) % n));

  if (!ready || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  // Zero-outfit state: just the logo, a line of copy, and a way in -
  // matching LandingPage's own hero language (eyebrow badge, rounded-full
  // accent button, hover:scale-105) rather than a new visual style.
  if (n === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-block px-4 py-1 rounded-full border border-accent/30 text-accent text-[10px] font-medium tracking-[0.4em] mb-8 bg-accent/5 uppercase">
            Your Showcase
          </span>
          <img
            src="/logo.png"
            alt="VYSVI"
            className="w-40 sm:w-48 mx-auto mb-8"
          />
          <p className="text-text-secondary text-base sm:text-lg max-w-md mx-auto mb-10 font-light leading-relaxed">
            Save your first outfit and it will take center stage here.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-10 py-5 bg-ink text-background-main font-medium rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg inline-flex items-center gap-3"
          >
            <Sparkles size={18} />
            <span className="text-[11px] tracking-[0.2em] uppercase">
              Let's Get Started
            </span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    // Task 75 follow-up: no top padding here - MainLayout's <main> already
    // applies pt-24 to clear the fixed navbar (same convention as
    // SavedOutfitsPage's own top-padding-free wrapper); a redundant py-24
    // here was doubling that gap and pushing the outfit below the fold on
    // top of the rows themselves being tall.
    <div className="min-h-screen flex flex-col items-center px-6 pb-16">
      <div className="text-center mb-8">
        <span className="inline-block px-4 py-1 rounded-full border border-accent/30 text-accent text-[10px] font-medium tracking-[0.4em] mb-4 bg-accent/5 uppercase">
          Your Showcase
        </span>
        <h1 className="text-4xl sm:text-5xl font-display font-light tracking-tighter text-text-primary">
          {displayedOutfit?.name}
        </h1>
      </div>

      {/* Task 75 follow-up: was `items-start` with a guessed `mt-24` offset
          on the side slots to roughly line them up against the (now
          card-less) active content - simpler and more correct to just
          center the whole row on one axis, same as the heading above it.
          Layout-stability follow-up: "if a set is full and another only
          has one item the screen size changes and arrow move around" -
          this row had no fixed height, so `items-center` recentered the
          arrows against whatever height the active outfit's own row count
          (1-4 rows) happened to produce, visibly moving them and resizing
          the page on every switch. `min-h` pins the row to the tallest
          real case (a 4-row outfit, measured live), so `items-center` now
          centers shorter content within a constant box instead of the box
          itself changing size. */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-5xl min-h-[630px] sm:min-h-[760px]">
        <button
          onClick={goToPrev}
          disabled={n < 2}
          className="shrink-0 p-3 rounded-full border border-ink/10 text-text-secondary hover:text-text-primary hover:border-ink/20 transition-all disabled:opacity-20 disabled:pointer-events-none"
          title="Previous outfit"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center justify-center gap-4 sm:gap-6 flex-1 overflow-hidden">
          {/* Task 75 follow-up: the active slot wasn't actually centered on
              the page whenever the two side slots were asymmetric (no left
              outfit with fewer than 3 total, or no outfits at all on one
              side) - centering a *group* of unevenly-present elements
              centers the group, not the active one inside it. Reserving a
              fixed-width slot for each side regardless of whether it holds
              an outfit keeps the group's width symmetric, so the active
              slot's own center always lands on the page's center. */}
          <div className="w-[150px] sm:w-[180px] shrink-0 flex justify-end">
            {leftOutfit && leftPersona && (
              <ShowcaseSlot
                key={leftOutfit.outfitId}
                outfit={leftOutfit}
                items={items}
                persona={leftPersona}
                role="side"
                onSelect={goToPrev}
              />
            )}
          </div>

          {/* Switching bug follow-up: tried both a shared-layoutId FLIP
              (morphing the same box between the side and active slots -
              those are actually different mount points, and got visibly
              stuck) and an `AnimatePresence mode="wait"` key-swap (which
              plays the outgoing outfit's exit animation to completion,
              measured `opacity: 0`, but never actually unmounts it or
              mounts the incoming one - reproduced identically in a real
              production build, so not a StrictMode/dev-only artifact
              either). Both approaches depend on framer-motion resolving
              an exit before proceeding, and that dependency is exactly
              what got stuck both times. Settled on the option with no
              such dependency: `key={outfit.outfitId}` directly, no
              AnimatePresence - React swaps the DOM instantly and
              synchronously on key change (impossible to get stuck
              between two children).
              Animation follow-up: that instant swap read as "the next set
              just appears" - now wrapped in a persistent, stably-keyed
              instance driven by `displayedOutfit` (a small lagging state,
              see the effect above) and crossfaded with a plain `animate`
              opacity change - see that effect's comment for why this
              avoids retrying either of the approaches that got stuck. */}
          {displayedOutfit && displayedPersona && (
            <motion.div
              animate={{ opacity: isFading ? 0 : 1 }}
              transition={{ duration: FADE_DURATION_MS / 1000 }}
            >
              <ShowcaseSlot
                key="active-slot"
                outfit={displayedOutfit}
                items={items}
                persona={displayedPersona}
                role="active"
              />
            </motion.div>
          )}

          <div className="w-[150px] sm:w-[180px] shrink-0 flex justify-start">
            {rightOutfit && rightPersona && (
              <ShowcaseSlot
                key={rightOutfit.outfitId}
                outfit={rightOutfit}
                items={items}
                persona={rightPersona}
                role="side"
                onSelect={goToNext}
              />
            )}
          </div>
        </div>

        <button
          onClick={goToNext}
          disabled={n < 2}
          className="shrink-0 p-3 rounded-full border border-ink/10 text-text-secondary hover:text-text-primary hover:border-ink/20 transition-all disabled:opacity-20 disabled:pointer-events-none"
          title="Next outfit"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {n > 1 && (
        <div className="flex items-center gap-2 mt-12">
          {outfits.map((o, i) => (
            <button
              key={o.outfitId}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex
                  ? "w-6 bg-accent"
                  : "w-1.5 bg-ink/15 hover:bg-ink/30"
              }`}
              title={o.name}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OutfitShowcasePage;
