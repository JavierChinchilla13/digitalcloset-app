package com.javier.closetapp.outfit.entity;

import com.javier.closetapp.clothing.entity.ClothingItem;
import jakarta.persistence.*;

@Entity
@Table(name = "outfit_items")
public class OutfitItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "outfit_item_id")
    private Long outfitItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outfit_id")
    private Outfit outfit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private ClothingItem clothingItem;

    private String slot;

    @Column(name = "item_order")
    private Integer itemOrder;

    // Stacking position on the persona (0 = bottom-most); null = default order.
    @Column(name = "layer_order")
    private Integer layerOrder;

    @Column(name = "position_x")
    private Double positionX;

    @Column(name = "position_y")
    private Double positionY;

    @Column(name = "scale_x")
    private Double scaleX;

    @Column(name = "scale_y")
    private Double scaleY;

    private Double rotation;

    public OutfitItem() {}

    public Long getOutfitItemId() { return outfitItemId; }
    public void setOutfitItemId(Long outfitItemId) { this.outfitItemId = outfitItemId; }

    public Outfit getOutfit() { return outfit; }
    public void setOutfit(Outfit outfit) { this.outfit = outfit; }

    public ClothingItem getClothingItem() { return clothingItem; }
    public void setClothingItem(ClothingItem clothingItem) { this.clothingItem = clothingItem; }

    public String getSlot() { return slot; }
    public void setSlot(String slot) { this.slot = slot; }

    public Integer getItemOrder() { return itemOrder; }
    public void setItemOrder(Integer itemOrder) { this.itemOrder = itemOrder; }

    public Integer getLayerOrder() { return layerOrder; }
    public void setLayerOrder(Integer layerOrder) { this.layerOrder = layerOrder; }

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
