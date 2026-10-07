package com.javier.closetapp.exception;

import com.javier.closetapp.common.enums.Plan;

// Thrown when adding a garment would go past the account's limit (Task 96). Mapped to HTTP 403
// with code GARMENT_LIMIT by GlobalExceptionHandler, so the frontend can tell it apart from an
// ownership refusal and offer the upgrade hint.
public class GarmentLimitExceededException extends RuntimeException {

    private final int limit;
    private final Plan plan;

    public GarmentLimitExceededException(int limit, Plan plan) {
        super(plan == Plan.PREMIUM
                ? "Your plan holds up to " + limit + " garments. Delete a garment to add another."
                : "Your free plan holds up to " + limit + " garments. Delete a garment to add another.");
        this.limit = limit;
        this.plan = plan;
    }

    public int getLimit() {
        return limit;
    }

    public Plan getPlan() {
        return plan;
    }
}
