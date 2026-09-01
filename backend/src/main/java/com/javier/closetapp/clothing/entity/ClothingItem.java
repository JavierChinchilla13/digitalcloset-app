package com.javier.closetapp.clothing.entity;

import com.javier.closetapp.common.enums.ClothingCategory;
import com.javier.closetapp.common.enums.PersonaStatus;
import com.javier.closetapp.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;

import java.time.LocalDateTime;

@Entity
@Table(name = "clothing_items")
@DynamicUpdate
public class ClothingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "item_id")
    private Long itemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClothingCategory category;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "side")
    private String side;

    @Enumerated(EnumType.STRING)
    @Column(name = "persona_type", nullable = false)
    private com.javier.closetapp.common.enums.AvatarType personaType;

    @Column(name = "transform_x")
    private Double transformX = 0.0;

    @Column(name = "transform_y")
    private Double transformY = 0.0;

    @Column(name = "transform_scale")
    private Double transformScale = 1.0;

    @Column(name = "transform_scale_x")
    private Double transformScaleX = 1.0;

    @Column(name = "transform_scale_y")
    private Double transformScaleY = 1.0;

    @Column(name = "transform_rotation")
    private Double transformRotation = 0.0;

    @Column(name = "transform_width")
    private Double transformWidth;

    @Column(name = "transform_height")
    private Double transformHeight;

    @Column(name = "transform_opacity")
    private Double transformOpacity = 1.0;

    @Column(name = "transform_flip_x")
    private Boolean transformFlipX = false;

    @Column(name = "transform_flip_y")
    private Boolean transformFlipY = false;

    @Column(name = "mask_top")
    private Double maskTop;

    @Column(name = "mask_left")
    private Double maskLeft;

    @Column(name = "mask_width")
    private Double maskWidth;

    @Column(name = "mask_height")
    private Double maskHeight;

    @Column(name = "is_modular")
    private Boolean isModular = false;

    @Column(name = "modular_data", columnDefinition = "TEXT")
    private String modularData;

    @Column(name = "is_active")
    private Boolean isActive = true;

    // Whether this item can be shown on the persona (Task 29). Every item
    // created before this field existed went through mandatory fitting, so
    // FITTED is the correct default/backfill value.
    @Enumerated(EnumType.STRING)
    @Column(name = "persona_status", nullable = false)
    private PersonaStatus personaStatus = PersonaStatus.FITTED;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public ClothingItem() {}

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ClothingCategory getCategory() {
        return category;
    }

    public void setCategory(ClothingCategory category) {
        this.category = category;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getSide() {
        return side;
    }

    public void setSide(String side) {
        this.side = side;
    }

    public Boolean getIsModular() {
        return isModular;
    }

    public void setIsModular(Boolean isModular) {
        this.isModular = isModular;
    }

    public String getModularData() {
        return modularData;
    }

    public void setModularData(String modularData) {
        this.modularData = modularData;
    }

    public Boolean getActive() {
        return isActive;
    }

    public void setActive(Boolean active) {
        isActive = active;
    }

    public PersonaStatus getPersonaStatus() {
        return personaStatus;
    }

    public void setPersonaStatus(PersonaStatus personaStatus) {
        this.personaStatus = personaStatus;
    }

    public com.javier.closetapp.common.enums.AvatarType getPersonaType() {
        return personaType;
    }

    public void setPersonaType(com.javier.closetapp.common.enums.AvatarType personaType) {
        this.personaType = personaType;
    }

    public Double getTransformX() {
        return transformX;
    }

    public void setTransformX(Double transformX) {
        this.transformX = transformX;
    }

    public Double getTransformY() {
        return transformY;
    }

    public void setTransformY(Double transformY) {
        this.transformY = transformY;
    }

    public Double getTransformScale() {
        return transformScale;
    }

    public void setTransformScale(Double transformScale) {
        this.transformScale = transformScale;
    }

    public Double getTransformRotation() {
        return transformRotation;
    }

    public void setTransformRotation(Double transformRotation) {
        this.transformRotation = transformRotation;
    }

    public Double getTransformWidth() {
        return transformWidth;
    }

    public void setTransformWidth(Double transformWidth) {
        this.transformWidth = transformWidth;
    }

    public Double getTransformHeight() {
        return transformHeight;
    }

    public void setTransformHeight(Double transformHeight) {
        this.transformHeight = transformHeight;
    }

    public Double getTransformScaleX() {
        return transformScaleX;
    }

    public void setTransformScaleX(Double transformScaleX) {
        this.transformScaleX = transformScaleX;
    }

    public Double getTransformScaleY() {
        return transformScaleY;
    }

    public void setTransformScaleY(Double transformScaleY) {
        this.transformScaleY = transformScaleY;
    }

    public Double getTransformOpacity() {
        return transformOpacity;
    }

    public void setTransformOpacity(Double transformOpacity) {
        this.transformOpacity = transformOpacity;
    }

    public Boolean getTransformFlipX() {
        return transformFlipX;
    }

    public void setTransformFlipX(Boolean transformFlipX) {
        this.transformFlipX = transformFlipX;
    }

    public Boolean getTransformFlipY() {
        return transformFlipY;
    }

    public void setTransformFlipY(Boolean transformFlipY) {
        this.transformFlipY = transformFlipY;
    }

    public Double getMaskTop() {
        return maskTop;
    }

    public void setMaskTop(Double maskTop) {
        this.maskTop = maskTop;
    }

    public Double getMaskLeft() {
        return maskLeft;
    }

    public void setMaskLeft(Double maskLeft) {
        this.maskLeft = maskLeft;
    }

    public Double getMaskWidth() {
        return maskWidth;
    }

    public void setMaskWidth(Double maskWidth) {
        this.maskWidth = maskWidth;
    }

    public Double getMaskHeight() {
        return maskHeight;
    }

    public void setMaskHeight(Double maskHeight) {
        this.maskHeight = maskHeight;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
