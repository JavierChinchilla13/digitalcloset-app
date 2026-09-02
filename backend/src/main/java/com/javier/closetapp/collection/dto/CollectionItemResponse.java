package com.javier.closetapp.collection.dto;

// Mirrors OutfitItemResponse's minimal shape - enough for a UI to render a
// thumbnail without a second fetch.
public class CollectionItemResponse {
    private Long collectionItemId;
    private Long itemId;
    private String itemName;
    private String imageUrl;

    public CollectionItemResponse() {}

    public Long getCollectionItemId() { return collectionItemId; }
    public void setCollectionItemId(Long collectionItemId) { this.collectionItemId = collectionItemId; }

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
}
