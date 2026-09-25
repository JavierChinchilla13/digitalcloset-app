package com.javier.closetapp.auth.mail;

// Delivers a password reset link to a user. Kept as an interface so the
// delivery mechanism can change without touching the reset flow: today there's
// only the dev implementation (LoggingPasswordResetMailer); a real SMTP one is
// added at deployment (Task 24) and selected via `app.mail.mode`.
public interface PasswordResetMailer {

    void sendPasswordResetLink(String toEmail, String resetLink);
}
