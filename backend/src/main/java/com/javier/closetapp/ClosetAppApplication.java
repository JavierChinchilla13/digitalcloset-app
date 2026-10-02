package com.javier.closetapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Entry point of the API. Spring Boot scans this package (com.javier.closetapp) for the
// controllers, services, repositories and configuration; settings come from
// application.properties plus the active profile (see PROJECT_STRUCTURE.md).
@SpringBootApplication
public class ClosetAppApplication {

	public static void main(String[] args) {
		SpringApplication.run(ClosetAppApplication.class, args);
	}

}
