package com.example.sound.global.util;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
public class UserCodeGenerator {

    private static final String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int length = 8;

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder stringBuilder = new StringBuilder(length);

        for (int index = 0; index < length; index++) {
            stringBuilder.append(characters.charAt(random.nextInt(characters.length())));
        }

        return stringBuilder.toString();
    }
}