package com.enerjistaj.devhub.monitoring;

/**
 * Bir servisin ayakta olup olmadığını denetler. Yeni bir kontrol türü eklemek için bu arayüzü uygulayan
 * bir @Component yazın; type() değeri ayarlardaki "check" alanıyla eşleşir.
 */
public interface HealthCheck {
    String type();

    Result check(MonitoringProperties.ServiceDef service);

    /** @param latencyMs kontrolün sürdüğü süre; message kullanıcıya gösterilir (ör. "HTTP 200") */
    record Result(boolean up, long latencyMs, String message) {}
}
