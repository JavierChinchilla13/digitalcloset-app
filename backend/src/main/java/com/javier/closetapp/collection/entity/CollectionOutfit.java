package com.javier.closetapp.collection.entity;

import com.javier.closetapp.outfit.entity.Outfit;
import jakarta.persistence.*;

// Join row: one outfit's membership in one collection. Mirrors
// CollectionItem - a collection may hold a mix of loose items and whole
// outfits, and an outfit may belong to several collections at once.
@Entity
@Table(name = "collection_outfits")
public class CollectionOutfit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_outfit_id")
    private Long collectionOutfitId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id")
    private Collection collection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "outfit_id")
    private Outfit outfit;

    public CollectionOutfit() {}

    public Long getCollectionOutfitId() { return collectionOutfitId; }
    public void setCollectionOutfitId(Long collectionOutfitId) { this.collectionOutfitId = collectionOutfitId; }

    public Collection getCollection() { return collection; }
    public void setCollection(Collection collection) { this.collection = collection; }

    public Outfit getOutfit() { return outfit; }
    public void setOutfit(Outfit outfit) { this.outfit = outfit; }
}
