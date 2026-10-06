package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findAllByOrderByCreatedAtDesc();

    List<LeaveRequest> findByUserId(Long userId);

    /** Bir yılla kesişen, belirli türdeki onaylı/bekleyen izinler (bakiye hesabı için). */
    @Query("select l from LeaveRequest l where l.type = :type and l.state in :states"
            + " and l.startDate <= :to and l.endDate >= :from")
    List<LeaveRequest> findByTypeAndStatesBetween(@Param("type") LeaveType type, @Param("states") Collection<LeaveState> states,
                                                  @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Tarihi tamamen geçmiş, hâlâ karar bekleyen talepler (hastalık hariç: rapor sonradan gelir). */
    @EntityGraph(attributePaths = "user")
    List<LeaveRequest> findByStateAndEndDateBeforeAndTypeNot(LeaveState state, LocalDate endDate, LeaveType type);

    @Query("select count(l) > 0 from LeaveRequest l"
            + " where l.user.id = :userId and l.state in (com.enerjistaj.devhub.entity.LeaveState.BEKLIYOR, com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI)"
            + " and l.startDate <= :end and l.endDate >= :start")
    boolean existsOverlapping(@Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    /** Belirli günü kapsayan onaylı izinler (durum eşitlemesi için). */
    @EntityGraph(attributePaths = "user")
    @Query("select l from LeaveRequest l where l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI"
            + " and l.startDate <= :day and l.endDate >= :day")
    List<LeaveRequest> findApprovedOn(@Param("day") LocalDate day);

    @Query("select count(l) > 0 from LeaveRequest l"
            + " where l.user.id = :userId and l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI"
            + " and l.startDate <= :day and l.endDate >= :day")
    boolean existsApprovedOn(@Param("userId") Long userId, @Param("day") LocalDate day);

    @Query("select l from LeaveRequest l"
            + " where l.user.id = :userId and l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI"
            + " and l.startDate <= :day and l.endDate >= :day")
    List<LeaveRequest> findApprovedOn(@Param("userId") Long userId, @Param("day") LocalDate day);

    /** [from, to] günlerine değen onaylı izinler (iş gücü hesabında izinli günler sayılmaz). */
    @Query("select l from LeaveRequest l join fetch l.user where l.state = com.enerjistaj.devhub.entity.LeaveState.ONAYLANDI and l.endDate >= :from and l.startDate <= :to")
    List<LeaveRequest> findApprovedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
