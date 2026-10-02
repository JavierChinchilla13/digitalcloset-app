package com.javier.closetapp.outfit.entity;

import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// A saved outfit (outfits table): name, which persona type it was made for, and its pieces
// (OutfitItem rows, deleted together with the outfit). Owned by one user.
@Entity
@Table(name = "outfits")
public class Outfit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "outfit_id")
    private Long outfitId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "avatar_type", nullable = false)
    private AvatarType avatarType;

    @OneToMany(mappedBy = "outfit", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OutfitItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Outfit() {}

    public Long getOutfitId() { return outfitId; }
    public void setOutfitId(Long outfitId) { this.outfitId = outfitId; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public AvatarType getAvatarType() { return avatarType; }
    public void setAvatarType(AvatarType avatarType) { this.avatarType = avatarType; }

    public List<OutfitItem> getItems() { return items; }
    public void setItems(List<OutfitItem> items) { this.items = items; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
