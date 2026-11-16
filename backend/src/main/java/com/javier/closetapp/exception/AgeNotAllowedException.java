package com.javier.closetapp.exception;

// Audit H12: a sign-up refused because of the birth month/year given. The message is the same for every refusal (it
// never says why, nor the minimum age), and nothing about the person is stored or logged.
public class AgeNotAllowedException extends RuntimeException {
    public static final String MESSAGE = "We can't create an account with this information.";

    public AgeNotAllowedException() {
        super(MESSAGE);
    }
}
