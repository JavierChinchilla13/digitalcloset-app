package com.javier.closetapp.outfit.dto;

import jakarta.validation.constraints.NotNull;

// Simplified outfit contract (Task 15): the per-item transform columns
// (position/scale/rotation) still exist on OutfitItem/the outfit_items table
// as nullable future capability, but nothing in the frontend produces them,
// so they're no longer part of the request contract.
public class OutfitItemRequest {
    @NotNull(message = "Item ID is required")
    private Long itemId;
    private String slot;
    private Integer itemOrder;

    public OutfitItemRequest() {}

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getSlot() { return slot; }
    public void setSlot(String slot) { this.slot = slot; }

    public Integer getItemOrder() { return itemOrder; }
    public void setItemOrder(Integer itemOrder) { this.itemOrder = itemOrder; }
}
