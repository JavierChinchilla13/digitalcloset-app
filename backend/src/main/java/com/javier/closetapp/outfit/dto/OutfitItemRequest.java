package com.javier.closetapp.outfit.dto;

import jakarta.validation.constraints.NotNull;

public class OutfitItemRequest {
    @NotNull(message = "Item ID is required")
    private Long itemId;
    private String slot;
    private Integer itemOrder;
    private Double positionX;
    private Double positionY;
    private Double scaleX;
    private Double scaleY;
    private Double rotation;

    public OutfitItemRequest() {}

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getSlot() { return slot; }
    public void setSlot(String slot) { this.slot = slot; }

    public Integer getItemOrder() { return itemOrder; }
    public void setItemOrder(Integer itemOrder) { this.itemOrder = itemOrder; }

    public Double getPositionX() { return positionX; }
    public void setPositionX(Double positionX) { this.positionX = positionX; }

    public Double getPositionY() { return positionY; }
    public void setPositionY(Double positionY) { this.positionY = positionY; }

    public Double getScaleX() { return scaleX; }
    public void setScaleX(Double scaleX) { this.scaleX = scaleX; }

    public Double getScaleY() { return scaleY; }
    public void setScaleY(Double scaleY) { this.scaleY = scaleY; }

    public Double getRotation() { return rotation; }
    public void setRotation(Double rotation) { this.rotation = rotation; }
}
