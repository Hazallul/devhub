package com.enerjistaj.devhub.dto;

import lombok.Builder;
import lombok.Data;

/** Bir kişinin bir yıldaki yıllık izin durumu (iş günü cinsinden). */
@Data
@Builder
public class LeaveBalanceDto {
    private Long userId;
    private int year;
    private int entitlement;
    /** Onaylanmış yıllık izinler */
    private int used;
    /** Onay bekleyen yıllık izin talepleri */
    private int pending;
    /** entitlement - used (bekleyenler düşülmeden) */
    private int remaining;
}
