package com.example.sound;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SoundApplication {

    public static void main(String[] args) {
        SpringApplication.run(SoundApplication.class, args);
    }

}