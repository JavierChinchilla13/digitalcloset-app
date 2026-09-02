package com.javier.closetapp.collection.entity;

import com.javier.closetapp.clothing.entity.ClothingItem;
import jakarta.persistence.*;

// Join row: one clothing item's membership in one collection. A clothing
// item may belong to several collections at once (Phase 7 open question #3),
// so this is a plain many-to-many join table, not a foreign key on
// ClothingItem itself.
@Entity
@Table(name = "collection_items")
public class CollectionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_item_id")
    private Long collectionItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id")
    private Collection collection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private ClothingItem clothingItem;

    public CollectionItem() {}

    public Long getCollectionItemId() { return collectionItemId; }
    public void setCollectionItemId(Long collectionItemId) { this.collectionItemId = collectionItemId; }

    public Collection getCollection() { return collection; }
    public void setCollection(Collection collection) { this.collection = collection; }

    public ClothingItem getClothingItem() { return clothingItem; }
    public void setClothingItem(ClothingItem clothingItem) { this.clothingItem = clothingItem; }
}
