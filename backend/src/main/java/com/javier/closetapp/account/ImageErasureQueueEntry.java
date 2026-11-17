package com.javier.closetapp.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// Audit H12: one picture address waiting to be removed from the image provider. Deliberately has NO link to any person.
@Entity
@Table(name = "image_erasure_queue")
public class ImageErasureQueueEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "queue_id")
    private Long queueId;

    @Column(name = "image_url", nullable = false, unique = true, length = 500)
    private String imageUrl;

    @Column(name = "queued_at", nullable = false)
    private LocalDateTime queuedAt = LocalDateTime.now();

    public ImageErasureQueueEntry() {}

    public ImageErasureQueueEntry(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Long getQueueId() { return queueId; }
    public String getImageUrl() { return imageUrl; }
    public LocalDateTime getQueuedAt() { return queuedAt; }
}
