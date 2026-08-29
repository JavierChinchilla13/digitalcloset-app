package com.javier.closetapp.clothing.dto;

import com.javier.closetapp.common.enums.ClothingCategory;
import com.javier.closetapp.common.enums.AvatarType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// Doubles as the update payload (ClothingService.updateItem applies fields only
// when non-null), so these constraints are only enforced where the controller
// applies @Valid - i.e. on create, not on update.
public class ClothingRequest {
    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @NotNull(message = "Category is required")
    private ClothingCategory category;

    @NotBlank(message = "Image URL is required")
    @Size(max = 500, message = "Image URL must be at most 500 characters")
    private String imageUrl;

    private String side;
    private Boolean isModular;
    private String modularData;

    @NotNull(message = "Persona type is required")
    private AvatarType personaType;

    private ClothingTransformDTO transform;

    public ClothingRequest() {}

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
}
