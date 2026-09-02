package com.javier.closetapp.collection.dto;

public class CollectionOutfitResponse {
    private Long collectionOutfitId;
    private Long outfitId;
    private String outfitName;

    public CollectionOutfitResponse() {}

    public Long getCollectionOutfitId() { return collectionOutfitId; }
    public void setCollectionOutfitId(Long collectionOutfitId) { this.collectionOutfitId = collectionOutfitId; }

    public Long getOutfitId() { return outfitId; }
    public void setOutfitId(Long outfitId) { this.outfitId = outfitId; }

    public String getOutfitName() { return outfitName; }
    public void setOutfitName(String outfitName) { this.outfitName = outfitName; }
}
