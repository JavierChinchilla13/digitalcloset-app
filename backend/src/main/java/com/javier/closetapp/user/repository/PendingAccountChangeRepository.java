package com.javier.closetapp.user.repository;

import com.javier.closetapp.common.enums.AccountChangeType;
import com.javier.closetapp.user.entity.PendingAccountChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PendingAccountChangeRepository extends JpaRepository<PendingAccountChange, Long> {

    Optional<PendingAccountChange> findFirstByUser_UserIdAndChangeTypeOrderByCreatedAtDesc(
            Long userId, AccountChangeType changeType);

    @Modifying
    @Query("delete from PendingAccountChange c where c.user.userId = :userId and c.changeType = :changeType")
    void deleteAllByUserIdAndChangeType(@Param("userId") Long userId, @Param("changeType") AccountChangeType changeType);
}
