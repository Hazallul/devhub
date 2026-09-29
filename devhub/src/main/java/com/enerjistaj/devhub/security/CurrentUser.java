package com.enerjistaj.devhub.security;

import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** İsteği yapan (JWT ile doğrulanmış) kullanıcıya erişim ve ortak yetki kontrolleri. */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UserRepository userRepository;

    public User get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Oturum süresi doldu, tekrar giriş yapın.");
        }
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Oturum süresi doldu, tekrar giriş yapın."));
    }

    public static boolean isAdmin(User user) {
        return user.getRole() == Role.ADMIN;
    }

    public User requireAdmin(String message) {
        User me = get();
        if (!isAdmin(me)) throw ApiException.forbidden(message);
        return me;
    }

    /** Yönetici herkes adına, çalışan yalnızca kendi adına işlem yapabilir. */
    public User requireSelfOrAdmin(Long ownerId, String message) {
        User me = get();
        if (!isAdmin(me) && !me.getId().equals(ownerId)) throw ApiException.forbidden(message);
        return me;
    }
}
