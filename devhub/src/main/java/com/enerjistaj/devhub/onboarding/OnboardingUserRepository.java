package com.enerjistaj.devhub.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OnboardingUserRepository extends JpaRepository<OnboardingUser, Long> {
    @Query("select o from OnboardingUser o join fetch o.user u where u.active = true order by o.startedAt desc")
    List<OnboardingUser> findAllActiveUsers();
}
