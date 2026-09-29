package com.enerjistaj.devhub.monitoring;

import java.util.List;

/**
 * Servise özel ek metrikler (ör. JVM heap, veritabanı bağlantı sayısı). Yeni bir toplayıcı eklemek için
 * bu arayüzü uygulayan bir @Component yazın; type() değeri ayarlardaki "probe" alanıyla eşleşir.
 */
public interface MetricProbe {
    String type();

    List<Detail> collect(MonitoringProperties.ServiceDef service);

    /** @param hint değerin altında gösterilen kısa açıklama (boş olabilir) */
    record Detail(String label, String value, String hint) {}
}
