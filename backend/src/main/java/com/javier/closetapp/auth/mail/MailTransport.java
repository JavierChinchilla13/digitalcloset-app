package com.javier.closetapp.auth.mail;

// Task 94: how a finished email leaves the app. The mailers (password reset,
// verification codes) build the branded subject / text / HTML; a transport only
// delivers it. Two implementations, picked with app.mail.mode:
//   smtp  - SmtpMailTransport: a normal SMTP account (works wherever the SMTP
//           ports are open - a laptop, a VPS, a paid Render instance).
//   relay - AppsScriptMailTransport: HTTPS to a Google Apps Script that sends
//           from the owner's Gmail (Render's free tier blocks SMTP ports 25/465/587
//           and a free provider needs a domain; HTTPS on 443 is never blocked).
// Implementations throw an unchecked exception when the email could not be sent;
// the callers log it and never reveal it to the visitor.
public interface MailTransport {

    void send(String toEmail, String replyTo, String subject, String text, String html);
}
