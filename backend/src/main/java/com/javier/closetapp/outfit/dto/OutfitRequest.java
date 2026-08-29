package com.javier.closetapp.outfit.dto;

import com.javier.closetapp.common.enums.AvatarType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class OutfitRequest {
    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @NotNull(message = "Avatar type is required")
    private AvatarType avatarType;

    // @Valid cascades validation into each OutfitItemRequest.
    @NotEmpty(message = "An outfit must have at least one item")
    @Valid
    private List<OutfitItemRequest> items;

    public OutfitRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public AvatarType getAvatarType() { return avatarType; }
    public void setAvatarType(AvatarType avatarType) { this.avatarType = avatarType; }

    public List<OutfitItemRequest> getItems() { return items; }
    public void setItems(List<OutfitItemRequest> items) { this.items = items; }
}
