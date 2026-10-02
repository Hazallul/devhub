package com.enerjistaj.devhub.security;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    
    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User Not Found with email: " + username));

        // Pasif hesaplar "disabled" döner: giriş DisabledException ile reddedilir, mevcut token'lar da kabul edilmez.
        return new SessionUser(
                user.getEmail(),
                user.getPasswordHash(),
                user.isActive(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())),
                user.getSessionVersion()
        );
    }
}
