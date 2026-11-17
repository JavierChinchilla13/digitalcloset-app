package com.javier.closetapp.account;

import com.javier.closetapp.clothing.service.ClothingService;
import com.javier.closetapp.collection.service.CollectionService;
import com.javier.closetapp.outfit.service.OutfitService;
import com.javier.closetapp.persona.service.PersonaDisplayNameService;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

// Audit H12: "download my data" - everything the signed-in person has in the service, as one JSON document (the right of access).
// It holds only that person's own data. It never includes the password hash, session tokens, or the payment provider's ids.
@Service
public class AccountExportService {

    private final UserService userService;
    private final ClothingService clothingService;
    private final OutfitService outfitService;
    private final CollectionService collectionService;
    private final PersonaDisplayNameService personaDisplayNameService;

    public AccountExportService(UserService userService, ClothingService clothingService, OutfitService outfitService,
                                CollectionService collectionService, PersonaDisplayNameService personaDisplayNameService) {
        this.userService = userService;
        this.clothingService = clothingService;
        this.outfitService = outfitService;
        this.collectionService = collectionService;
        this.personaDisplayNameService = personaDisplayNameService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> export() {
        User user = userService.getAuthenticatedUser();

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("email", user.getEmail());
        profile.put("firstName", user.getFirstName());
        profile.put("lastName", user.getLastName());
        profile.put("accountCreatedAt", user.getCreatedAt());
        profile.put("plan", user.getPlan());
        profile.put("subscriptionStatus", user.getSubscriptionStatus());
        profile.put("subscriptionPeriodEnd", user.getCurrentPeriodEnd());
        profile.put("signsInWithGoogle", user.getGoogleId() != null);
        profile.put("birthMonth", user.getBirthMonth());
        profile.put("birthYear", user.getBirthYear());
        profile.put("guardianAuthorized", user.isGuardianAuthorized());
        profile.put("guardianAuthorizedAt", user.getGuardianAuthorizedAt());
        profile.put("termsVersionAccepted", user.getTermsVersion());
        profile.put("termsAcceptedAt", user.getTermsAcceptedAt());
        profile.put("dataAuthorizedAt", user.getDataAuthorizedAt());

        Map<String, Object> export = new LinkedHashMap<>();
        export.put("exportedAt", LocalDateTime.now(ZoneOffset.UTC));
        export.put("profile", profile);
        export.put("garments", clothingService.getAllItems());
        export.put("outfits", outfitService.getAllOutfits());
        export.put("categories", collectionService.getAllCollections());
        export.put("personaNames", personaDisplayNameService.getAll());
        return export;
    }
}
