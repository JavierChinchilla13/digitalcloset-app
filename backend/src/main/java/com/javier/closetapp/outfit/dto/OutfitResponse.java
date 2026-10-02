package com.javier.closetapp.outfit.dto;

import com.javier.closetapp.common.enums.AvatarType;
import java.util.List;

// An outfit as the frontend receives it, with its pieces.
public class OutfitResponse {
    private Long outfitId;
    private String name;
    private String description;
    private AvatarType avatarType;
    private List<OutfitItemResponse> items;

    public OutfitResponse() {}

    public Long getOutfitId() { return outfitId; }
    public void setOutfitId(Long outfitId) { this.outfitId = outfitId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public AvatarType getAvatarType() { return avatarType; }
    public void setAvatarType(AvatarType avatarType) { this.avatarType = avatarType; }

    public List<OutfitItemResponse> getItems() { return items; }
    public void setItems(List<OutfitItemResponse> items) { this.items = items; }
}
