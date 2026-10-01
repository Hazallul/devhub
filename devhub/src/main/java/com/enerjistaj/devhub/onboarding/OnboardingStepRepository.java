package com.enerjistaj.devhub.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OnboardingStepRepository extends JpaRepository<OnboardingStep, Long> {
    List<OnboardingStep> findAllByOrderByPositionAscIdAsc();

    List<OnboardingStep> findByAutoRuleAndLink(OnboardingRule rule, String link);

    @Query("select coalesce(max(s.position), 0) from OnboardingStep s")
    int maxPosition();
}
