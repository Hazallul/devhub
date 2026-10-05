package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.User;

/**
 * Bir görev tamamlandığında haberdar olmak isteyen modüller (ör. destek talebi: bağlı görev bitince talebe not düşer).
 * TaskStatusService tamamlanan her görev için çağırır; görev modülü bu modülleri tanımak zorunda kalmaz.
 */
public interface TaskCompletionListener {
    void taskCompleted(Task task, User actor);
}
