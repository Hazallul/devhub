package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "user")
    List<LeaveRequest> findByStateAndStartDate(LeaveState state, LocalDate startDate);

    @EntityGraph(attributePaths = "user")
    List<LeaveRequest> findByStateAndEndDate(LeaveState state, LocalDate endDate);

    @Query("select count(l) > 0 from LeaveRequest l"
            + " where l.user.id = :userId and l.state in (com.enerjistaj.devhub.entity.LeaveState.BEKLIYOR, com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI)"
            + " and l.startDate <= :end and l.endDate >= :start")
    boolean existsOverlapping(@Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("select count(l) > 0 from LeaveRequest l"
            + " where l.user.id = :userId and l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI"
            + " and l.startDate <= :day and l.endDate >= :day")
    boolean existsApprovedOn(@Param("userId") Long userId, @Param("day") LocalDate day);

    @Query("select l from LeaveRequest l"
            + " where l.user.id = :userId and l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI"
            + " and l.startDate <= :day and l.endDate >= :day")
    List<LeaveRequest> findApprovedOn(@Param("userId") Long userId, @Param("day") LocalDate day);
}
