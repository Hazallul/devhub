package com.enerjistaj.devhub.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Düz metin e-posta. Geliştirmede Mailpit'e gider (http://localhost:8025, kimseye ulaşmaz); gerçek sunucu
 * SPRING_MAIL_* ortam değişkenleriyle verilir. Gönderim tek bir arka plan iş parçacığında, işlem (transaction) başarıyla
 * bittikten sonra yapılır: SMTP süresi isteği yavaşlatmaz (yanıt süresinden hesabın var olup olmadığı anlaşılmaz) ve geri alınan
 * işlemin e-postası gitmez. Gönderim hatası yalnızca loglanır (içerik loglanmaz).
 */
@Slf4j
@Service
public class MailService {

    private final JavaMailSender sender;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mail-sender");
        t.setDaemon(true);
        return t;
    });

    @Value("${devhub.mail.from:DevHub <noreply@devhub.local>}")
    private String from;

    public MailService(JavaMailSender sender) {
        this.sender = sender;
    }

    public void send(String to, String subject, String text) {
        Runnable task = () -> deliver(to, subject, text);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    worker.execute(task);
                }
            });
        } else {
            worker.execute(task);
        }
    }

    private void deliver(String to, String subject, String text) {
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(text);
            sender.send(m);
        } catch (Exception e) {
            // Konu satırı doğrulama kodunu içerebilir, loglanmaz.
            log.warn("E-posta gönderilemedi: {}", e.getMessage());
        }
    }
}
