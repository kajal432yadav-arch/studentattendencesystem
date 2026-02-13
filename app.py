"""
Student Attendance System - Flask Backend
==========================================
REST API server for the student attendance management system.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db
from datetime import datetime, timedelta
import os
import csv
import io

app = Flask(__name__, static_folder='static')
CORS(app)

# Initialize database on startup
init_db()

# ============================================================
# SERVE FRONTEND
# ============================================================

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    return send_from_directory('static', 'index.html')

# ============================================================
# AUTH ENDPOINTS
# ============================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '')
    password = data.get('password', '')
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    db.close()
    
    if user and check_password_hash(user['password'], password):
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'full_name': user['full_name'],
                'role': user['role']
            }
        })
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/auth/change-password', methods=['POST'])
def change_password():
    data = request.json
    user_id = data.get('user_id')
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    
    if not user or not check_password_hash(user['password'], old_password):
        db.close()
        return jsonify({'success': False, 'message': 'Invalid old password'}), 400
    
    db.execute('UPDATE users SET password = ? WHERE id = ?',
               (generate_password_hash(new_password), user_id))
    db.commit()
    db.close()
    return jsonify({'success': True, 'message': 'Password changed successfully'})

# ============================================================
# DASHBOARD ENDPOINTS
# ============================================================

@app.route('/api/dashboard/stats')
def dashboard_stats():
    db = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    
    total_students = db.execute('SELECT COUNT(*) FROM students WHERE status = "active"').fetchone()[0]
    total_classes = db.execute('SELECT COUNT(*) FROM classes').fetchone()[0]
    
    today_present = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "present"', (today,)
    ).fetchone()[0]
    today_absent = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "absent"', (today,)
    ).fetchone()[0]
    today_late = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "late"', (today,)
    ).fetchone()[0]
    today_total = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE date = ?', (today,)
    ).fetchone()[0]
    
    attendance_rate = round((today_present / today_total * 100) if today_total > 0 else 0, 1)
    
    # Gender distribution
    male_count = db.execute('SELECT COUNT(*) FROM students WHERE gender = "Male" AND status = "active"').fetchone()[0]
    female_count = db.execute('SELECT COUNT(*) FROM students WHERE gender = "Female" AND status = "active"').fetchone()[0]
    
    db.close()
    
    return jsonify({
        'total_students': total_students,
        'total_classes': total_classes,
        'today_present': today_present,
        'today_absent': today_absent,
        'today_late': today_late,
        'attendance_rate': attendance_rate,
        'male_count': male_count,
        'female_count': female_count
    })

@app.route('/api/dashboard/weekly-trend')
def weekly_trend():
    db = get_db()
    trends = []
    
    for i in range(6, -1, -1):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        day_name = (datetime.now() - timedelta(days=i)).strftime('%a')
        
        present = db.execute(
            'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "present"', (date,)
        ).fetchone()[0]
        absent = db.execute(
            'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "absent"', (date,)
        ).fetchone()[0]
        late = db.execute(
            'SELECT COUNT(*) FROM attendance WHERE date = ? AND status = "late"', (date,)
        ).fetchone()[0]
        
        trends.append({
            'date': date,
            'day': day_name,
            'present': present,
            'absent': absent,
            'late': late
        })
    
    db.close()
    return jsonify(trends)

@app.route('/api/dashboard/class-wise')
def class_wise_stats():
    db = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    
    classes = db.execute('SELECT * FROM classes ORDER BY class_name, section').fetchall()
    result = []
    
    for cls in classes:
        total = db.execute(
            'SELECT COUNT(*) FROM students WHERE class_id = ? AND status = "active"', (cls['id'],)
        ).fetchone()[0]
        present = db.execute('''
            SELECT COUNT(*) FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE s.class_id = ? AND a.date = ? AND a.status = "present"
        ''', (cls['id'], today)).fetchone()[0]
        
        result.append({
            'class_name': f"Class {cls['class_name']}-{cls['section']}",
            'total': total,
            'present': present,
            'rate': round((present / total * 100) if total > 0 else 0, 1)
        })
    
    db.close()
    return jsonify(result)

@app.route('/api/dashboard/recent-activity')
def recent_activity():
    db = get_db()
    activities = db.execute('''
        SELECT a.*, s.first_name, s.last_name, s.roll_number,
               c.class_name, c.section
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        ORDER BY a.created_at DESC
        LIMIT 10
    ''').fetchall()
    
    result = [{
        'student_name': f"{act['first_name']} {act['last_name']}",
        'roll_number': act['roll_number'],
        'class': f"{act['class_name']}-{act['section']}",
        'status': act['status'],
        'date': act['date'],
        'time': act['created_at']
    } for act in activities]
    
    db.close()
    return jsonify(result)

# ============================================================
# STUDENT ENDPOINTS
# ============================================================

@app.route('/api/students', methods=['GET'])
def get_students():
    db = get_db()
    class_id = request.args.get('class_id')
    search = request.args.get('search', '')
    status = request.args.get('status', 'active')
    
    query = '''
        SELECT s.*, c.class_name, c.section
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.status = ?
    '''
    params = [status]
    
    if class_id:
        query += ' AND s.class_id = ?'
        params.append(class_id)
    
    if search:
        query += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.roll_number LIKE ?)'
        search_param = f'%{search}%'
        params.extend([search_param, search_param, search_param])
    
    query += ' ORDER BY s.roll_number'
    
    students = db.execute(query, params).fetchall()
    result = [dict(s) for s in students]
    db.close()
    
    return jsonify(result)

@app.route('/api/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    db = get_db()
    student = db.execute('''
        SELECT s.*, c.class_name, c.section
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = ?
    ''', (student_id,)).fetchone()
    
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    
    # Get attendance summary
    total_days = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE student_id = ?', (student_id,)
    ).fetchone()[0]
    present_days = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE student_id = ? AND status = "present"', (student_id,)
    ).fetchone()[0]
    absent_days = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE student_id = ? AND status = "absent"', (student_id,)
    ).fetchone()[0]
    late_days = db.execute(
        'SELECT COUNT(*) FROM attendance WHERE student_id = ? AND status = "late"', (student_id,)
    ).fetchone()[0]
    
    result = dict(student)
    result['attendance_summary'] = {
        'total_days': total_days,
        'present_days': present_days,
        'absent_days': absent_days,
        'late_days': late_days,
        'attendance_rate': round((present_days / total_days * 100) if total_days > 0 else 0, 1)
    }
    
    db.close()
    return jsonify(result)

@app.route('/api/students', methods=['POST'])
def add_student():
    data = request.json
    db = get_db()
    
    try:
        db.execute('''
            INSERT INTO students (roll_number, first_name, last_name, email, phone,
                class_id, gender, dob, address, parent_name, parent_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['roll_number'], data['first_name'], data['last_name'],
            data.get('email', ''), data.get('phone', ''),
            data['class_id'], data.get('gender', ''),
            data.get('dob', ''), data.get('address', ''),
            data.get('parent_name', ''), data.get('parent_phone', '')
        ))
        db.commit()
        student_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        db.close()
        return jsonify({'success': True, 'id': student_id, 'message': 'Student added successfully'})
    except Exception as e:
        db.close()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    data = request.json
    db = get_db()
    
    try:
        db.execute('''
            UPDATE students SET
                first_name = ?, last_name = ?, email = ?, phone = ?,
                class_id = ?, gender = ?, dob = ?, address = ?,
                parent_name = ?, parent_phone = ?
            WHERE id = ?
        ''', (
            data['first_name'], data['last_name'],
            data.get('email', ''), data.get('phone', ''),
            data['class_id'], data.get('gender', ''),
            data.get('dob', ''), data.get('address', ''),
            data.get('parent_name', ''), data.get('parent_phone', ''),
            student_id
        ))
        db.commit()
        db.close()
        return jsonify({'success': True, 'message': 'Student updated successfully'})
    except Exception as e:
        db.close()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    db = get_db()
    db.execute('UPDATE students SET status = "inactive" WHERE id = ?', (student_id,))
    db.commit()
    db.close()
    return jsonify({'success': True, 'message': 'Student deactivated successfully'})

# ============================================================
# CLASS ENDPOINTS
# ============================================================

@app.route('/api/classes', methods=['GET'])
def get_classes():
    db = get_db()
    classes = db.execute('''
        SELECT c.*, COUNT(s.id) as student_count
        FROM classes c
        LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
        GROUP BY c.id
        ORDER BY c.class_name, c.section
    ''').fetchall()
    result = [dict(c) for c in classes]
    db.close()
    return jsonify(result)

@app.route('/api/classes', methods=['POST'])
def add_class():
    data = request.json
    db = get_db()
    try:
        db.execute('''
            INSERT INTO classes (class_name, section, teacher_name)
            VALUES (?, ?, ?)
        ''', (data['class_name'], data['section'], data.get('teacher_name', '')))
        db.commit()
        db.close()
        return jsonify({'success': True, 'message': 'Class added successfully'})
    except Exception as e:
        db.close()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/classes/<int:class_id>', methods=['DELETE'])
def delete_class(class_id):
    db = get_db()
    student_count = db.execute(
        'SELECT COUNT(*) FROM students WHERE class_id = ? AND status = "active"', (class_id,)
    ).fetchone()[0]
    
    if student_count > 0:
        db.close()
        return jsonify({'success': False, 'message': 'Cannot delete class with active students'}), 400
    
    db.execute('DELETE FROM classes WHERE id = ?', (class_id,))
    db.commit()
    db.close()
    return jsonify({'success': True, 'message': 'Class deleted successfully'})

# ============================================================
# ATTENDANCE ENDPOINTS
# ============================================================

@app.route('/api/attendance/mark', methods=['POST'])
def mark_attendance():
    data = request.json
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    records = data.get('records', [])
    marked_by = data.get('marked_by', 1)
    
    db = get_db()
    try:
        for record in records:
            db.execute('''
                INSERT OR REPLACE INTO attendance (student_id, date, status, remarks, marked_by)
                VALUES (?, ?, ?, ?, ?)
            ''', (record['student_id'], date, record['status'],
                  record.get('remarks', ''), marked_by))
        db.commit()
        db.close()
        return jsonify({'success': True, 'message': f'Attendance marked for {len(records)} students'})
    except Exception as e:
        db.close()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/attendance/date/<date>')
def get_attendance_by_date(date):
    db = get_db()
    class_id = request.args.get('class_id')
    
    query = '''
        SELECT s.id as student_id, s.roll_number, s.first_name, s.last_name,
               c.class_name, c.section,
               a.status, a.remarks
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
        WHERE s.status = 'active'
    '''
    params = [date]
    
    if class_id:
        query += ' AND s.class_id = ?'
        params.append(class_id)
    
    query += ' ORDER BY c.class_name, c.section, s.roll_number'
    
    records = db.execute(query, params).fetchall()
    result = [dict(r) for r in records]
    db.close()
    
    return jsonify(result)

@app.route('/api/attendance/student/<int:student_id>')
def get_student_attendance(student_id):
    db = get_db()
    month = request.args.get('month')
    
    query = 'SELECT * FROM attendance WHERE student_id = ?'
    params = [student_id]
    
    if month:
        query += ' AND date LIKE ?'
        params.append(f'{month}%')
    
    query += ' ORDER BY date DESC'
    
    records = db.execute(query, params).fetchall()
    result = [dict(r) for r in records]
    db.close()
    
    return jsonify(result)

@app.route('/api/attendance/report')
def attendance_report():
    db = get_db()
    class_id = request.args.get('class_id')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    
    if not from_date:
        from_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not to_date:
        to_date = datetime.now().strftime('%Y-%m-%d')
    
    query = '''
        SELECT s.id, s.roll_number, s.first_name, s.last_name,
               c.class_name, c.section,
               COUNT(a.id) as total_days,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
               SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
               SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
               SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_days
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN attendance a ON s.id = a.student_id
            AND a.date BETWEEN ? AND ?
        WHERE s.status = 'active'
    '''
    params = [from_date, to_date]
    
    if class_id:
        query += ' AND s.class_id = ?'
        params.append(class_id)
    
    query += ' GROUP BY s.id ORDER BY c.class_name, c.section, s.roll_number'
    
    records = db.execute(query, params).fetchall()
    result = []
    for r in records:
        d = dict(r)
        d['attendance_rate'] = round(
            (d['present_days'] / d['total_days'] * 100) if d['total_days'] > 0 else 0, 1
        )
        result.append(d)
    
    db.close()
    return jsonify(result)

@app.route('/api/attendance/export')
def export_attendance():
    db = get_db()
    class_id = request.args.get('class_id')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    
    if not from_date:
        from_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not to_date:
        to_date = datetime.now().strftime('%Y-%m-%d')
    
    query = '''
        SELECT s.roll_number, s.first_name, s.last_name,
               c.class_name, c.section, a.date, a.status, a.remarks
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        WHERE a.date BETWEEN ? AND ? AND s.status = 'active'
    '''
    params = [from_date, to_date]
    
    if class_id:
        query += ' AND s.class_id = ?'
        params.append(class_id)
    
    query += ' ORDER BY a.date, c.class_name, c.section, s.roll_number'
    
    records = db.execute(query, params).fetchall()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Roll Number', 'First Name', 'Last Name', 'Class', 'Section', 'Date', 'Status', 'Remarks'])
    
    for r in records:
        writer.writerow([r['roll_number'], r['first_name'], r['last_name'],
                        r['class_name'], r['section'], r['date'], r['status'], r['remarks']])
    
    db.close()
    
    csv_content = output.getvalue()
    return csv_content, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename=attendance_report_{from_date}_to_{to_date}.csv'
    }

# ============================================================
# NOTICES ENDPOINTS
# ============================================================

@app.route('/api/notices', methods=['GET'])
def get_notices():
    db = get_db()
    notices = db.execute('''
        SELECT n.*, u.full_name as author
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        ORDER BY n.created_at DESC
    ''').fetchall()
    result = [dict(n) for n in notices]
    db.close()
    return jsonify(result)

@app.route('/api/notices', methods=['POST'])
def add_notice():
    data = request.json
    db = get_db()
    try:
        db.execute('''
            INSERT INTO notices (title, content, priority, created_by)
            VALUES (?, ?, ?, ?)
        ''', (data['title'], data['content'], data.get('priority', 'normal'), data.get('created_by', 1)))
        db.commit()
        db.close()
        return jsonify({'success': True, 'message': 'Notice added successfully'})
    except Exception as e:
        db.close()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/notices/<int:notice_id>', methods=['DELETE'])
def delete_notice(notice_id):
    db = get_db()
    db.execute('DELETE FROM notices WHERE id = ?', (notice_id,))
    db.commit()
    db.close()
    return jsonify({'success': True, 'message': 'Notice deleted successfully'})

# ============================================================
# RUN SERVER
# ============================================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("   Student Attendance System Server")
    print("   http://localhost:5000")
    print("="*60)
    print("   Default Login:")
    print("   Username: admin")
    print("   Password: admin123")
    print("="*60 + "\n")
    app.run(debug=True, port=5000)
