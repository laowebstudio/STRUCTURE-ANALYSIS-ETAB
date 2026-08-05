# SAPUDOM Structure Analysis V1.4.3

พัฒนาต่อจาก V1.4.2 โดยเน้นให้การเปิดดูผล Diagram ชัดเจนและทดสอบง่ายขึ้น

## เพิ่มใน V1.4.3
- แถบปุ่มผลลัพธ์ที่มองเห็นชัด: Model, Deformed, Axial N, Shear V, Moment M
- ปุ่มลัด 1–5 สำหรับสลับผล
- หลัง Analyze ระบบเปิด Deformed Shape อัตโนมัติ
- Legend แสดงชนิด Diagram, Scale และค่า Min/Max
- ปุ่ม Diagram จะถูกปิดจนกว่าจะวิเคราะห์สำเร็จ
- ปรับ Scale และเปิด/ปิด Values ได้ทันที
- Highlight Diagram ของ Member ที่เลือก
- คง Solver, CSV, JSON และ Supabase Cloud จาก V1.4.2
- ไม่ต้องรัน Supabase SQL ใหม่

## วิธีทดสอบ
1. สร้างหรือเปิด Sample model
2. กด Analyze
3. กดปุ่ม Deformed, Axial N, Shear V และ Moment M ที่อยู่เหนือ Canvas
4. ปรับ Scale และ Values
5. คลิก Member แล้วตรวจ Highlight และค่าใน Member Forces
