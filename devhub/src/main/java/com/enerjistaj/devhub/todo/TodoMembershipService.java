package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** Ortak listelerin sahipsiz kalmamasını sağlar. */
@Service
@RequiredArgsConstructor
public class TodoMembershipService {

    private final TodoListMemberRepository members;

    /**
     * Kullanıcı pasifleştirildi: yöneticisi olduğu listelerde başka aktif yönetici kalmadıysa,
     * listeye en önce katılmış aktif üye yönetici yapılır (yoksa liste olduğu gibi kalır).
     */
    public void onUserDeactivated(User user) {
        for (TodoListMember mine : members.findByUserId(user.getId())) {
            if (mine.getRole() != TodoListRole.ADMIN) continue;
            List<TodoListMember> others = members.findByListIdOrderByJoinedAtAscIdAsc(mine.getList().getId()).stream()
                .filter(m -> !m.getUser().getId().equals(user.getId()) && m.getUser().isActive()).toList();
            if (others.stream().anyMatch(m -> m.getRole() == TodoListRole.ADMIN)) continue;
            others.stream().findFirst().ifPresent(m -> {
                m.setRole(TodoListRole.ADMIN);
                members.save(m);
            });
        }
    }
}
