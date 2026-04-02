package com.example.sound.domain.notification.repository;

import com.example.sound.domain.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query("select n from Notification n " +
           "left join fetch n.sender " +
           "where n.user.id = :userId " +
           "order by n.createdAt desc")
    List<Notification> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

}