package com.javier.closetapp.collection.entity;

import com.javier.closetapp.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Named "Collection" per the product pivot addendum's naming decision -
// ClothingCategory already exists as an enum (TOP/BOTTOM/SHOES/...), so a
// second, unrelated "category" concept would collide with it permanently.
// UI copy still says "Categories"; only the code-level name differs.
//
// NOTE: this shares its simple name with java.util.Collection. Never
// wildcard-import java.util.* in a file that also uses this class - keep
// java.util imports explicit (List, ArrayList, etc.) as done here.
@Entity
@Table(name = "collections")
public class Collection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_id")
    private Long collectionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @Column(nullable = false)
    private String name;

    @OneToMany(mappedBy = "collection", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CollectionItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "collection", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CollectionOutfit> outfits = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Collection() {}

    public Long getCollectionId() { return collectionId; }
    public void setCollectionId(Long collectionId) { this.collectionId = collectionId; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<CollectionItem> getItems() { return items; }
    public void setItems(List<CollectionItem> items) { this.items = items; }

    public List<CollectionOutfit> getOutfits() { return outfits; }
    public void setOutfits(List<CollectionOutfit> outfits) { this.outfits = outfits; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
