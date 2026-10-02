package com.enerjistaj.devhub.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtils {

    private static final String SESSION_VERSION = "sv";

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expirationMs}")
    private int jwtExpirationMs;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    /** Token, kullanıcının o anki oturum sürümünü ("sv") taşır; şifre değişince sürüm artar ve eski token'lar reddedilir. */
    public String generateJwtToken(Authentication authentication) {
        UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
        int version = userPrincipal instanceof SessionUser s ? s.getSessionVersion() : 0;
        return generateToken(userPrincipal.getUsername(), version);
    }

    public String generateToken(String email, int sessionVersion) {
        return Jwts.builder()
                .subject(email)
                .claim(SESSION_VERSION, sessionVersion)
                .issuedAt(new Date())
                .expiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(key())
                .compact();
    }

    /** İmzası ve süresi geçerliyse içerik, değilse null. */
    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    /** Sürüm alanı olmayan (bu özellikten önce verilmiş) token'lar 0 sayılır. */
    public static int sessionVersion(Claims claims) {
        Integer v = claims.get(SESSION_VERSION, Integer.class);
        return v == null ? 0 : v;
    }
}
