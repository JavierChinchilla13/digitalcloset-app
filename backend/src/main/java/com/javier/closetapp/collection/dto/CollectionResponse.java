package com.javier.closetapp.collection.dto;

import java.util.List;

public class CollectionResponse {
    private Long collectionId;
    private String name;
    private String createdAt;
    private List<CollectionItemResponse> items;
    private List<CollectionOutfitResponse> outfits;

    public CollectionResponse() {}

    public Long getCollectionId() { return collectionId; }
    public void setCollectionId(Long collectionId) { this.collectionId = collectionId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public List<CollectionItemResponse> getItems() { return items; }
    public void setItems(List<CollectionItemResponse> items) { this.items = items; }

    public List<CollectionOutfitResponse> getOutfits() { return outfits; }
    public void setOutfits(List<CollectionOutfitResponse> outfits) { this.outfits = outfits; }
}
