package com.javier.closetapp.user.repository;

import com.javier.closetapp.user.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

// Accounts, found by email (the unique login name).
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    // Task 98: Google reports emails in lower case while sign-up kept whatever was typed, so a Google
    // sign-in looks an account up ignoring case. If two accounts differ only by case, the older one wins.
    Optional<User> findFirstByEmailIgnoreCaseOrderByUserIdAsc(String email);

    Optional<User> findByGoogleId(String googleId);

    // Task 96: the account row locked for the rest of the transaction. Creating a garment takes
    // this lock before it counts, so two requests at once cannot both see room for "one more".
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.userId = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);
}
