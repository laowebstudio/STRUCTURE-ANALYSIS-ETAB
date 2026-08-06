# SAPUDOM Structure Analysis V1.10

พัฒนาต่อจาก V1.9 Stable โดยคง Building Generator, Story Manager, Solver, Load Case/Combination, Member Loads, JSON, CSV และ Supabase Cloud ไว้ครบ

## ใหม่ใน V1.10
- Member end moment release ที่ i-End และ j-End
- Assign release ให้หลาย Member พร้อมกัน
- สัญลักษณ์วงกลมสีม่วงที่ปลาย Member ซึ่งปล่อย Mz
- Internal hinge: แบ่ง Member เป็น 2 ชิ้นและปล่อยโมเมนต์ที่จุดแบ่ง
- JSON/Cloud เก็บข้อมูล release ได้
- Solver ใช้ static condensation เพื่อให้ moment ที่ released end เป็นศูนย์

## ข้อจำกัด
- V1.10 รองรับ release เฉพาะ Mz สำหรับ 2D frame
- การเพิ่ม internal hinge ใช้กับ Member ที่ไม่มี Member Load เท่านั้น เพื่อป้องกันการถ่ายโอนโหลดผิดตำแหน่ง
- การปล่อยหลายจุดอาจทำให้โครงสร้างเป็น mechanism; โปรแกรมจะแจ้ง Matrix singular
