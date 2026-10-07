package com.javier.closetapp.user.service;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.user.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// The one place that says how many garments an account may keep (Task 96): admins are
// unlimited, a PREMIUM account gets app.limits.garments.premium (300), everyone else
// app.limits.garments.free (15). Photos live on a free Cloudinary plan, so this is what
// keeps storage and bandwidth in check.
@Component
public class PlanLimits {

    private final int freeGarments;
    private final int premiumGarments;

    public PlanLimits(@Value("${app.limits.garments.free:15}") int freeGarments,
                      @Value("${app.limits.garments.premium:300}") int premiumGarments) {
        this.freeGarments = freeGarments;
        this.premiumGarments = premiumGarments;
    }

    // How many active garments the user may have, or null when there is no limit (admins).
    public Integer garmentLimit(User user) {
        if (user.getRole() == Role.ROLE_ADMIN) {
            return null;
        }
        return user.getPlan() == Plan.PREMIUM ? premiumGarments : freeGarments;
    }
}
