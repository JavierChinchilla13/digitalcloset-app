package com.javier.closetapp.user.dto;

import jakarta.validation.constraints.NotNull;

// Body of PUT /api/users/me/main-outfit (Task 78).
public class MainOutfitRequest {

    @NotNull(message = "Outfit ID is required")
    private Long outfitId;

    public MainOutfitRequest() {}

    public Long getOutfitId() {
        return outfitId;
    }

    public void setOutfitId(Long outfitId) {
        this.outfitId = outfitId;
    }
}
