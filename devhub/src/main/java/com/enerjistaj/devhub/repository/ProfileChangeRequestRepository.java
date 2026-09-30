package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.ProfileChangeRequest;
import com.enerjistaj.devhub.entity.ProfileRequestState;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProfileChangeRequestRepository extends JpaRepository<ProfileChangeRequest, Long> {
    @EntityGraph(attributePaths = {"user", "decidedBy"})
    List<ProfileChangeRequest> findTop60ByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"user", "decidedBy"})
    List<ProfileChangeRequest> findTop10ByUserIdOrderByCreatedAtDesc(Long userId);

    List<ProfileChangeRequest> findByUserIdAndState(Long userId, ProfileRequestState state);

    long countByState(ProfileRequestState state);
}
