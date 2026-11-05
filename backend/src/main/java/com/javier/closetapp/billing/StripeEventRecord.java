package com.javier.closetapp.billing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// Task 103: a Stripe webhook event that was already handled (stripe_events), so a redelivery is ignored.
@Entity
@Table(name = "stripe_events")
public class StripeEventRecord {

    @Id
    @Column(name = "event_id", length = 255)
    private String eventId;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt = LocalDateTime.now();

    public StripeEventRecord() {}

    public StripeEventRecord(String eventId) {
        this.eventId = eventId;
    }

    public String getEventId() { return eventId; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
}
