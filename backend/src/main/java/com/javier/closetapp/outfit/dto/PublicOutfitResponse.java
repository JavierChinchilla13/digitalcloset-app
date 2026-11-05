package com.javier.closetapp.outfit.dto;

import com.javier.closetapp.common.enums.AvatarType;

import java.util.List;

// Task 102: an outfit as an anonymous visitor of a share link sees it. Only what is needed to draw it:
// the name, the persona type, which pieces go in which slot / layer, and each piece's picture and
// placement. Never the owner, an email, a user id, the plan, descriptions or upload dates.
public class PublicOutfitResponse {
    private String name;
    private AvatarType avatarType;
    private List<PublicOutfitItem> items;
    private List<PublicGarmentResponse> garments;

    public PublicOutfitResponse() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public AvatarType getAvatarType() { return avatarType; }
    public void setAvatarType(AvatarType avatarType) { this.avatarType = avatarType; }

    public List<PublicOutfitItem> getItems() { return items; }
    public void setItems(List<PublicOutfitItem> items) { this.items = items; }

    public List<PublicGarmentResponse> getGarments() { return garments; }
    public void setGarments(List<PublicGarmentResponse> garments) { this.garments = garments; }

    // One piece of the outfit: which garment, in which slot, in which stacking position.
    public static class PublicOutfitItem {
        private Long itemId;
        private String slot;
        private Integer itemOrder;
        private Integer layerOrder;

        public PublicOutfitItem() {}

        public PublicOutfitItem(Long itemId, String slot, Integer itemOrder, Integer layerOrder) {
            this.itemId = itemId;
            this.slot = slot;
            this.itemOrder = itemOrder;
            this.layerOrder = layerOrder;
        }

        public Long getItemId() { return itemId; }
        public String getSlot() { return slot; }
        public Integer getItemOrder() { return itemOrder; }
        public Integer getLayerOrder() { return layerOrder; }
    }
}
