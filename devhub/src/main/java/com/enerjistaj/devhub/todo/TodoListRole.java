package com.enerjistaj.devhub.todo;

/** Liste içindeki yetki (uygulamanın genel ADMIN/EMPLOYEE rolünden bağımsız). */
public enum TodoListRole {
    /** Listeyi yeniden adlandırır, siler, üye ekler/çıkarır, yetki verir. */
    ADMIN,
    /** Kart ekler, düzenler, tamamlar; listeden ayrılabilir. */
    MEMBER
}
