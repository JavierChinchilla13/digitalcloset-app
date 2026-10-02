package com.javier.closetapp.exception;

// An outfit request that breaks a rule the data model can't express (e.g. two
// shoes for one foot). The message is written for the user, so it is returned
// as-is with a 400.
public class InvalidOutfitException extends RuntimeException {

    public InvalidOutfitException(String message) {
        super(message);
    }
}
