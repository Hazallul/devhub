package com.enerjistaj.devhub.controller;

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
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        String jwt = jwtUtils.generateJwtToken(authentication);
        
        User user = userRepository.findByEmail(loginRequest.getEmail()).orElseThrow();
        
        UserDto userDto = UserDto.from(user);

        return LoginResponse.builder()
                .token(jwt)
                .user(userDto)
                .build();
    }
}
