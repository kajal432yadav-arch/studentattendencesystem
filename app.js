/* ============================================================
   Student Attendance System - Frontend JavaScript
   ============================================================ */

const API_BASE = '';
let currentUser = null;
let weeklyChart = null;
let distributionChart = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('attendance-date');
    if (dateEl) dateEl.value = today;
    
    // Set report date range (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fromDateEl = document.getElementById('report-from-date');
    const toDateEl = document.getElementById('report-to-date');
    if (fromDateEl) fromDateEl.value = thirtyDaysAgo;
    if (toDateEl) toDateEl.value = today;
    
    // Set current date in topbar
    updateTopbarDate();
    
    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
    
    // Load accent color
    const savedAccent = localStorage.getItem('accent');
    if (savedAccent) {
        document.documentElement.setAttribute('data-accent', savedAccent);
        updateAccentButtons(savedAccent);
    }
    
    // Check session
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    }
    
    // Login form handler
    document.getElementById('login-form').addEventListener('submit', handleLogin);
});

function updateTopbarDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('page-subtitle').textContent = now.toLocaleDateString('en-IN', options);
}

// ============================================================
// AUTHENTICATION
// ============================================================

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    
    loginBtn.innerHTML = '<span class="loading"></span>';
    loginBtn.disabled = true;
    errorEl.textContent = '';
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showApp();
        } else {
            errorEl.textContent = data.message || 'Invalid credentials';
        }
    } catch (err) {
        errorEl.textContent = 'Server connection failed. Make sure the server is running.';
    }
    
    loginBtn.innerHTML = '<span>Sign In</span><span class="material-icons-round">arrow_forward</span>';
    loginBtn.disabled = false;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = currentUser.full_name;
    
    loadDashboard();
    loadClassFilters();
}

function togglePassword() {
    const input = document.getElementById('login-password');
    const icon = document.querySelector('.toggle-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility_off';
    }
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        students: 'Student Management',
        attendance: 'Mark Attendance',
        reports: 'Attendance Reports',
        classes: 'Classes & Sections',
        notices: 'Notice Board',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[page] || page;
    
    // Load page data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'students': loadStudents(); break;
        case 'attendance': loadAttendanceForDate(); break;
        case 'reports': break;
        case 'classes': loadClasses(); break;
        case 'notices': loadNotices(); break;
    }
    
    // Close mobile sidebar
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

// ============================================================
// THEME
// ============================================================

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = newTheme === 'dark';
    
    const themeBtn = document.querySelector('#theme-toggle .material-icons-round');
    themeBtn.textContent = newTheme === 'dark' ? 'light_mode' : 'dark_mode';
    
    // Recreate charts with new theme
    if (weeklyChart) loadWeeklyTrend();
    if (distributionChart) loadDistribution();
}

function setAccent(accent) {
    if (accent === 'indigo') {
        document.documentElement.removeAttribute('data-accent');
    } else {
        document.documentElement.setAttribute('data-accent', accent);
    }
    localStorage.setItem('accent', accent);
    updateAccentButtons(accent);
}

function updateAccentButtons(accent) {
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
    const accents = ['indigo', 'emerald', 'rose', 'amber', 'cyan'];
    const index = accents.indexOf(accent);
    if (index >= 0) {
        document.querySelectorAll('.color-btn')[index]?.classList.add('active');
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    loadDashboardStats();
    loadWeeklyTrend();
    loadDistribution();
    loadClassWise();
    loadRecentActivity();
}

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/stats`);
        const data = await res.json();
        
        animateCounter('stat-total-students', data.total_students);
        animateCounter('stat-present', data.today_present);
        animateCounter('stat-absent', data.today_absent);
        document.getElementById('stat-rate').textContent = data.attendance_rate + '%';
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const duration = 800;
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * easeOut);
        if (progress < 1) requestAnimationFrame(update);
    }
    
    requestAnimationFrame(update);
}

async function loadWeeklyTrend() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/weekly-trend`);
        const data = await res.json();
        
        const ctx = document.getElementById('weekly-chart').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
        
        if (weeklyChart) weeklyChart.destroy();
        
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.day),
                datasets: [
                    {
                        label: 'Present',
                        data: data.map(d => d.present),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Absent',
                        data: data.map(d => d.absent),
                        backgroundColor: 'rgba(244, 63, 94, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Late',
                        data: data.map(d => d.late),
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            font: { family: 'Inter', size: 12 },
                            color: textColor
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 12 }, color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { font: { family: 'Inter', size: 12 }, color: textColor },
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load weekly trend:', err);
    }
}

async function loadDistribution() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/stats`);
        const data = await res.json();
        
        const ctx = document.getElementById('distribution-chart').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
        
        if (distributionChart) distributionChart.destroy();
        
        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent', 'Late'],
                datasets: [{
                    data: [data.today_present, data.today_absent, data.today_late],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.85)',
                        'rgba(244, 63, 94, 0.85)',
                        'rgba(245, 158, 11, 0.85)'
                    ],
                    borderWidth: 0,
                    cutout: '70%',
                    borderRadius: 4,
                    spacing: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            font: { family: 'Inter', size: 12 },
                            color: textColor
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load distribution:', err);
    }
}

async function loadClassWise() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/class-wise`);
        const data = await res.json();
        
        const container = document.getElementById('class-wise-list');
        container.innerHTML = data.map(cls => `
            <div class="class-item">
                <span class="class-item-name">${cls.class_name}</span>
                <div class="class-item-bar">
                    <div class="class-item-bar-fill" style="width: ${cls.rate}%"></div>
                </div>
                <span class="class-item-rate">${cls.rate}%</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load class-wise data:', err);
    }
}

async function loadRecentActivity() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/recent-activity`);
        const data = await res.json();
        
        const container = document.getElementById('recent-activity');
        container.innerHTML = data.map(act => `
            <div class="activity-item">
                <div class="activity-dot ${act.status}"></div>
                <div class="activity-info">
                    <div class="activity-name">${act.student_name}</div>
                    <div class="activity-detail">${act.roll_number} • Class ${act.class} • ${act.date}</div>
                </div>
                <span class="activity-status ${act.status}">${act.status}</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent activity:', err);
    }
}

// ============================================================
// STUDENTS
// ============================================================

async function loadStudents() {
    try {
        const search = document.getElementById('student-search').value;
        const classId = document.getElementById('student-class-filter').value;
        
        let url = `${API_BASE}/api/students?search=${encodeURIComponent(search)}`;
        if (classId) url += `&class_id=${classId}`;
        
        const res = await fetch(url);
        const students = await res.json();
        
        const tbody = document.getElementById('students-tbody');
        const emptyState = document.getElementById('students-empty');
        
        if (students.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        tbody.innerHTML = students.map(s => {
            const rate = 0; // Will be calculated if needed
            const rateClass = rate >= 75 ? 'high' : rate >= 50 ? 'mid' : 'low';
            return `
                <tr>
                    <td><strong>${s.roll_number}</strong></td>
                    <td>${s.first_name} ${s.last_name}</td>
                    <td>Class ${s.class_name}-${s.section}</td>
                    <td>${s.gender || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td>
                        <div class="rate-bar">
                            <div class="rate-bar-track">
                                <div class="rate-bar-fill ${rateClass}" style="width: ${rate}%"></div>
                            </div>
                            <span class="rate-value ${rateClass}">${rate}%</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn view" onclick="viewStudent(${s.id})" title="View">
                                <span class="material-icons-round">visibility</span>
                            </button>
                            <button class="action-btn edit" onclick="editStudent(${s.id})" title="Edit">
                                <span class="material-icons-round">edit</span>
                            </button>
                            <button class="action-btn delete" onclick="deleteStudent(${s.id}, '${s.first_name} ${s.last_name}')" title="Delete">
                                <span class="material-icons-round">delete</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load students:', err);
    }
}

function searchStudents() {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(loadStudents, 300);
}

function filterStudents() {
    loadStudents();
}

function showAddStudentModal() {
    document.getElementById('student-modal-title').textContent = 'Add Student';
    document.getElementById('student-form').reset();
    document.getElementById('student-id').value = '';
    document.getElementById('student-roll').disabled = false;
    openModal('student-modal');
}

async function editStudent(id) {
    try {
        const res = await fetch(`${API_BASE}/api/students/${id}`);
        const student = await res.json();
        
        document.getElementById('student-modal-title').textContent = 'Edit Student';
        document.getElementById('student-id').value = student.id;
        document.getElementById('student-roll').value = student.roll_number;
        document.getElementById('student-roll').disabled = true;
        document.getElementById('student-fname').value = student.first_name;
        document.getElementById('student-lname').value = student.last_name;
        document.getElementById('student-email').value = student.email || '';
        document.getElementById('student-phone').value = student.phone || '';
        document.getElementById('student-class').value = student.class_id;
        document.getElementById('student-gender').value = student.gender || '';
        document.getElementById('student-dob').value = student.dob || '';
        document.getElementById('student-address').value = student.address || '';
        document.getElementById('student-parent').value = student.parent_name || '';
        document.getElementById('student-parent-phone').value = student.parent_phone || '';
        
        openModal('student-modal');
    } catch (err) {
        showToast('Failed to load student data', 'error');
    }
}

async function saveStudent(e) {
    e.preventDefault();
    
    const id = document.getElementById('student-id').value;
    const data = {
        roll_number: document.getElementById('student-roll').value,
        first_name: document.getElementById('student-fname').value,
        last_name: document.getElementById('student-lname').value,
        email: document.getElementById('student-email').value,
        phone: document.getElementById('student-phone').value,
        class_id: document.getElementById('student-class').value,
        gender: document.getElementById('student-gender').value,
        dob: document.getElementById('student-dob').value,
        address: document.getElementById('student-address').value,
        parent_name: document.getElementById('student-parent').value,
        parent_phone: document.getElementById('student-parent-phone').value,
    };
    
    try {
        const url = id ? `${API_BASE}/api/students/${id}` : `${API_BASE}/api/students`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('student-modal');
            loadStudents();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to save student', 'error');
    }
}

async function viewStudent(id) {
    try {
        const res = await fetch(`${API_BASE}/api/students/${id}`);
        const s = await res.json();
        const att = s.attendance_summary;
        
        const content = document.getElementById('student-detail-content');
        content.innerHTML = `
            <div class="student-detail">
                <div class="student-profile">
                    <div class="student-avatar">
                        <span class="material-icons-round">person</span>
                    </div>
                    <div>
                        <div class="student-name-lg">${s.first_name} ${s.last_name}</div>
                        <div class="student-class-lg">Class ${s.class_name}-${s.section} • Roll No: ${s.roll_number}</div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Personal Info</h4>
                    <div class="detail-row">
                        <span class="detail-label">Gender</span>
                        <span class="detail-value">${s.gender || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date of Birth</span>
                        <span class="detail-value">${s.dob || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${s.email || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${s.phone || '-'}</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Parent/Guardian</h4>
                    <div class="detail-row">
                        <span class="detail-label">Name</span>
                        <span class="detail-value">${s.parent_name || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${s.parent_phone || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Address</span>
                        <span class="detail-value">${s.address || '-'}</span>
                    </div>
                </div>
                <div class="attendance-stats-grid">
                    <div class="mini-stat present">
                        <h5>${att.present_days}</h5>
                        <p>Present</p>
                    </div>
                    <div class="mini-stat absent">
                        <h5>${att.absent_days}</h5>
                        <p>Absent</p>
                    </div>
                    <div class="mini-stat late">
                        <h5>${att.late_days}</h5>
                        <p>Late</p>
                    </div>
                    <div class="mini-stat rate">
                        <h5>${att.attendance_rate}%</h5>
                        <p>Rate</p>
                    </div>
                </div>
            </div>
        `;
        
        openModal('student-detail-modal');
    } catch (err) {
        showToast('Failed to load student details', 'error');
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE' });
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            loadStudents();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to delete student', 'error');
    }
}

// ============================================================
// ATTENDANCE
// ============================================================

let attendanceData = [];

async function loadAttendanceForDate() {
    const date = document.getElementById('attendance-date').value;
    const classId = document.getElementById('attendance-class-filter').value;
    
    if (!date) return;
    
    try {
        let url = `${API_BASE}/api/attendance/date/${date}`;
        if (classId) url += `?class_id=${classId}`;
        
        const res = await fetch(url);
        attendanceData = await res.json();
        
        renderAttendanceTable();
    } catch (err) {
        console.error('Failed to load attendance:', err);
    }
}

function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-tbody');
    
    tbody.innerHTML = attendanceData.map((record, index) => {
        const status = record.status || 'present';
        return `
            <tr>
                <td><strong>${record.roll_number}</strong></td>
                <td>${record.first_name} ${record.last_name}</td>
                <td>Class ${record.class_name}-${record.section}</td>
                <td>
                    <div class="status-select">
                        <button type="button" class="status-btn present ${status === 'present' ? 'active' : ''}" 
                                onclick="setStatus(${index}, 'present')">Present</button>
                        <button type="button" class="status-btn absent ${status === 'absent' ? 'active' : ''}" 
                                onclick="setStatus(${index}, 'absent')">Absent</button>
                        <button type="button" class="status-btn late ${status === 'late' ? 'active' : ''}" 
                                onclick="setStatus(${index}, 'late')">Late</button>
                        <button type="button" class="status-btn excused ${status === 'excused' ? 'active' : ''}" 
                                onclick="setStatus(${index}, 'excused')">Excused</button>
                    </div>
                </td>
                <td>
                    <input type="text" class="att-remarks" 
                           value="${record.remarks || ''}" 
                           placeholder="Remarks..."
                           onchange="setRemarks(${index}, this.value)">
                </td>
            </tr>
        `;
    }).join('');
    
    updateAttendanceCounts();
}

function setStatus(index, status) {
    attendanceData[index].status = status;
    renderAttendanceTable();
}

function setRemarks(index, value) {
    attendanceData[index].remarks = value;
}

function markAllPresent() {
    attendanceData.forEach(r => r.status = 'present');
    renderAttendanceTable();
}

function markAllAbsent() {
    attendanceData.forEach(r => r.status = 'absent');
    renderAttendanceTable();
}

function updateAttendanceCounts() {
    const present = attendanceData.filter(r => (r.status || 'present') === 'present').length;
    const absent = attendanceData.filter(r => r.status === 'absent').length;
    const late = attendanceData.filter(r => r.status === 'late').length;
    
    document.getElementById('att-present-count').textContent = present;
    document.getElementById('att-absent-count').textContent = absent;
    document.getElementById('att-late-count').textContent = late;
    document.getElementById('att-total-count').textContent = attendanceData.length;
}

async function saveAttendance() {
    const date = document.getElementById('attendance-date').value;
    const btn = document.getElementById('save-attendance-btn');
    
    if (attendanceData.length === 0) {
        showToast('No students to mark attendance', 'warning');
        return;
    }
    
    btn.innerHTML = '<span class="loading"></span>';
    btn.disabled = true;
    
    const records = attendanceData.map(r => ({
        student_id: r.student_id,
        status: r.status || 'present',
        remarks: r.remarks || ''
    }));
    
    try {
        const res = await fetch(`${API_BASE}/api/attendance/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                records,
                marked_by: currentUser?.id || 1
            })
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to save attendance', 'error');
    }
    
    btn.innerHTML = '<span class="material-icons-round">save</span><span>Save Attendance</span>';
    btn.disabled = false;
}

// ============================================================
// REPORTS
// ============================================================

async function generateReport() {
    const classId = document.getElementById('report-class-filter').value;
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    try {
        let url = `${API_BASE}/api/attendance/report?from_date=${fromDate}&to_date=${toDate}`;
        if (classId) url += `&class_id=${classId}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        const tbody = document.getElementById('report-tbody');
        const emptyState = document.getElementById('report-empty');
        
        if (data.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        tbody.innerHTML = data.map(r => {
            const rateClass = r.attendance_rate >= 75 ? 'high' : r.attendance_rate >= 50 ? 'mid' : 'low';
            return `
                <tr>
                    <td><strong>${r.roll_number}</strong></td>
                    <td>${r.first_name} ${r.last_name}</td>
                    <td>Class ${r.class_name}-${r.section}</td>
                    <td>${r.total_days}</td>
                    <td><span class="badge badge-present">${r.present_days}</span></td>
                    <td><span class="badge badge-absent">${r.absent_days}</span></td>
                    <td><span class="badge badge-late">${r.late_days}</span></td>
                    <td>
                        <div class="rate-bar">
                            <div class="rate-bar-track">
                                <div class="rate-bar-fill ${rateClass}" style="width: ${r.attendance_rate}%"></div>
                            </div>
                            <span class="rate-value ${rateClass}">${r.attendance_rate}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        showToast('Failed to generate report', 'error');
    }
}

function exportReport() {
    const classId = document.getElementById('report-class-filter').value;
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    let url = `${API_BASE}/api/attendance/export?from_date=${fromDate}&to_date=${toDate}`;
    if (classId) url += `&class_id=${classId}`;
    
    window.open(url, '_blank');
    showToast('Report downloaded successfully', 'success');
}

// ============================================================
// CLASSES
// ============================================================

async function loadClasses() {
    try {
        const res = await fetch(`${API_BASE}/api/classes`);
        const classes = await res.json();
        
        const grid = document.getElementById('classes-grid');
        grid.innerHTML = classes.map(cls => `
            <div class="class-card">
                <div class="class-card-header">
                    <span class="class-card-title">Class ${cls.class_name}-${cls.section}</span>
                    <span class="class-card-badge">${cls.student_count} students</span>
                </div>
                <div class="class-card-info">
                    <div class="class-card-info-item">
                        <span class="material-icons-round">person</span>
                        <span>${cls.teacher_name || 'No teacher assigned'}</span>
                    </div>
                    <div class="class-card-info-item">
                        <span class="material-icons-round">calendar_today</span>
                        <span>Created: ${new Date(cls.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="class-card-actions">
                    <button class="action-btn delete" onclick="deleteClass(${cls.id}, 'Class ${cls.class_name}-${cls.section}')" title="Delete">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load classes:', err);
    }
}

function showAddClassModal() {
    document.getElementById('class-form').reset();
    openModal('class-modal');
}

async function saveClass(e) {
    e.preventDefault();
    
    const data = {
        class_name: document.getElementById('class-name').value,
        section: document.getElementById('class-section').value,
        teacher_name: document.getElementById('class-teacher').value
    };
    
    try {
        const res = await fetch(`${API_BASE}/api/classes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('class-modal');
            loadClasses();
            loadClassFilters();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to save class', 'error');
    }
}

async function deleteClass(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/classes/${id}`, { method: 'DELETE' });
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            loadClasses();
            loadClassFilters();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to delete class', 'error');
    }
}

// ============================================================
// NOTICES
// ============================================================

async function loadNotices() {
    try {
        const res = await fetch(`${API_BASE}/api/notices`);
        const notices = await res.json();
        
        const container = document.getElementById('notices-list');
        container.innerHTML = notices.map(n => `
            <div class="notice-card ${n.priority}">
                <div class="notice-header">
                    <div class="notice-title">${n.title}</div>
                    <div class="notice-meta">
                        <span class="badge badge-${n.priority}">${n.priority}</span>
                        <button class="action-btn delete" onclick="deleteNotice(${n.id})" title="Delete">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                </div>
                <div class="notice-content">${n.content}</div>
                <div class="notice-footer">
                    <span>By ${n.author || 'Admin'}</span>
                    <span>${new Date(n.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load notices:', err);
    }
}

function showAddNoticeModal() {
    document.getElementById('notice-form').reset();
    openModal('notice-modal');
}

async function saveNotice(e) {
    e.preventDefault();
    
    const data = {
        title: document.getElementById('notice-title').value,
        content: document.getElementById('notice-content').value,
        priority: document.getElementById('notice-priority').value,
        created_by: currentUser?.id || 1
    };
    
    try {
        const res = await fetch(`${API_BASE}/api/notices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('notice-modal');
            loadNotices();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to save notice', 'error');
    }
}

async function deleteNotice(id) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/notices/${id}`, { method: 'DELETE' });
        const result = await res.json();
        
        if (result.success) {
            showToast('Notice deleted', 'success');
            loadNotices();
        }
    } catch (err) {
        showToast('Failed to delete notice', 'error');
    }
}

// ============================================================
// SETTINGS
// ============================================================

async function changePassword(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                old_password: oldPassword,
                new_password: newPassword
            })
        });
        
        const result = await res.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            document.getElementById('change-password-form').reset();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Failed to change password', 'error');
    }
}

// ============================================================
// HELPERS
// ============================================================

async function loadClassFilters() {
    try {
        const res = await fetch(`${API_BASE}/api/classes`);
        const classes = await res.json();
        
        const options = '<option value="">All Classes</option>' +
            classes.map(c => `<option value="${c.id}">Class ${c.class_name}-${c.section}</option>`).join('');
        
        // Student class select in modal
        const studentClassSelect = document.getElementById('student-class');
        if (studentClassSelect) {
            studentClassSelect.innerHTML = '<option value="">Select Class</option>' +
                classes.map(c => `<option value="${c.id}">Class ${c.class_name}-${c.section}</option>`).join('');
        }
        
        // Update all filter selects
        ['student-class-filter', 'attendance-class-filter', 'report-class-filter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = options;
        });
    } catch (err) {
        console.error('Failed to load class filters:', err);
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');
    const iconEl = toast.querySelector('.toast-icon');
    
    messageEl.textContent = message;
    toast.className = `toast ${type} show`;
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    iconEl.textContent = icons[type] || 'check_circle';
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
