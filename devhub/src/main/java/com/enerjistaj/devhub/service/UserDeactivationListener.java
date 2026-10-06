package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.User;

import java.util.List;

/**
 * Bir hesap pasifleştirildiğinde o kişiye bağlı yarım işleri toparlamak isteyen modüller (ör. destek talebi, anket).
 * UserOffboardingService çağırır; dönen satırlar pasifleştirme loguna ayrıntı olarak yazılır.
 */
public interface UserDeactivationListener {
    List<String> userDeactivated(User user, User actor);
}
