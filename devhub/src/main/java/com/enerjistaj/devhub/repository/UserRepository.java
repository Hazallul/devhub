package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    // users.current_project düz metin olduğu için proje yeniden adlandırılınca elle güncellenir.
    @Modifying
    @Query("update User u set u.currentProject = :newName where u.currentProject = :oldName")
    int renameProject(@Param("oldName") String oldName, @Param("newName") String newName);
}
