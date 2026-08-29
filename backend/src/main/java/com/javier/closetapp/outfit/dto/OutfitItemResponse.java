package com.javier.closetapp.outfit.dto;

// Simplified outfit contract (Task 15) - mirrors OutfitItemRequest. See that
// class for why position/scale/rotation are no longer part of the contract.
public class OutfitItemResponse {
    private Long outfitItemId;
    private Long itemId;
    private String itemName;
    private String imageUrl;
    private String slot;
    private Integer itemOrder;

    public OutfitItemResponse() {}

    public Long getOutfitItemId() { return outfitItemId; }
    public void setOutfitItemId(Long outfitItemId) { this.outfitItemId = outfitItemId; }

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getSlot() { return slot; }
    public void setSlot(String slot) { this.slot = slot; }

    public Integer getItemOrder() { return itemOrder; }
    public void setItemOrder(Integer itemOrder) { this.itemOrder = itemOrder; }
}
