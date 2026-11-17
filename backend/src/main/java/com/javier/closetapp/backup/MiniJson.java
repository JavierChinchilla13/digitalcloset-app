package com.javier.closetapp.backup;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// A tiny JSON writer and parser (objects, arrays, strings, integers, booleans, null) for the manifest, so reading a backup needs nothing
// but the JDK: the restore tool runs straight from target/classes, with no Jackson on its classpath. It only has to read what
// Manifest.toJson writes, and it refuses anything else.
final class MiniJson {

    private MiniJson() { }

    // --- writing ---

    static String write(Object value) {
        StringBuilder sb = new StringBuilder();
        write(value, sb, 0);
        return sb.append('\n').toString();
    }

    private static void write(Object value, StringBuilder sb, int depth) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String s) {
            string(s, sb);
        } else if (value instanceof Number || value instanceof Boolean) {
            sb.append(value);
        } else if (value instanceof Map<?, ?> map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                sb.append(first ? "\n" : ",\n").append("  ".repeat(depth + 1));
                string(String.valueOf(e.getKey()), sb);
                sb.append(": ");
                write(e.getValue(), sb, depth + 1);
                first = false;
            }
            sb.append(first ? "}" : "\n" + "  ".repeat(depth) + "}");
        } else if (value instanceof List<?> list) {
            sb.append('[');
            boolean first = true;
            for (Object o : list) {
                sb.append(first ? "\n" : ",\n").append("  ".repeat(depth + 1));
                write(o, sb, depth + 1);
                first = false;
            }
            sb.append(first ? "]" : "\n" + "  ".repeat(depth) + "]");
        } else {
            throw new IllegalArgumentException("Unsupported JSON value");
        }
    }

    private static void string(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        sb.append('"');
    }

    // --- parsing ---

    static Object parse(String text) throws ArchiveException {
        Parser p = new Parser(text);
        Object value = p.value();
        p.skipSpace();
        if (p.pos != text.length()) throw bad();
        return value;
    }

    private static ArchiveException bad() {
        return new ArchiveException("The manifest is not valid.");
    }

    private static final class Parser {
        private final String s;
        private int pos = 0;
        private int depth = 0;

        Parser(String s) {
            this.s = s;
        }

        void skipSpace() {
            while (pos < s.length() && Character.isWhitespace(s.charAt(pos))) pos++;
        }

        Object value() throws ArchiveException {
            skipSpace();
            if (pos >= s.length()) throw bad();
            char c = s.charAt(pos);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (s.startsWith("true", pos)) { pos += 4; return Boolean.TRUE; }
            if (s.startsWith("false", pos)) { pos += 5; return Boolean.FALSE; }
            if (s.startsWith("null", pos)) { pos += 4; return null; }
            return number();
        }

        private Map<String, Object> object() throws ArchiveException {
            if (++depth > 20) throw bad();
            pos++;
            Map<String, Object> map = new LinkedHashMap<>();
            skipSpace();
            if (peek() == '}') { pos++; depth--; return map; }
            while (true) {
                skipSpace();
                if (peek() != '"') throw bad();
                String key = string();
                skipSpace();
                if (peek() != ':') throw bad();
                pos++;
                map.put(key, value());
                skipSpace();
                char c = peek();
                pos++;
                if (c == '}') break;
                if (c != ',') throw bad();
            }
            depth--;
            return map;
        }

        private List<Object> array() throws ArchiveException {
            if (++depth > 20) throw bad();
            pos++;
            List<Object> list = new ArrayList<>();
            skipSpace();
            if (peek() == ']') { pos++; depth--; return list; }
            while (true) {
                list.add(value());
                skipSpace();
                char c = peek();
                pos++;
                if (c == ']') break;
                if (c != ',') throw bad();
            }
            depth--;
            return list;
        }

        private String string() throws ArchiveException {
            pos++;   // opening quote
            StringBuilder sb = new StringBuilder();
            while (true) {
                if (pos >= s.length()) throw bad();
                char c = s.charAt(pos++);
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                if (pos >= s.length()) throw bad();
                char e = s.charAt(pos++);
                switch (e) {
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case '/' -> sb.append('/');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'u' -> {
                        if (pos + 4 > s.length()) throw bad();
                        try {
                            sb.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16));
                        } catch (NumberFormatException ex) {
                            throw bad();
                        }
                        pos += 4;
                    }
                    default -> throw bad();
                }
            }
        }

        private Object number() throws ArchiveException {
            int start = pos;
            if (pos < s.length() && s.charAt(pos) == '-') pos++;
            while (pos < s.length() && Character.isDigit(s.charAt(pos))) pos++;
            if (pos == start) throw bad();
            try {
                return Long.parseLong(s.substring(start, pos));
            } catch (NumberFormatException e) {
                throw bad();
            }
        }

        private char peek() throws ArchiveException {
            if (pos >= s.length()) throw bad();
            return s.charAt(pos);
        }
    }
}
