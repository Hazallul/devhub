CREATE TABLE projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE action_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert existing projects
INSERT IGNORE INTO projects (name) VALUES ('Devhub Core'), ('Mobil Uygulama'), ('Ödeme Altyapısı'), ('Raporlama Paneli');
