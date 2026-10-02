package com.enerjistaj.devhub.passwordreset;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PasswordResetRepository extends JpaRepository<PasswordResetRequest, Long> {
    Optional<PasswordResetRequest> findFirstByUserIdAndStateOrderByCreatedAtDesc(Long userId, PasswordResetState state);

    List<PasswordResetRequest> findByUserIdAndStateIn(Long userId, Collection<PasswordResetState> states);

    long countByUserIdAndCreatedAtAfter(Long userId, LocalDateTime since);

    Optional<PasswordResetRequest> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"user", "decidedBy"})
    List<PasswordResetRequest> findByStateOrderByCreatedAtDesc(PasswordResetState state);

    @EntityGraph(attributePaths = {"user", "decidedBy"})
    List<PasswordResetRequest> findTop30ByStateInOrderByDecidedAtDesc(Collection<PasswordResetState> states);

    long countByState(PasswordResetState state);
}
