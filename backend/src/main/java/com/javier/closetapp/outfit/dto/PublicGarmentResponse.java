package com.javier.closetapp.outfit.dto;

import com.javier.closetapp.clothing.dto.ClothingResponse;
import com.javier.closetapp.clothing.dto.ClothingTransformDTO;
import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.common.enums.ClothingCategory;
import com.javier.closetapp.common.enums.PersonaStatus;

// Task 102: a garment as a share link shows it - the picture and how it is placed, without the private
// description, upload date or active flag of the owner's own ClothingResponse.
public class PublicGarmentResponse {
    private Long itemId;
    private String name;
    private ClothingCategory category;
    private String imageUrl;
    private String side;
    private Boolean isModular;
    private String modularData;
    private AvatarType personaType;
    private ClothingTransformDTO transform;
    private PersonaStatus personaStatus;

    public PublicGarmentResponse() {}

    // Keeps only the public fields of the owner's garment response.
    public static PublicGarmentResponse from(ClothingResponse source) {
        PublicGarmentResponse r = new PublicGarmentResponse();
        r.itemId = source.getItemId();
        r.name = source.getName();
        r.category = source.getCategory();
        r.imageUrl = source.getImageUrl();
        r.side = source.getSide();
        r.isModular = source.getIsModular();
        r.modularData = source.getModularData();
        r.personaType = source.getPersonaType();
        r.transform = source.getTransform();
        r.personaStatus = source.getPersonaStatus();
        return r;
    }

    public Long getItemId() { return itemId; }
    public String getName() { return name; }
    public ClothingCategory getCategory() { return category; }
    public String getImageUrl() { return imageUrl; }
    public String getSide() { return side; }
    public Boolean getIsModular() { return isModular; }
    public String getModularData() { return modularData; }
    public AvatarType getPersonaType() { return personaType; }
    public ClothingTransformDTO getTransform() { return transform; }
    public PersonaStatus getPersonaStatus() { return personaStatus; }
}
