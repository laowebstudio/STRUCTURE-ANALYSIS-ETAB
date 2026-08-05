# SAPUDOM Structure Analysis V1.5.2 — Load Combination

พัฒนาต่อจาก V1.5.1 Stable โดยรักษา Solver, Diagram, Material/Section Library, JSON, CSV และ Supabase Cloud เดิมไว้

## ฟังก์ชันใหม่
- Load Combination Manager
- Combination เริ่มต้น: `1.4DL` และ `1.2DL + 1.6LL`
- เพิ่ม/ลบ Combination และกำหนด Factor ตาม Load Case
- เลือกวิเคราะห์ได้ทั้ง Load Case และ Load Combination
- Displacement, Reaction, Member Force และ Diagram แสดงตามรายการที่เลือก
- บันทึก Load Cases/Load Combinations ใน JSON และ Supabase model เดิม
- ไม่ต้องรัน SQL เพิ่ม

## วิธีทดสอบ
1. สร้างแรงใน DL
2. สร้าง/เลือก LL แล้วใส่แรงอีกชุด
3. กด `+ Combination` และสร้าง `1.2DL + 1.6LL`
4. เลือก Combination ในช่อง Analyze
5. กด Analyze และตรวจผล/Diagram

## อัปเดต GitHub
คัดลอกไฟล์ทั้งหมดไปวางทับใน Repository เดิม โดยไม่ลบ `.git` แล้ว Commit/Push
