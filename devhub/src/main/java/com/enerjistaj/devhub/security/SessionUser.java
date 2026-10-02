package com.enerjistaj.devhub.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

/** Spring Security kullanıcısı + oturum sürümü: token'daki sürüm bununla eşleşmezse token geçersizdir. */
public class SessionUser extends User {

    private final int sessionVersion;

    public SessionUser(String username, String password, boolean enabled, Collection<? extends GrantedAuthority> authorities, int sessionVersion) {
        super(username, password, enabled, true, true, true, authorities);
        this.sessionVersion = sessionVersion;
    }

    public int getSessionVersion() {
        return sessionVersion;
    }
}
