package com.enerjistaj.devhub.monitoring;

import org.springframework.stereotype.Component;

import java.net.InetSocketAddress;
import java.net.Socket;

/** host:port adresine TCP bağlantısı açılabiliyorsa ayakta sayılır (HTTP konuşmayan servisler için). */
@Component
public class TcpHealthCheck implements HealthCheck {

    @Override
    public String type() {
        return "TCP";
    }

    @Override
    public Result check(MonitoringProperties.ServiceDef service) {
        long start = System.nanoTime();
        try (Socket socket = new Socket()) {
            int colon = service.target().lastIndexOf(':');
            socket.connect(new InetSocketAddress(service.target().substring(0, colon), Integer.parseInt(service.target().substring(colon + 1))), 2000);
            return new Result(true, Probes.elapsedMs(start), "Port açık");
        } catch (Exception e) {
            return new Result(false, Probes.elapsedMs(start), "Bağlanılamadı: " + Probes.reason(e));
        }
    }
}
