package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.LoginRequest;
import com.enerjistaj.devhub.dto.LoginResponse;
import com.enerjistaj.devhub.dto.UserDto;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import java.util.Optional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final ActionLogService actionLogService;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest loginRequest) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));
        } catch (AuthenticationException e) {
            // Başarısız denemeler de kayda geçer: hangi hesap, neden ve hangi adresten.
            String email = loginRequest.getEmail() == null ? "" : loginRequest.getEmail().trim();
            Optional<User> known = email.isEmpty() ? Optional.empty() : userRepository.findByEmail(email);
            String reason = e instanceof DisabledException ? "Pasifleştirilmiş hesapla giriş denemesi"
                    : known.isPresent() ? "Hatalı şifreyle giriş denemesi" : "Kayıtlı olmayan e-postayla giriş denemesi";
            actionLogService.record(LogCategory.OTURUM, LogAction.GIRIS_BASARISIZ, reason).level(LogLevel.UYARI)
                    .target("KULLANICI", known.map(User::getId).orElse(null), known.map(User::getFullName).orElse(email))
                    .detail("Denenen e-posta: " + (email.length() > 120 ? email.substring(0, 120) : email)).save();
            throw e;
        }

        String jwt = jwtUtils.generateJwtToken(authentication);
        
        User user = userRepository.findByEmail(loginRequest.getEmail()).orElseThrow();
        
        UserDto userDto = UserDto.from(user);
        actionLogService.record(LogCategory.OTURUM, LogAction.GIRIS, "Sisteme giriş yaptı").by(user)
                .target("KULLANICI", user.getId(), user.getFullName())
                .detail(user.isMustChangePassword() ? "Geçici şifreyle giriş: şifre değişikliği bekleniyor" : null).save();

        return LoginResponse.builder()
                .token(jwt)
                .user(userDto)
                .build();
    }

    /** Oturum kapatma: belirteç sunucuda tutulmadığı için yalnızca kayda geçer; istemci belirteci siler. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            userRepository.findByEmail(auth.getName()).ifPresent(u ->
                    actionLogService.record(LogCategory.OTURUM, LogAction.CIKIS, "Oturumu kapattı").by(u)
                            .target("KULLANICI", u.getId(), u.getFullName()).save());
        }
        return ResponseEntity.noContent().build();
    }
}
