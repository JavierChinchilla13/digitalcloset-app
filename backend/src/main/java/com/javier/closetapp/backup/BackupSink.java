package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.OutputStream;

// Where the finished archive goes. The web layer implements it over the HTTP response (headers first, then the body); tests use their own
// to look at the bytes, or to fail halfway like a client that hangs up.
public interface BackupSink {

    // Called once, after the archive is complete and before its first byte is written.
    void begin(String fileName, long contentLength) throws IOException;

    OutputStream body() throws IOException;
}
