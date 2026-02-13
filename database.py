import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance.db')

def get_db():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initialize database with tables and seed data."""
    conn = get_db()
    cursor = conn.cursor()

    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create Classes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT NOT NULL,
            section TEXT NOT NULL,
            teacher_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(class_name, section)
        )
    ''')

    # Create Students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            class_id INTEGER NOT NULL,
            gender TEXT,
            dob TEXT,
            address TEXT,
            parent_name TEXT,
            parent_phone TEXT,
            profile_image TEXT DEFAULT 'default.png',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES classes(id)
        )
    ''')

    # Create Attendance table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
            remarks TEXT,
            marked_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (marked_by) REFERENCES users(id),
            UNIQUE(student_id, date)
        )
    ''')

    # Create Notices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ''')

    # Seed default admin user (password: admin123)
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        from werkzeug.security import generate_password_hash
        cursor.execute('''
            INSERT INTO users (username, password, full_name, role)
            VALUES (?, ?, ?, ?)
        ''', ('admin', generate_password_hash('admin123'), 'Administrator', 'admin'))

    # Seed default classes
    cursor.execute("SELECT COUNT(*) FROM classes")
    if cursor.fetchone()[0] == 0:
        classes = [
            ('10', 'A', 'Mrs. Sharma'), ('10', 'B', 'Mr. Verma'),
            ('11', 'A', 'Mrs. Gupta'), ('11', 'B', 'Mr. Singh'),
            ('12', 'A', 'Mrs. Patel'), ('12', 'B', 'Mr. Kumar'),
            ('9', 'A', 'Mrs. Joshi'), ('9', 'B', 'Mr. Rao'),
        ]
        cursor.executemany('''
            INSERT INTO classes (class_name, section, teacher_name)
            VALUES (?, ?, ?)
        ''', classes)

    # Seed sample students
    cursor.execute("SELECT COUNT(*) FROM students")
    if cursor.fetchone()[0] == 0:
        students = [
            ('STU001', 'Aarav', 'Sharma', 'aarav@email.com', '9876543210', 1, 'Male', '2008-05-15', '123 Main St', 'Mr. Sharma', '9876543211'),
            ('STU002', 'Priya', 'Gupta', 'priya@email.com', '9876543212', 1, 'Female', '2008-08-22', '456 Oak Ave', 'Mr. Gupta', '9876543213'),
            ('STU003', 'Rohan', 'Verma', 'rohan@email.com', '9876543214', 2, 'Male', '2008-03-10', '789 Pine Rd', 'Mr. Verma', '9876543215'),
            ('STU004', 'Sneha', 'Patel', 'sneha@email.com', '9876543216', 1, 'Female', '2008-11-05', '321 Elm St', 'Mr. Patel', '9876543217'),
            ('STU005', 'Arjun', 'Singh', 'arjun@email.com', '9876543218', 3, 'Male', '2007-07-18', '654 Maple Dr', 'Mr. Singh', '9876543219'),
            ('STU006', 'Ananya', 'Kumar', 'ananya@email.com', '9876543220', 3, 'Female', '2007-01-25', '987 Cedar Ln', 'Mr. Kumar', '9876543221'),
            ('STU007', 'Vikram', 'Joshi', 'vikram@email.com', '9876543222', 4, 'Male', '2007-09-30', '159 Birch Ct', 'Mr. Joshi', '9876543223'),
            ('STU008', 'Kavya', 'Rao', 'kavya@email.com', '9876543224', 2, 'Female', '2008-06-12', '753 Walnut Ave', 'Mr. Rao', '9876543225'),
            ('STU009', 'Aditya', 'Mishra', 'aditya@email.com', '9876543226', 5, 'Male', '2006-04-08', '852 Spruce St', 'Mr. Mishra', '9876543227'),
            ('STU010', 'Ishita', 'Reddy', 'ishita@email.com', '9876543228', 5, 'Female', '2006-12-20', '963 Ash Blvd', 'Mr. Reddy', '9876543229'),
            ('STU011', 'Karan', 'Malhotra', 'karan@email.com', '9876543230', 6, 'Male', '2006-02-14', '147 Poplar Way', 'Mr. Malhotra', '9876543231'),
            ('STU012', 'Diya', 'Chopra', 'diya@email.com', '9876543232', 4, 'Female', '2007-10-03', '258 Willow Rd', 'Mr. Chopra', '9876543233'),
            ('STU013', 'Raj', 'Thakur', 'raj@email.com', '9876543234', 7, 'Male', '2009-01-17', '369 Cypress Ave', 'Mr. Thakur', '9876543235'),
            ('STU014', 'Meera', 'Bhatia', 'meera@email.com', '9876543236', 7, 'Female', '2009-06-28', '471 Sequoia Dr', 'Mr. Bhatia', '9876543237'),
            ('STU015', 'Siddharth', 'Nair', 'sid@email.com', '9876543238', 8, 'Male', '2009-08-11', '582 Redwood Ln', 'Mr. Nair', '9876543239'),
        ]
        cursor.executemany('''
            INSERT INTO students (roll_number, first_name, last_name, email, phone, class_id, gender, dob, address, parent_name, parent_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', students)

    # Seed sample attendance for last 30 days
    cursor.execute("SELECT COUNT(*) FROM attendance")
    if cursor.fetchone()[0] == 0:
        import random
        from datetime import datetime, timedelta
        
        student_ids = [row[0] for row in cursor.execute("SELECT id FROM students").fetchall()]
        statuses = ['present', 'present', 'present', 'present', 'present', 'present', 'absent', 'late', 'excused']
        
        for day_offset in range(30, 0, -1):
            date = (datetime.now() - timedelta(days=day_offset)).strftime('%Y-%m-%d')
            # Skip weekends
            day_of_week = (datetime.now() - timedelta(days=day_offset)).weekday()
            if day_of_week >= 5:
                continue
            for sid in student_ids:
                status = random.choice(statuses)
                cursor.execute('''
                    INSERT OR IGNORE INTO attendance (student_id, date, status, marked_by)
                    VALUES (?, ?, ?, 1)
                ''', (sid, date, status))

    # Seed sample notices
    cursor.execute("SELECT COUNT(*) FROM notices")
    if cursor.fetchone()[0] == 0:
        notices = [
            ('Parent-Teacher Meeting', 'Annual PTM scheduled for next Saturday. All parents are requested to attend.', 'high', 1),
            ('Sports Day', 'Annual sports day will be held on 25th February. Students should wear sports uniforms.', 'normal', 1),
            ('Exam Schedule', 'Mid-term exams start from 1st March. Detailed schedule is available at reception.', 'high', 1),
        ]
        cursor.executemany('''
            INSERT INTO notices (title, content, priority, created_by)
            VALUES (?, ?, ?, ?)
        ''', notices)

    conn.commit()
    conn.close()
    print("Database initialized successfully!")

if __name__ == '__main__':
    init_db()
