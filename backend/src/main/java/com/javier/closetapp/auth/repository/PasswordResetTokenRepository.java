package com.javier.closetapp.auth.repository;

import com.javier.closetapp.auth.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    Optional<PasswordResetToken> findFirstByUser_UserIdOrderByCreatedAtDesc(Long userId);

    @Modifying
    @Query("delete from PasswordResetToken t where t.user.userId = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
