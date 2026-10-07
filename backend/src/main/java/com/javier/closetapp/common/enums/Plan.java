package com.javier.closetapp.common.enums;

// What an account is entitled to (Task 96). FREE is the default; PREMIUM is for paying users
// (more garment space, no ads). There is no payment code yet - an admin sets the plan. Admins
// are not a plan: their role gives them unlimited space (see PlanLimits).
public enum Plan {
    FREE,
    PREMIUM
}
