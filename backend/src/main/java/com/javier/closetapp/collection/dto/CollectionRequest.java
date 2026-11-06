package com.javier.closetapp.collection.dto;

import com.javier.closetapp.common.TextLimits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Used for both create and rename - a collection is just a name, so there's
// no partial-update ambiguity to handle the way ClothingRequest/ClothingService
// need to (see that class's comment on doubling as an update payload).
public class CollectionRequest {
    @NotBlank(message = "Name is required")
    @Size(max = TextLimits.NAME, message = "Name must be at most 100 characters")
    private String name;

    public CollectionRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
