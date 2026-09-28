package com.javier.closetapp.auth.mail;

// Delivers a 6-digit confirmation code for a pending email or password change
// (Task 79 follow-up) to the account's *current* email - never the new one,
// so completing either change still requires access to the already-verified
// inbox. Two purpose-specific methods (not a stringly-typed "purpose" param)
// sharing one bean/template/delivery mechanism, same shape as
// PasswordResetMailer.
public interface VerificationCodeMailer {

    void sendEmailChangeCode(String toEmail, String code);

    void sendPasswordChangeCode(String toEmail, String code);
}
