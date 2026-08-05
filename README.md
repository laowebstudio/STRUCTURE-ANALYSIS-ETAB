# SAPUDOM Structure Analysis V1.5.2 Fix

แก้ปัญหา Layout บน Safari/MacBook หลังเพิ่ม Load Combination:

- Canvas ใช้ความกว้างเต็มพื้นที่ตรงกลาง
- Toolbar สามารถขึ้นบรรทัดใหม่โดยไม่บีบ Canvas
- ตารางผลลัพธ์ยังอยู่ด้านล่าง
- เพิ่ม ResizeObserver ให้ Canvas ปรับขนาดทันทีเมื่อ Layout เปลี่ยน
- รองรับหน้าจอ MacBook หลายขนาด
- คง Load Cases, Load Combinations, Solver, Diagram, JSON, CSV และ Supabase Cloud เดิม
- ไม่ต้องรัน Supabase SQL ใหม่

## อัปเดต
คัดลอกไฟล์ทั้งหมดไปวางทับใน Repository เดิม โดยไม่ลบ `.git` แล้ว Commit/Push จากนั้นรีเฟรช Safari ด้วย Command + Option + R
