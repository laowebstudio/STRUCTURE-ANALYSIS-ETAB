# SAPUDOM Structure Analysis V1.5

พัฒนาต่อจาก V1.4.3 โดยรักษา Solver, Diagram, JSON, CSV และ Supabase เดิมไว้

## ฟังก์ชันใหม่
- Auto Scale สำหรับ Deformed, Axial, Shear และ Moment Diagram
- คำนวณขนาด Diagram ตามพื้นที่หน้าจอและขนาดโมเดลอัตโนมัติ
- สลับ Auto/Manual Scale ได้
- ปุ่ม − / 1× / ＋ สำหรับปรับขนาดอย่างรวดเร็ว
- Manual Scale รองรับ 0.2–10 เท่า
- Legend ระบุว่าใช้ Auto Scale หรือ Manual Scale
- ไม่เปลี่ยนค่าผลวิเคราะห์ เปลี่ยนเฉพาะขนาดภาพ Diagram
- ใช้ Supabase schema เดิม ไม่ต้องรัน SQL เพิ่ม

## การอัปเดต GitHub
เก็บ V1.4.3 เป็น Backup แล้วคัดลอกไฟล์ทั้งหมดของ V1.5 ไปแทนไฟล์เดิม โดยห้ามลบโฟลเดอร์ `.git` จากนั้น Commit และ Push
