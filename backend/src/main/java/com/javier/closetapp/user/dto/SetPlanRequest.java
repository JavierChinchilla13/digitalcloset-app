package com.javier.closetapp.user.dto;

import com.javier.closetapp.common.enums.Plan;
import jakarta.validation.constraints.NotNull;

// Body of PATCH /api/users/{id}/plan (admin-only): the plan to give an account.
public class SetPlanRequest {

    @NotNull(message = "Plan is required")
    private Plan plan;

    public SetPlanRequest() {}

    public Plan getPlan() {
        return plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }
}
