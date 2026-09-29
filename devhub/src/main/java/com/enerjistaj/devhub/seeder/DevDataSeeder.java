package com.enerjistaj.devhub.seeder;

import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.service.ActionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            String defaultPassword = passwordEncoder.encode("1111");
            
            String[] colors = {"#F6F0D7", "#C5D89D", "#9CAB84", "#89986D"};
            String[] projects = {"Devhub Core", "Mobil Uygulama", "Ödeme Altyapısı", "Raporlama Paneli"};
            String[] statuses = {"AKTIF", "TOPLANTIDA", "IZINLI", "UZAKTAN"};

            User admin = User.builder()
                    .email("admin@devhub.local")
                    .passwordHash(defaultPassword)
                    .fullName("Admin")
                    .role(Role.ADMIN)
                    .avatarColor(colors[0])
                    .build();
            userRepository.save(admin);

            String[][] employeesData = {
                    {"ali.yilmaz", "Ali Yılmaz", "Team Lead"},
                    {"ayse.kaya", "Ayşe Kaya", "Backend Developer"},
                    {"mehmet.demir", "Mehmet Demir", "Frontend Developer"},
                    {"fatma.celik", "Fatma Çelik", "Full-Stack Developer"},
                    {"ahmet.sahin", "Ahmet Şahin", "Mobile Developer"},
                    {"zeynep.ozturk", "Zeynep Öztürk", "QA Engineer"},
                    {"mustafa.koc", "Mustafa Koç", "DevOps Engineer"},
                    {"elif.arslan", "Elif Arslan", "UI/UX Designer"},
                    {"burak.polat", "Burak Polat", "Product Owner"},
                    {"merve.can", "Merve Can", "Data Analyst"},
                    {"can.dogan", "Can Doğan", "Backend Developer"},
                    {"seda.yildiz", "Seda Yıldız", "Frontend Developer"},
                    {"emre.kurt", "Emre Kurt", "Full-Stack Developer"},
                    {"buse.ozdemir", "Buse Özdemir", "QA Engineer"},
                    {"volkan.aydin", "Volkan Aydın", "Backend Developer"}
            };

            int leaveCount = 0;
            for (int i = 0; i < employeesData.length; i++) {
                User emp = User.builder()
                        .email(employeesData[i][0] + "@devhub.local")
                        .fullName(employeesData[i][1])
                        .jobTitle(employeesData[i][2])
                        .passwordHash(defaultPassword)
                        .role(Role.EMPLOYEE)
                        .currentProject(projects[i % projects.length])
                        .status(statuses[i % statuses.length])
                        .avatarColor(colors[i % colors.length])
                        .build();
                userRepository.save(emp);
                if ("IZINLI".equals(emp.getStatus())) seedLeave(emp, leaveCount++);
            }
        }
    }

    // İzinli başlayan kişilerin durumu takvimde görünen onaylı bir izin kaydına dayanır.
    private void seedLeave(User user, int index) {
        LeaveType[] types = {LeaveType.YILLIK, LeaveType.HASTALIK, LeaveType.YILLIK, LeaveType.MAZERET};
        int[][] ranges = {{-2, 3}, {-1, 1}, {-4, 6}, {0, 1}};
        String[] notes = {"Aile ziyareti", "Doktor raporu", "Yaz tatili", "Ev taşıma"};
        int k = index % ranges.length;
        LocalDate today = LocalDate.now(ActionLogService.ZONE);

        LeaveRequest leave = new LeaveRequest();
        leave.setUser(user);
        leave.setType(types[k]);
        leave.setStartDate(today.plusDays(ranges[k][0]));
        leave.setEndDate(today.plusDays(ranges[k][1]));
        leave.setNote(notes[k]);
        leave.setState(LeaveState.ONAYLANDI);
        leave.setDecidedAt(LocalDateTime.now());
        leaveRequestRepository.save(leave);
    }
}
