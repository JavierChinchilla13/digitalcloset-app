package com.javier.closetapp.clothing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.javier.closetapp.common.enums.ClothingCategory;
import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.common.enums.PersonaStatus;

public class ClothingResponse {
    private Long itemId;
    private String name;
    private String description;
    private ClothingCategory category;
    private String imageUrl;
    private String side;
    private Boolean isModular;
    private String modularData;
    private AvatarType personaType;
    private ClothingTransformDTO transform;
    private Boolean active;
    private String uploadDate;
    private PersonaStatus personaStatus;

    public ClothingResponse() {}

    public ClothingResponse(Long itemId, String name, String description,
                            ClothingCategory category, String imageUrl, String side,
                            Boolean isModular, String modularData,
                            AvatarType personaType,
                            ClothingTransformDTO transform,
                            Boolean active, String uploadDate,
                            PersonaStatus personaStatus) {
        this.itemId = itemId;
        this.name = name;
        this.description = description;
        this.category = category;
        this.imageUrl = imageUrl;
        this.side = side;
        this.isModular = isModular;
        this.modularData = modularData;
        this.personaType = personaType;
        this.transform = transform;
        this.active = active;
        this.uploadDate = uploadDate;
        this.personaStatus = personaStatus;
    }

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public ClothingCategory getCategory() { return category; }
    public void setCategory(ClothingCategory category) { this.category = category; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getSide() { return side; }
    public void setSide(String side) { this.side = side; }

    public Boolean getIsModular() { return isModular; }
    public void setIsModular(Boolean isModular) { this.isModular = isModular; }

    public String getModularData() { return modularData; }
    public void setModularData(String modularData) { this.modularData = modularData; }

    public AvatarType getPersonaType() { return personaType; }
    public void setPersonaType(AvatarType personaType) { this.personaType = personaType; }

    public ClothingTransformDTO getTransform() { return transform; }
    public void setTransform(ClothingTransformDTO transform) { this.transform = transform; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public String getUploadDate() { return uploadDate; }
    public void setUploadDate(String uploadDate) { this.uploadDate = uploadDate; }

    public PersonaStatus getPersonaStatus() { return personaStatus; }
    public void setPersonaStatus(PersonaStatus personaStatus) { this.personaStatus = personaStatus; }
}
