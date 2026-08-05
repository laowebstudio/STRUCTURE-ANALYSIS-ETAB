# SAPUDOM Structure Analysis V1.5.1

พัฒนาต่อจาก V1.5 โดยเพิ่ม Engineering Libraries ตาม Roadmap

## ฟังก์ชันใหม่
- Material Library: Concrete, Steel และ Custom Material
- Section Library: RC Rectangular, Steel I และ Custom Section
- เลือก Material/Section แล้วนำ E, A, I ไปใช้กับ Member
- Load Case Manager: DL, LL, Wind, Earthquake และ Other
- Node Load แยกตาม Active Load Case
- JSON และ Supabase Cloud เก็บ Material, Section และ Load Cases ภายใน model เดิม
- ไม่ต้องรัน SQL เพิ่ม เพราะข้อมูลใหม่ถูกเก็บในคอลัมน์ model แบบ JSON
- ฟังก์ชัน V1.5 Auto Scale, Diagram, Solver, CSV และ Cloud เดิมยังอยู่ครบ

## ทดสอบแนะนำ
1. เปิด Material Library แล้วเพิ่ม Material ใหม่
2. เปิด Section Library แล้วเพิ่ม Section ใหม่
3. เลือก Member และกดนำใช้ค่า
4. เพิ่ม Load Case WL และใส่ Load ใน WL
5. สลับ DL/WL เพื่อตรวจว่า Load แยกกัน
6. Analyze แต่ละ Load Case
7. Save JSON / Cloud แล้วเปิดกลับมาตรวจข้อมูล
