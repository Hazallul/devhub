package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.realtime.RealtimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Şifre değişince kişinin bütün açık oturumlarını kapatır: oturum sürümü artar (eski token'lar 401 alır) ve açık anlık bildirim
 * bağlantıları kesilir. Kendi şifresini değiştiren kişiye yeni bir token verilir, o tarayıcıdaki oturum sürer.
 * Çağıran, kullanıcıyı kaydetmekten sorumludur.
 */
@Service
@RequiredArgsConstructor
public class SessionService {

    private final RealtimeService realtime;

    public void revokeAll(User user) {
        user.setSessionVersion(user.getSessionVersion() + 1);
        realtime.disconnect(user.getId());
    }
}
