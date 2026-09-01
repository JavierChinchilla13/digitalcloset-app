package com.javier.closetapp.common.enums;

// Whether a ClothingItem can be shown on the persona (Task 29, Phase 7 pivot).
// A single enum rather than two booleans - "not background-removed" +
// "persona fitted" is not a valid combination, and two booleans would leave
// that invalid state representable.
public enum PersonaStatus {
    // Has a clean cutout and a fitted transform; renders on the persona today.
    FITTED,
    // Has a clean cutout but was never fitted (user chose "skip persona" on
    // upload). Can still be fitted later.
    NOT_FITTED,
    // Original image was kept (user chose not to remove the background), so
    // there is no clean cutout to fit. Must be re-processed before it can
    // ever be fitted or shown on the persona.
    INELIGIBLE_NO_CUTOUT
}
